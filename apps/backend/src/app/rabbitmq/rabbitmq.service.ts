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
import { MessageProcessor, DispositionActions, MessageDisposition } from '../common/message-processor';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly queueCache = new Set<string>();
  private consumerTags: Map<string, string> = new Map();
  private readonly messageProcessor: MessageProcessor;

  constructor(
    @Inject(RABBITMQ_CONNECTION) private readonly connection: amqp.Connection,
    @Inject(RABBITMQ_CHANNEL) private readonly channel: amqp.Channel,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly messageService: MessageService,
  ) {
    this.logger.setContext(RabbitmqService.name);
    this.messageProcessor = new MessageProcessor(messageService, logger);
  }

  async onModuleInit() {
    try {
      await this.assertQueue(this.config.rabbitmqQueue);
      this.logger.log('RabbitMQ service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ service', error);
    }
  }

  async onModuleDestroy() {
    for (const [queueName, consumerTag] of this.consumerTags.entries()) {
      try {
        await this.channel.cancel(consumerTag);
        this.logger.log(`Cancelled consumer for queue: ${queueName}`);
      } catch (error) {
        this.logger.error(`Error cancelling consumer for queue ${queueName}:`, error);
      }
    }
    this.consumerTags.clear();

    try {
      await this.channel.close();
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
      await this.channel.assertQueue(queueName, { durable: true });
      this.queueCache.add(queueName);
      this.logger.debug(`Queue asserted: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to assert queue: ${queueName}`, error);
      throw new RabbitmqConnectionException(`Failed to assert queue: ${queueName}`);
    }
  }

  private getDeadLetterQueueName(queueName: string): string {
    return `${queueName}.dlq`;
  }

  private async assertDeadLetterQueue(queueName: string): Promise<string> {
    const dlqName = this.getDeadLetterQueueName(queueName);
    if (this.queueCache.has(dlqName)) {
      return dlqName;
    }

    try {
      await this.channel.assertQueue(dlqName, { durable: true });
      this.queueCache.add(dlqName);
      this.logger.debug(`Dead-letter queue asserted: ${dlqName}`);
      return dlqName;
    } catch (error) {
      this.logger.error(`Failed to assert dead-letter queue: ${dlqName}`, error);
      throw new RabbitmqConnectionException(`Failed to assert dead-letter queue: ${dlqName}`);
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
      persistent: true,
      headers: {
        sentBy: dto.sentBy ?? 'rabbitmq-api',
        'x-message-id': messageId,
        ...(dto.headers || {}),
        ...(dto.messageDisposition && { messageDisposition: dto.messageDisposition }),
      },
      ...(dto.expiration && { expiration: dto.expiration.toString() }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
    };

    try {
      const sent = this.channel.sendToQueue(queueName, messageBuffer, options);
      if (!sent) {
        throw new Error('Failed to send message - channel buffer full');
      }

      // Check if tracking already exists for this messageId
      const existingTracking = await this.messageService.findOneTrackingByMessageId(messageId);
      
      if (existingTracking) {
        // Update existing tracking instead of creating a new one
        await this.messageService.updateTrackingByMessageId(messageId, {
          body: typeof body === 'string' ? body : JSON.stringify(body),
          sentBy: dto.sentBy ?? 'rabbitmq-api',
          queue: queueName,
          status: 'processing',
          sentAt: new Date(),
          // Reset disposition-related fields for the new message
          disposition: undefined,
          receivedAt: undefined,
          receivedBy: undefined,
        });
        this.logger.log(`Updated existing tracking for RabbitMQ message ${messageId} in queue ${queueName}`);
      } else {
        // Create new tracking
        await this.messageService.createTracking({
          messageId,
          body: typeof body === 'string' ? body : JSON.stringify(body),
          sentBy: dto.sentBy ?? 'rabbitmq-api',
          queue: queueName,
          receivedBy: undefined,
          emulatorType: 'rabbitmq',
          status: 'processing',
          sentAt: new Date(),
        });
        this.logger.log(`Created new tracking for RabbitMQ message ${messageId} in queue ${queueName}`);
      }

      this.logger.log(`Sent RabbitMQ message ${messageId} to queue ${queueName}`);

      return { queueName, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send message to queue ${queueName}`, error);
      throw new RabbitmqConnectionException(`Failed to send message: ${errorMessage}`);
    }
  }

  async receiveMessage(dto: ReceiveRabbitmqMessageDto) {
    const queueName = dto.queue ?? this.config.rabbitmqQueue;
    await this.assertQueue(queueName);

    try {
      const message = await this.channel.get(queueName, { noAck: false });
      if (!message) {
        return { success: false, message: 'No messages available', data: null };
      }

      const messageId = this.extractMessageId(message);
      const body = message.content.toString();
      const disposition = MessageProcessor.normalizeDisposition(
        message.properties.headers?.['messageDisposition'] as string,
      );

      console.log("DISPOSITION", disposition);
      await this.messageProcessor.processMessage(
        message,
        {
          messageId,
          disposition,
          queueName,
          receivedBy: dto.receivedBy || 'rabbitmq-api',
          emulatorType: 'rabbitmq',
        },
        this.createDispositionActions(queueName),
      );

      return {
        success: true,
        message: 'Message received successfully',
        data: { queueName, messageId, body, properties: message.properties },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to receive message from queue ${queueName}`, error);
      throw new RabbitmqConnectionException(`Failed to receive message: ${errorMessage}`);
    }
  }

  async updateTracking(messageId: string, status: string, disposition: MessageDisposition): Promise<void> {
    await this.messageService.updateTrackingByMessageId(messageId, { status, disposition });
    this.logger.log(`Updated tracking for message ${messageId} to ${status} with disposition ${disposition}`);
  }

  async startConsuming(queueName: string): Promise<void> {
    if (this.consumerTags.has(queueName)) {
      this.logger.warn(`Consumer already active for queue: ${queueName}`);
      return;
    }

    await this.assertQueue(queueName);

    try {
      await this.channel.prefetch(1);

      const { consumerTag } = await this.channel.consume(
        queueName,
        async (message) => {
          if (message) {
            await this.processConsumedMessage(queueName, message);
          }
        },
        { noAck: false },
      );

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
      const messageId = this.extractMessageId(message);

      if (!messageId) {
        this.logger.warn(`No messageId found in message. Rejecting.`);
        this.channel.nack(message, false, false);
        return;
      }

      // Ensure tracking entry exists
      const existingMessage = await this.messageService.findOneTrackingByMessageId(messageId);
      if (!existingMessage) {
        await this.createOrphanedMessageTracking(message, messageId, queueName);
      }

      // Get disposition from DB or headers
      const disposition = this.getDisposition(existingMessage, message);

      await this.messageProcessor.processMessage(
        message,
        {
          messageId,
          disposition,
          queueName,
          receivedBy: 'rabbitmq-worker',
          emulatorType: 'rabbitmq',
        },
        this.createDispositionActions(queueName),
      );
    } catch (error) {
      this.logger.error(`Error processing consumed message from queue ${queueName}`, error);
      try {
        this.channel.nack(message, false, false);
      } catch (nackError) {
        this.logger.error(`Failed to nack message:`, nackError);
      }
    }
  }

  private createDispositionActions(queueName: string): DispositionActions<amqp.GetMessage | amqp.ConsumeMessage> {
    console.log("QUEUE NAME", queueName);
    console.log("CREATE DISPOSITION ACTIONS");
    
    return {
      complete: async (message) => {
        this.channel.ack(message);
      },
      abandon: async (message) => {
        this.channel.nack(message, false, true);
      },
      deadletter: async (message) => {
        try {
          // Assert dead-letter queue exists
          const dlqName = await this.assertDeadLetterQueue(queueName);
          
          // Publish message to dead-letter queue with original properties
          const dlqOptions: amqp.Options.Publish = {
            messageId: message.properties.messageId,
            persistent: true,
            headers: {
              ...message.properties.headers,
              'x-original-queue': queueName,
              'x-dead-letter-reason': 'deadletter-disposition',
            },
            ...(message.properties.expiration && { expiration: message.properties.expiration }),
            ...(message.properties.priority !== undefined && { priority: message.properties.priority }),
          };

          const sent = this.channel.sendToQueue(dlqName, message.content, dlqOptions);
          if (!sent) {
            this.logger.warn(`Failed to send message to dead-letter queue ${dlqName} - channel buffer full`);
          } else {
            this.logger.log(`Message published to dead-letter queue ${dlqName} for queue ${queueName}`);
          }

          // Update tracking to reflect DLQ queue name
          const messageId = this.extractMessageId(message);
          if (messageId) {
            try {
              // Update queue name in tracking document using messageId
              await this.messageService.updateTrackingByMessageId(messageId, { queue: dlqName });
              this.logger.log(`Updated tracking queue to ${dlqName} for dead-lettered message ${messageId}`);
            } catch (error) {
              this.logger.error(`Failed to update tracking for dead-lettered message ${messageId}:`, error);
            }
          }
        } catch (error) {
          this.logger.error(`Failed to dead-letter message:`, error);
        } finally {
          // Always nack the original message (reject without requeue)
          this.channel.nack(message, false, false);
        }
      },
      defer: async (message) => {
        this.channel.nack(message, false, true);
      },
    };
  }

  private extractMessageId(message: amqp.GetMessage | amqp.ConsumeMessage): string {
    const messageIdFromProps = message.properties.messageId;
    const messageIdFromHeaders = message.properties.headers?.['x-message-id'] as string;
    const rawMessageId = messageIdFromProps || messageIdFromHeaders;
    return rawMessageId ? String(rawMessageId).trim() : randomUUID();
  }

  private getDisposition(
    existingMessage: { disposition?: string } | null,
    message: amqp.GetMessage | amqp.ConsumeMessage,
  ): MessageDisposition {
    // Prioritize message headers over database disposition
    // This ensures that if a message is resent with a new disposition,
    // it uses the new value instead of the old one stored in the database
    const headerDisposition = message.properties.headers?.['messageDisposition'] as string;
    if (headerDisposition) {
      return MessageProcessor.normalizeDisposition(headerDisposition);
    }
    if (existingMessage?.disposition) {
      return MessageProcessor.normalizeDisposition(existingMessage.disposition);
    }
    return 'complete';
  }

  private async createOrphanedMessageTracking(
    message: amqp.ConsumeMessage,
    messageId: string,
    queueName: string,
  ): Promise<void> {
    this.logger.warn(`No tracking document found for messageId ${messageId}. Creating tracking entry.`);
    const body = message.content.toString();
    await this.messageService.createTracking({
      messageId,
      body,
      sentBy: (message.properties.headers?.sentBy as string) || 'unknown',
      queue: queueName,
      emulatorType: 'rabbitmq',
      status: 'received',
      sentAt: message.properties.timestamp ? new Date(message.properties.timestamp) : new Date(),
      receivedAt: new Date(),
      receivedBy: 'rabbitmq-worker',
    });
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
      if (!this.connection) throw new Error('RabbitMQ connection is not available');
      if (!this.channel) throw new Error('RabbitMQ channel is not available');
      await this.assertQueue(this.config.rabbitmqQueue);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new RabbitmqConnectionException(`RabbitMQ ping failed: ${errorMessage}`);
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

    // Peek messages from queue
    try {
      const tempMessages: Array<{ message: amqp.GetMessage }> = [];

      for (let i = 0; i < 10; i++) {
        const message = await this.channel.get(queueName, { noAck: false });
        if (!message) break;

        const messageId = this.extractMessageId(message);
        results.queueMessages.push({
          messageId,
          body: message.content.toString(),
          properties: message.properties,
        });
        tempMessages.push({ message });
      }

      // Requeue messages
      for (const { message } of tempMessages) {
        this.channel.nack(message, false, true);
      }
    } catch (error) {
      this.logger.error(`Failed to peek messages from queue ${queueName}:`, error);
    }

    // Get tracking messages
    try {
      const trackingMessages = await this.messageService.findTrackingMessagesByEmulator('rabbitmq');

      results.tracking.processing = trackingMessages.filter(
        (msg) => msg.status === 'processing' && msg.queue === queueName,
      );
      results.tracking.complete = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'complete' && msg.queue === queueName,
      );
      results.tracking.abandon = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'abandon' && msg.queue === queueName,
      );
      results.tracking.deadletter = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'deadletter' && msg.queue === queueName,
      );
      results.tracking.defer = trackingMessages.filter(
        (msg) => msg.status === 'received' && msg.disposition === 'defer' && msg.queue === queueName,
      );
    } catch (error) {
      this.logger.error(`Failed to get tracking messages: ${error}`);
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
  async getMessagesForWorker() {
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

  // Peek messages from queue using checkQueue (non-destructive)
  try {
    const queueInfo = await this.channel.checkQueue(queueName);
    this.logger.log(`Queue ${queueName} has ${queueInfo.messageCount} messages`);

    // Only peek if there are messages
    if (queueInfo.messageCount > 0) {
      const messagesToPeek = Math.min(10, queueInfo.messageCount);
      const tempMessages: Array<amqp.GetMessage> = [];

      // Get messages without auto-ack
      for (let i = 0; i < messagesToPeek; i++) {
        const message = await this.channel.get(queueName, { noAck: false });
        if (!message) break;

        const messageId = this.extractMessageId(message);
        results.queueMessages.push({
          messageId,
          body: message.content.toString(),
          properties: message.properties,
        });
        tempMessages.push(message);
      }

      // Requeue all messages in reverse order to maintain original queue order
      for (let i = tempMessages.length - 1; i >= 0; i--) {
        this.channel.nack(tempMessages[i], false, true);
      }

      // Add a small delay to allow messages to be requeued
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    this.logger.error(`Failed to peek messages from queue ${queueName}:`, error);
  }

  // Get tracking messages
  try {
    const trackingMessages = await this.messageService.findTrackingMessagesByEmulator('rabbitmq');

    results.tracking.processing = trackingMessages.filter(
      (msg) => msg.status === 'processing' && msg.queue === queueName,
    );
    results.tracking.complete = trackingMessages.filter(
      (msg) => msg.status === 'received' && msg.disposition === 'complete' && msg.queue === queueName,
    );
    results.tracking.abandon = trackingMessages.filter(
      (msg) => msg.status === 'received' && msg.disposition === 'abandon' && msg.queue === queueName,
    );
    results.tracking.deadletter = trackingMessages.filter(
      (msg) => msg.status === 'received' && msg.disposition === 'deadletter' && msg.queue === queueName,
    );
    results.tracking.defer = trackingMessages.filter(
      (msg) => msg.status === 'received' && msg.disposition === 'defer' && msg.queue === queueName,
    );
  } catch (error) {
    this.logger.error(`Failed to get tracking messages: ${error}`);
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
