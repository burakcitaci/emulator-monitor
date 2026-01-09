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

   return await this.messageService.findTrackingMessagesByEmulator('azure-service-bus');
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

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.senders.values()).map(async (sender) => sender.close())
    );
    this.senders.clear();
    await this.client.close();
  }
}
