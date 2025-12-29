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
      
      if (!defaultQueue) {
        this.logger.warn('RABBITMQ_QUEUE not configured. Skipping RabbitMQ worker bootstrap.');
        return;
      }

      // Start polling from the default queue
      await this.rabbitmqService.startPolling(defaultQueue);
      
      this.logger.log(`RabbitMQ worker initialized and polling queue: ${defaultQueue}`);
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ worker', error);
    }
  }

  async onModuleDestroy() {
    try {
      // Stop polling for the default queue
      const defaultQueue = this.config.rabbitmqQueue;
      if (defaultQueue) {
        await this.rabbitmqService.stopPolling(defaultQueue);
        this.logger.log(`RabbitMQ worker stopped polling queue: ${defaultQueue}`);
      }
    } catch (error) {
      this.logger.error('Error stopping RabbitMQ worker', error);
    }
  }
}

