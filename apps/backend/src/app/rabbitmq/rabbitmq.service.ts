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
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

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
    // Clear all polling intervals
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();

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

        // Handle message based on disposition
        await this.handleMessageDisposition(
          message,
          messageId,
          disposition,
          queueName,
        );
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
    // Update disposition in tracking
    await this.messageService.updateDisposition(messageId, disposition);

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

  async startPolling(queueName: string): Promise<void> {
    if (this.pollingIntervals.has(queueName)) {
      this.logger.warn(`Polling already active for queue: ${queueName}`);
      return;
    }

    await this.assertQueue(queueName);

    const interval = setInterval(async () => {
      await this.pollAndProcessMessages(queueName);
    }, 5000); // Poll every 5 seconds

    this.pollingIntervals.set(queueName, interval);
    this.logger.log(`Polling interval set up for queue: ${queueName}`);
  }

  async stopPolling(queueName: string): Promise<void> {
    const interval = this.pollingIntervals.get(queueName);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(queueName);
      this.logger.log(`Polling stopped for queue: ${queueName}`);
    }
  }

  private async pollAndProcessMessages(queueName: string): Promise<void> {
    try {
      await this.assertQueue(queueName);

      const message = await this.channel.get(queueName, { noAck: false });
      if (!message) {
        return; // No messages to process
      }

      const messageId =
        message.properties.messageId ||
        message.properties.headers?.['x-message-id'] as string ||
        randomUUID();
      const receivedBy = 'rabbitmq-worker';

      // Check database first for existing disposition (in case message was abandoned and re-queued)
      let messageDisposition: string | undefined;
      let dispositionSource = 'headers';
      const existingMessage = await this.messageService.findOneTrackingByMessageId(messageId);
      if (existingMessage?.disposition) {
        messageDisposition = existingMessage.disposition;
        dispositionSource = 'database';
        this.logger.log(`Found existing disposition ${messageDisposition} in database for message ${messageId}`);
      }
      
      // Fall back to headers if no database disposition found
      if (!messageDisposition) {
        messageDisposition = (message.properties.headers?.['messageDisposition'] as string) || 'complete';
      }

      this.logger.log(
        `Processing RabbitMQ message ${messageId} with disposition: ${messageDisposition} (source: ${dispositionSource})`,
      );

      // Mark message as received
      await this.messageService.markMessageReceived(messageId, receivedBy);
      const dispositionResult = await this.messageService.updateDisposition(
        messageId,
        messageDisposition,
      );
      this.logger.log(
        `Updated RabbitMQ message ${messageId} disposition to ${messageDisposition}, result: ${!!dispositionResult}`,
      );

      // Add random delay before handling disposition (simulate processing)
      await randomDelay();

      // Handle message based on disposition
      await this.handleMessageDisposition(
        message,
        messageId,
        messageDisposition,
        queueName,
      );
    } catch (error) {
      // Log but don't throw - we want polling to continue
      this.logger.error(
        `Error polling messages from queue ${queueName}`,
        error,
      );
    }
  }
}

