import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { randomUUID } from 'crypto';
import { RABBITMQ_CONNECTION, RABBITMQ_CHANNEL } from './rabbitmq.constants';
import { SendRabbitmqMessageDto } from './dto/send-rabbitmq-message.dto';
import { ReceiveRabbitmqMessageDto } from './dto/receive-rabbitmq-message.dto';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';
import { MessageService } from '../messages/messages.service';
import { RabbitmqConnectionException } from '../common/exceptions';

// Helper function to create a random delay between 0 and 2000ms
const randomDelay = (): Promise<void> => {
  const delayMs = Math.floor(Math.random() * 2000); // 0 to 1999ms
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly queueCache = new Set<string>();
  private consumerTags: Map<string, string> = new Map();

  constructor(
    @Inject(RABBITMQ_CONNECTION) private readonly connection: amqp.Connection,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: amqp.Channel,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly messageService: MessageService,
  ) {
    this.logger.setContext(RabbitmqService.name);
  }

  async onModuleInit() {
    try {
      // Ensure default queue exists
      await this.assertQueue(this.config.rabbitmqQueue);
      this.logger.log('RabbitMQ service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ service', error);
    }
  }

  async onModuleDestroy() {
    // Cancel all consumers
    for (const [queueName, consumerTag] of this.consumerTags.entries()) {
      try {
        await this.channel.cancel(consumerTag);
        this.logger.log(`Cancelled consumer for queue: ${queueName}`);
      } catch (error) {
        this.logger.error(`Error cancelling consumer for queue ${queueName}:`, error);
      }
    }
    this.consumerTags.clear();

    // Close channel and connection
    try {
      await this.channel.close();
      // Connection.close() exists but TypeScript types may not include it
      // Using type assertion since amqplib Connection does have close() method
      const connectionWithClose = this.connection as amqp.Connection & { close(): Promise<void> };
      if (connectionWithClose && typeof connectionWithClose.close === 'function') {
        await connectionWithClose.close();
      }
      this.logger.log('RabbitMQ connections closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connections', error);
    }
  }

  private async assertQueue(queueName: string): Promise<void> {
    if (this.queueCache.has(queueName)) {
      return;
    }

    try {
      await this.channel.assertQueue(queueName, {
        durable: true, // Queue survives broker restart
      });
      this.queueCache.add(queueName);
      this.logger.debug(`Queue asserted: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to assert queue: ${queueName}`, error);
      throw new RabbitmqConnectionException(
        `Failed to assert queue: ${queueName}`,
      );
    }
  }

  async sendMessage(dto: SendRabbitmqMessageDto) {
    const queueName = dto.queue ?? this.config.rabbitmqQueue;
    await this.assertQueue(queueName);

    const messageId = dto.messageId ?? randomUUID();
    const body = this.parseBody(dto.body);

    const messageBuffer = Buffer.from(
      typeof body === 'string' ? body : JSON.stringify(body),
    );

    const options: amqp.Options.Publish = {
      messageId,
      persistent: true, // Message survives broker restart
      headers: {
        sentBy: dto.sentBy ?? 'rabbitmq-api',
        'x-message-id': messageId, // Store in headers as fallback for messageId retrieval
        ...(dto.headers || {}),
        ...(dto.messageDisposition && {
          messageDisposition: dto.messageDisposition,
        }),
      },
      ...(dto.expiration && { expiration: dto.expiration.toString() }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
    };

    try {
      const sent = this.channel.sendToQueue(queueName, messageBuffer, options);
      if (!sent) {
        throw new Error('Failed to send message - channel buffer full');
      }

      // Track message
      await this.messageService.createTracking({
        messageId,
        body: typeof body === 'string' ? body : JSON.stringify(body),
        sentBy: dto.sentBy ?? 'rabbitmq-api',
        queue: queueName,
        emulatorType: 'rabbitmq',
        status: 'processing', // Mark as processing until worker handles it
        sentAt: new Date(),
        // Don't set disposition until message is processed by worker
      });

      this.logger.log(`Sent RabbitMQ message ${messageId} to queue ${queueName}`);

      return {
        queueName,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send message to queue ${queueName}`, error);
      throw new RabbitmqConnectionException(
        `Failed to send message: ${errorMessage}`,
      );
    }
  }

  async receiveMessage(dto: ReceiveRabbitmqMessageDto) {
    const queueName = dto.queue ?? this.config.rabbitmqQueue;
    await this.assertQueue(queueName);

    const maxMessages = dto.maxMessages ?? 1;

    try {
      const messages: Array<{
        messageId: string;
        body: string;
        properties: amqp.Message['properties'];
      }> = [];

      for (let i = 0; i < maxMessages; i++) {
        const message = await this.channel.get(queueName, { noAck: false });
        if (!message) {
          break; // No more messages
        }

        const messageId =
          message.properties.messageId ||
          message.properties.headers?.['x-message-id'] as string ||
          randomUUID();
        const body = message.content.toString();

        messages.push({
          messageId,
          body,
          properties: message.properties,
        });

        // Mark message as received in tracking
        await this.messageService.markMessageReceived(messageId, dto.receivedBy);

        // Extract disposition from headers (default to 'complete')
        const disposition =
          (message.properties.headers?.['messageDisposition'] as string) ||
          'complete';

        this.logger.log(
          `Received RabbitMQ message ${messageId} from ${queueName} by ${dto.receivedBy} with disposition: ${disposition}`,
        );

        // Add random delay before handling disposition (simulate processing)
        await randomDelay();

        // Handle message based on disposition FIRST (this performs the actual RabbitMQ operation)
        await this.handleMessageDisposition(
          message,
          messageId,
          disposition,
          queueName,
        );

        // Update disposition in database AFTER RabbitMQ operation completes
        try {
          await this.messageService.updateDisposition(messageId, disposition, dto.receivedBy);
        } catch (error) {
          this.logger.error(`Exception while updating disposition for message ${messageId}:`, error);
        }
      }

      if (messages.length === 0) {
        return {
          success: false,
          message: 'No messages available',
          data: null,
        };
      }

      return {
        success: true,
        message: 'Message received successfully',
        data: {
          queueName,
          messageId: messages[0].messageId,
          body: messages[0].body,
          properties: messages[0].properties,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to receive message from queue ${queueName}`, error);
      throw new RabbitmqConnectionException(
        `Failed to receive message: ${errorMessage}`,
      );
    }
  }

  private async handleMessageDisposition(
    message: amqp.GetMessage | amqp.ConsumeMessage,
    messageId: string,
    disposition: string,
    queueName: string,
  ): Promise<void> {
    // Perform RabbitMQ operation FIRST, then update database
    // This ensures the actual RabbitMQ state is established before updating tracking
    switch (disposition) {
      case 'complete':
        // Acknowledge message (remove from queue)
        this.channel.ack(message);
        this.logger.log(`Acknowledged message ${messageId} from queue ${queueName}`);
        break;

      case 'abandon':
        // Reject and requeue message
        this.channel.nack(message, false, true);
        this.logger.log(`Rejected and requeued message ${messageId} from queue ${queueName}`);
        break;

      case 'deadletter':
        // Reject without requeue (will go to dead letter queue if configured)
        this.channel.nack(message, false, false);
        this.logger.log(`Rejected message ${messageId} from queue ${queueName} (dead letter)`);
        break;

      case 'defer':
        // For RabbitMQ, defer means reject and requeue with delay
        // In a real scenario, you might use delayed message exchange or TTL
        this.channel.nack(message, false, true);
        this.logger.log(`Deferred message ${messageId} from queue ${queueName}`);
        break;

      default:
        // Default to acknowledge
        this.channel.ack(message);
        this.logger.log(`Acknowledged message ${messageId} from queue ${queueName} (default)`);
    }
  }

  private parseBody(body: string): string | object {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  async ping(): Promise<void> {
    try {
      // Check if connection and channel are available
      if (!this.connection) {
        throw new Error('RabbitMQ connection is not available');
      }
      if (!this.channel) {
        throw new Error('RabbitMQ channel is not available');
      }
      // Assert default queue to verify connectivity
      await this.assertQueue(this.config.rabbitmqQueue);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new RabbitmqConnectionException(
        `RabbitMQ ping failed: ${errorMessage}`,
      );
    }
  }

  async startConsuming(queueName: string): Promise<void> {
    if (this.consumerTags.has(queueName)) {
      this.logger.warn(`Consumer already active for queue: ${queueName}`);
      return;
    }

    await this.assertQueue(queueName);

    try {
      // Set prefetch to 1 to ensure messages are processed one at a time
      await this.channel.prefetch(1);

      const { consumerTag } = await this.channel.consume(queueName, async (message) => {
        if (message) {
          await this.processConsumedMessage(queueName, message);
        }
      }, { noAck: false });

      this.consumerTags.set(queueName, consumerTag);
      this.logger.log(`Consumer started for queue: ${queueName} with tag: ${consumerTag}`);
    } catch (error) {
      this.logger.error(`Failed to start consumer for queue ${queueName}:`, error);
      throw error;
    }
  }

  async stopConsuming(queueName: string): Promise<void> {
    const consumerTag = this.consumerTags.get(queueName);
    if (consumerTag) {
      try {
        await this.channel.cancel(consumerTag);
        this.consumerTags.delete(queueName);
        this.logger.log(`Consumer stopped for queue: ${queueName}`);
      } catch (error) {
        this.logger.error(`Error stopping consumer for queue ${queueName}:`, error);
      }
    }
  }

  private async processConsumedMessage(queueName: string, message: amqp.ConsumeMessage): Promise<void> {
    try {
      // Extract messageId - try multiple sources
      const messageIdFromProps = message.properties.messageId;
      const messageIdFromHeaders = message.properties.headers?.['x-message-id'] as string;
      const rawMessageId = messageIdFromProps || messageIdFromHeaders;
      let messageId = rawMessageId ? String(rawMessageId).trim() : undefined;

      // Log all available properties for debugging
      this.logger.debug(`Consumed message properties: ${JSON.stringify({
        messageId: message.properties.messageId,
        headers: message.properties.headers,
        contentType: message.properties.contentType,
      })}`);

      if (!messageId) {
        this.logger.warn(`No messageId found in message properties or headers. Message properties: ${JSON.stringify(message.properties)}. Rejecting message.`);
        // Nack the message without requeue since we can't track it
        this.channel.nack(message, false, false);
        return;
      }

      const receivedBy = 'rabbitmq-worker';

      this.logger.log(`Consuming RabbitMQ message from queue ${queueName}, extracted messageId: ${messageId} (from ${messageIdFromProps ? 'properties' : 'headers'})`);

      // Check database for existing message and disposition
      let messageDisposition: string | undefined;
      let dispositionSource = 'headers';
      const existingMessage = await this.messageService.findOneTrackingByMessageId(messageId);

      if (!existingMessage) {
        this.logger.warn(`No tracking document found for messageId ${messageId}. This message was likely sent without proper tracking. Creating tracking entry now.`);

        // Create tracking entry for orphaned message
        const body = message.content.toString();
        try {
          await this.messageService.createTracking({
            messageId,
            body,
            sentBy: (message.properties.headers?.sentBy as string) || 'unknown',
            queue: queueName,
            emulatorType: 'rabbitmq',
            status: 'received', // Mark as received since we're processing it now
            sentAt: message.properties.timestamp ? new Date(message.properties.timestamp) : new Date(),
            receivedAt: new Date(),
            receivedBy,
          });
          this.logger.log(`Created tracking entry for orphaned message ${messageId}`);
        } catch (error) {
          this.logger.error(`Failed to create tracking entry for orphaned message ${messageId}:`, error);
          // Reject the message since we can't track it
          this.channel.nack(message, false, false);
          return;
        }
      } else {
        this.logger.log(`Found tracking document for messageId ${messageId}, current status: ${existingMessage.status}, queue: ${existingMessage.queue}`);

        // If message is already received, log it but continue processing
        if (existingMessage.status === 'received') {
          this.logger.log(`Message ${messageId} already marked as received. Processing disposition update.`);
        } else if (existingMessage.status === 'processing') {
          this.logger.log(`Message ${messageId} is in 'processing' status - will update to 'received'`);
        }

        if (existingMessage.disposition) {
          messageDisposition = existingMessage.disposition;
          dispositionSource = 'database';
          this.logger.log(`Found existing disposition ${messageDisposition} in database for message ${messageId}`);
        }
      }

      // Fall back to headers if no database disposition found
      if (!messageDisposition) {
        messageDisposition = (message.properties.headers?.['messageDisposition'] as string) || 'complete';
      }

      this.logger.log(
        `Processing RabbitMQ message ${messageId} with disposition: ${messageDisposition} (source: ${dispositionSource})`,
      );

      // Mark message as received (will update status from 'processing' to 'received')
      // This is safe to call even if status is already 'received' - it will just update receivedAt/receivedBy
      try {
        const markResult = await this.messageService.markMessageReceived(messageId, receivedBy);
        if (!markResult) {
          this.logger.error(`Failed to mark message ${messageId} as received - markMessageReceived returned false/null`);
          // Continue processing anyway - the message disposition is more important
        } else {
          this.logger.log(`Successfully marked message ${messageId} as received`);
        }
      } catch (error) {
        this.logger.error(`Exception while marking message ${messageId} as received:`, error);
        // Continue processing anyway
      }

      // Add random delay before handling disposition (simulate processing)
      await randomDelay();

      // Handle message based on disposition FIRST (this performs the actual RabbitMQ operation)
      // This ensures the RabbitMQ operation completes before updating the database
      await this.handleMessageDisposition(
        message,
        messageId,
        messageDisposition,
        queueName,
      );

      // Update disposition in database AFTER RabbitMQ operation completes
      // This ensures database state reflects the actual RabbitMQ state
      try {
        const dispositionResult = await this.messageService.updateDisposition(
          messageId,
          messageDisposition,
          receivedBy,
        );
        if (!dispositionResult) {
          this.logger.warn(`Failed to update disposition for message ${messageId} - updateDisposition returned false/null`);
        } else {
          this.logger.log(
            `Updated RabbitMQ message ${messageId} disposition to ${messageDisposition} in database`,
          );
        }
      } catch (error) {
        this.logger.error(`Exception while updating disposition for message ${messageId}:`, error);
      }
    } catch (error) {
      // Log error and reject the message
      this.logger.error(
        `Error processing consumed message from queue ${queueName}`,
        error,
      );
      // Reject the message without requeue to prevent infinite loops
      try {
        this.channel.nack(message, false, false);
      } catch (nackError) {
        this.logger.error(`Failed to nack message:`, nackError);
      }
    }
  }

  async getMessages() {
    const queueName = this.config.rabbitmqQueue;
    await this.assertQueue(queueName);

    const results = {
      queueMessages: [] as Array<{
        messageId: string;
        body: string;
        properties: amqp.Message['properties'];
      }>,
      tracking: {
        processing: [] as any[],
        complete: [] as any[],
        abandon: [] as any[],
        deadletter: [] as any[],
        defer: [] as any[],
      },
    };

    // Get messages currently in the queue (peek by getting and requeuing)
    try {
      // Get messages with noAck: false so we can requeue them
      const tempMessages: Array<{ message: amqp.GetMessage; messageId: string; body: string }> = [];
      
      for (let i = 0; i < 10; i++) {
        const message = await this.channel.get(queueName, { noAck: false });
        if (!message) {
          break;
        }

        const messageId =
          message.properties.messageId ||
          message.properties.headers?.['x-message-id'] as string ||
          `unknown-${i}`;
        const body = message.content.toString();

        results.queueMessages.push({
          messageId,
          body,
          properties: message.properties,
        });

        tempMessages.push({ message, messageId, body });
      }

      // Put messages back in queue by nacking with requeue: true
      for (const { message } of tempMessages) {
        this.channel.nack(message, false, true);
      }
    } catch (error) {
      this.logger.error(`Failed to peek messages from queue ${queueName}:`, error);
    }

    // Get messages from tracking database
    try {
      const trackingMessages = await this.messageService.findTrackingMessagesByEmulator('rabbitmq');
      
      // Filter by status and disposition
      // Processing tab: messages that are currently being processed (status === 'processing')
      results.tracking.processing = trackingMessages.filter(
        (msg) => msg.status === 'processing' && msg.queue === queueName
      );
      // Disposition tabs: only show messages that have been received (status === 'received') 
      // and have the appropriate disposition
      results.tracking.complete = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'complete' && msg.queue === queueName
      );
      results.tracking.abandon = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'abandon' && msg.queue === queueName
      );
      results.tracking.deadletter = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'deadletter' && msg.queue === queueName
      );
      results.tracking.defer = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'defer' && msg.queue === queueName
      );
    } catch (error) {
      this.logger.error(`Failed to get tracking messages: ${error}`);
    }

    // Try to reconcile: if a message is in "processing" status but not in queue,
    // it might have been consumed without updating status - try to update it
    const queueMessageIds = new Set(results.queueMessages.map(m => m.messageId));
    for (const processingMsg of results.tracking.processing) {
      if (processingMsg.messageId && !queueMessageIds.has(processingMsg.messageId)) {
        this.logger.warn(
          `Message ${processingMsg.messageId} is in 'processing' status but not found in queue. ` +
          `It may have been consumed without updating status. Attempting to mark as received.`
        );
        // Try to mark it as received since it's not in the queue anymore
        try {
          await this.messageService.markMessageReceived(processingMsg.messageId, 'rabbitmq-worker-reconcile');
          await this.messageService.updateDisposition(processingMsg.messageId, processingMsg.disposition || 'complete');
        } catch (error) {
          this.logger.error(`Failed to reconcile message ${processingMsg.messageId}:`, error);
        }
      }
    }

    return {
      queueName,
      queueMessages: results.queueMessages,
      trackingMessages: results.tracking,
      summary: {
        queue: results.queueMessages.length,
        processing: results.tracking.processing.length,
        complete: results.tracking.complete.length,
        abandon: results.tracking.abandon.length,
        deadletter: results.tracking.deadletter.length,
        defer: results.tracking.defer.length,
      },
    };
  }
}

