import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq.service';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';
import { Cron } from '@nestjs/schedule';
import { MessageProcessor } from '../common/message-processor';

@Injectable()
export class RabbitmqWorker implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(RabbitmqWorker.name);
  }

  async onModuleInit() {
    const defaultQueue = this.config.rabbitmqQueue;

    if (!defaultQueue) {
      this.logger.warn('RABBITMQ_QUEUE not configured. Skipping RabbitMQ worker bootstrap.');
      return;
    }

    try {
      await this.rabbitmqService.startConsuming(defaultQueue);
      this.logger.log(`RabbitMQ worker initialized and polling queue: ${defaultQueue}`);
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ worker', error);
      throw error;
    }
  }

  @Cron('*/10 * * * * *')
  async handleEvery10Seconds() {
    this.logger.log('Executing scheduled task - runs every 10 seconds');
    
    try {
      // Add your business logic here
      await this.performTask();
    } catch (error) {
      this.logger.error('Error executing scheduled task', error);
    }
  }

  async performTask() {
    const messages = await this.rabbitmqService.getMessages();
    console.log( "MESSAGES", JSON.stringify(messages, null, 2));
    // for (const message of messages.queueMessages) {
    //   console.log( "MESSAGE", message);
    //   console.log( "MESSAGE DISPOSITION", MessageProcessor.normalizeDisposition(message.properties.headers?.['messageDisposition'] as string));
    //   await this.rabbitmqService.updateTracking(message.messageId, 'received', 
    //     MessageProcessor.normalizeDisposition(message.properties.headers?.['messageDisposition'] as string) || 'complete');
    //   await MessageProcessor.randomDelay();
    //   console.log( "MESSAGE UPDATED", message);
    // }
  }
  async onModuleDestroy() {
    const defaultQueue = this.config.rabbitmqQueue;

    if (defaultQueue) {
      try {
        await this.rabbitmqService.stopConsuming(defaultQueue);
        this.logger.log(`RabbitMQ worker stopped consuming queue: ${defaultQueue}`);
      } catch (error) {
        this.logger.error('Error stopping RabbitMQ worker', error);
      }
    }
  }
}
