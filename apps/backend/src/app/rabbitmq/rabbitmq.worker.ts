import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from './rabbitmq.service';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';

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
    try {
      // Get default queue from config
      const defaultQueue = this.config.rabbitmqQueue;
      this.logger.log(`RabbitMQ worker initializing with queue: ${defaultQueue}`);

      if (!defaultQueue) {
        this.logger.warn('RABBITMQ_QUEUE not configured. Skipping RabbitMQ worker bootstrap.');
        return;
      }

      // Start consuming from the default queue
      await this.rabbitmqService.startConsuming(defaultQueue);

      this.logger.log(`RabbitMQ worker initialized and polling queue: ${defaultQueue}`);
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ worker', error);
      throw error; // Re-throw to prevent silent failures
    }
  }

  async onModuleDestroy() {
    try {
      // Stop consuming from the default queue
      const defaultQueue = this.config.rabbitmqQueue;
      if (defaultQueue) {
        await this.rabbitmqService.stopConsuming(defaultQueue);
        this.logger.log(`RabbitMQ worker stopped consuming queue: ${defaultQueue}`);
      }
    } catch (error) {
      this.logger.error('Error stopping RabbitMQ worker', error);
    }
  }
}

