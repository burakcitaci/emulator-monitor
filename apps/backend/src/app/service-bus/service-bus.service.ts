import {
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  ServiceBusClient,
  ServiceBusMessage,
  ServiceBusReceiver,
  ServiceBusSender,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import { randomUUID } from 'crypto';
import { SERVICE_BUS_CLIENT } from './service-bus.constants';
import { SendServiceBusMessageDto } from './dto/send-service-bus-message.dto';
import { ReceiveServiceBusMessageDto } from './dto/receive-service-bus-message.dto';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';
import { MessageService } from '../messages/messages.service';
import { TrackingMessage } from '../messages/message.schema';

@Injectable()
export class ServiceBusService implements OnModuleDestroy {
  private readonly senders = new Map<string, ServiceBusSender>();

  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly messageService: MessageService,
  ) {
    this.logger.setContext(ServiceBusService.name);
  }

  async sendMessage(dto: SendServiceBusMessageDto) {
    const queueName = dto.queue ?? this.config.serviceBusQueue;
    const sender = await this.getOrCreateSender(queueName);
    const messageId = dto.messageId ?? randomUUID();
    const body = this.parseBody(dto.body);

    const serviceBusMessage: ServiceBusMessage = {
      body,
      contentType: dto.contentType ?? 'application/json',
      subject: dto.subject,
      messageId,
      applicationProperties: {
        ...(dto.applicationProperties ?? {}),
        sentBy: dto.sentBy ?? 'service-bus-api',
        messageDisposition: dto.messageDisposition ?? 'complete',
      },
    };

    await sender.sendMessages(serviceBusMessage);

    try {
      await this.messageService.createTracking({
        messageId,
        body: typeof body === 'string' ? body : JSON.stringify(body),
        sentBy: dto.sentBy ?? 'service-bus-api',
        sentAt: new Date(),
        status: 'processing', // Mark as processing until worker handles it
        queue: queueName,
        emulatorType: 'azure-service-bus',
        // Don't set disposition until message is processed by worker
      });
      this.logger.log(`Sent Service Bus message ${messageId} to ${queueName} and created tracking entry with status: processing`);
    } catch (error) {
      this.logger.error(`Failed to create tracking entry for message ${messageId} sent to ${queueName}:`, error);
      // Don't throw - message was sent successfully, tracking failure shouldn't block the operation
    }

    this.logger.log(`Sent Service Bus message ${messageId} to ${queueName}`);

    return { queueName, messageId };
  }

  createReceiver(queueName: string = this.config.serviceBusQueue): ServiceBusReceiver {
    return this.client.createReceiver(queueName, {
      receiveMode: 'peekLock',
    });
  }

  async receiveMessage(dto: ReceiveServiceBusMessageDto) {
    let entityName: string;

    // Determine the entity to receive from
    if (dto.queue) {
      // Receiving from a queue
      entityName = dto.queue;
    } else if (dto.topic && dto.subscription) {
      // Receiving from a topic subscription
      entityName = `${dto.topic}/subscriptions/${dto.subscription}`;
    } else {
      // Fallback to default queue
      entityName = this.config.serviceBusQueue;
    }

    const receiver = this.createReceiver(entityName);

    try {
      // Try to receive a message with a timeout
      const messages = await receiver.receiveMessages(1, {
        maxWaitTimeInMs: 5000, // 5 second timeout
      });

      if (messages.length === 0) {
        return {
          success: false,
          message: 'No messages available',
          data: null,
        };
      }

      const message = messages[0];
      const messageId = message.messageId?.toString();

      if (messageId) {
        // Mark message as received in tracking
        await this.messageService.markMessageReceived(messageId, dto.receivedBy);
      }

      // Complete the message
      await receiver.completeMessage(message);

      this.logger.log(`Received Service Bus message ${messageId} from ${entityName} by ${dto.receivedBy}`);

      return {
        success: true,
        message: 'Message received successfully',
        data: {
          queueName: entityName,
          messageId,
          body: typeof message.body === 'string' ? message.body : JSON.stringify(message.body),
        },
      };
    } finally {
      await receiver.close();
    }
  }

  async getMessages() {
    const queueName = this.config.serviceBusQueue;
    const namespace = this.config.serviceBusNamespace;

    const results = {
      dlq: [] as ServiceBusReceivedMessage[],
      abandoned: [] as ServiceBusReceivedMessage[],
      deferred: [] as ServiceBusReceivedMessage[],
      tracking: {
        deadletter: [] as TrackingMessage[],
        abandon: [] as TrackingMessage[],
        defer: [] as TrackingMessage[],
      },
    };

    // Get DLQ messages
    await this.fetchDlqMessages(queueName, results);

    // Get tracking messages
    try {
      const trackingMessages = await this.messageService.findTrackingMessagesByEmulator('azure-service-bus');
      results.tracking.deadletter = trackingMessages.filter(
        (msg) => msg.disposition === 'deadletter' && msg.queue === queueName,
      );
      results.tracking.abandon = trackingMessages.filter(
        (msg) => msg.disposition === 'abandon' && msg.queue === queueName,
      );
      results.tracking.defer = trackingMessages.filter(
        (msg) => msg.disposition === 'defer' && msg.queue === queueName,
      );
    } catch (error) {
      this.logger.error(`Failed to get tracking messages: ${error}`);
    }

    // Get visible messages from main queue
    await this.fetchVisibleMessages(queueName, results);

    // Note: Unlike SQS, we can't easily reconstruct ServiceBusReceivedMessage from tracking data
    // Messages that are in tracking but not visible in the queue will be shown
    // via the trackingMessages section in the response

    return {
      namespace,
      queueName,
      dlqMessages: results.dlq.map((msg) => this.messageToDto(msg)),
      abandonedMessages: results.abandoned.map((msg) => this.messageToDto(msg)),
      deferredMessages: results.deferred.map((msg) => this.messageToDto(msg)),
      trackingMessages: results.tracking,
      summary: {
        dlq: results.dlq.length,
        abandoned: results.abandoned.length,
        deferred: results.deferred.length,
        trackingDeadletter: results.tracking.deadletter.length,
        trackingAbandon: results.tracking.abandon.length,
        trackingDefer: results.tracking.defer.length,
      },
    };
  }

  async ping(): Promise<void> {
    // Service Bus sender is ready to use immediately after creation
    // This ping method verifies we can create a sender without errors
    await this.getOrCreateSender(this.config.serviceBusQueue);
  }

  private parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  private async getOrCreateSender(queueName: string): Promise<ServiceBusSender> {
    const existing = this.senders.get(queueName);
    if (existing) {
      return existing;
    }

    const sender = this.client.createSender(queueName);
    this.senders.set(queueName, sender);
    return sender;
  }

  private async fetchDlqMessages(
    queueName: string,
    results: { dlq: ServiceBusReceivedMessage[] },
  ) {
    try {
      // Create receiver for dead-letter queue
      const dlqReceiver = this.client.createReceiver(queueName, {
        receiveMode: 'peekLock',
        subQueueType: 'deadLetter',
      });

      try {
        // Peek messages from DLQ (peek doesn't lock them)
        const peekedMessages = await dlqReceiver.peekMessages(10);
        if (peekedMessages.length > 0) {
          // Receive them to get full message details
          const receivedMessages = await dlqReceiver.receiveMessages(10, {
            maxWaitTimeInMs: 1000,
          });
          results.dlq = receivedMessages;
          // Abandon them so they stay in DLQ
          for (const msg of receivedMessages) {
            await dlqReceiver.abandonMessage(msg);
          }
        }
      } finally {
        await dlqReceiver.close();
      }
    } catch (error) {
      this.logger.warn(`Failed to get DLQ messages: ${error}`);
    }
  }

  private async fetchVisibleMessages(
    queueName: string,
    results: { dlq: ServiceBusReceivedMessage[]; abandoned: ServiceBusReceivedMessage[]; deferred: ServiceBusReceivedMessage[] },
  ) {
    try {
      const receiver = this.createReceiver(queueName);
      try {
        // Peek messages to see what's available without locking/processing them
        const peekedMessages = await receiver.peekMessages(10);
        
        if (peekedMessages.length > 0) {
          // Receive messages to get full details and check their disposition
          // We'll receive, check, and then abandon/defer/deadletter based on tracking
          const receivedMessages = await receiver.receiveMessages(10, {
            maxWaitTimeInMs: 1000,
          });

          for (const message of receivedMessages) {
            const messageId = message.messageId?.toString();
            if (messageId) {
              const tracking = await this.messageService.findOneTrackingByMessageId(messageId);
              const disposition =
                tracking?.disposition ||
                (message.applicationProperties?.messageDisposition as string)?.toLowerCase();

              if (disposition === 'abandon') {
                results.abandoned.push(message);
                // Abandon to keep it in queue
                await receiver.abandonMessage(message);
              } else if (disposition === 'defer') {
                results.deferred.push(message);
                // Defer to keep it deferred
                await receiver.deferMessage(message);
              } else if (disposition === 'deadletter') {
                results.dlq.push(message);
                // Deadletter to move to DLQ
                await receiver.deadLetterMessage(message);
              } else {
                // No specific disposition or 'complete', abandon to keep it visible
                results.abandoned.push(message);
                await receiver.abandonMessage(message);
              }
            } else {
              // No messageId, abandon to keep it visible
              results.abandoned.push(message);
              await receiver.abandonMessage(message);
            }
          }
        }
      } finally {
        await receiver.close();
      }
    } catch (error) {
      this.logger.error(`Failed to receive messages from queue: ${error}`);
    }
  }


  private messageToDto(message: ServiceBusReceivedMessage) {
    return {
      messageId: message.messageId?.toString(),
      body: typeof message.body === 'string' ? message.body : JSON.stringify(message.body),
      contentType: message.contentType,
      subject: message.subject,
      sessionId: message.sessionId,
      replyTo: message.replyTo,
      timeToLive: message.timeToLive,
      scheduledEnqueueTime: message.scheduledEnqueueTimeUtc,
      applicationProperties: message.applicationProperties,
    };
  }

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.senders.values()).map(async (sender) => sender.close())
    );
    this.senders.clear();
    await this.client.close();
  }
}
