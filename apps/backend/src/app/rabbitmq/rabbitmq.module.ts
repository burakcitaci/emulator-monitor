import { Module } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Connection, Channel } from 'amqplib';
import { CommonModule } from '../common/common.module';
import { AppConfigService } from '../common/app-config.service';
import { MessageModule } from '../messages/messages.module';
import { RABBITMQ_CONNECTION, RABBITMQ_CHANNEL } from './rabbitmq.constants';
import { RabbitmqService } from './rabbitmq.service';
import { RabbitmqController } from './rabbitmq.controller';
import { RabbitmqHealthIndicator } from './rabbitmq.health';
import { RabbitmqWorker } from './rabbitmq.worker';

@Module({
  imports: [CommonModule, MessageModule],
  providers: [
    {
      provide: RABBITMQ_CONNECTION,
      inject: [AppConfigService],
      useFactory: async (config: AppConfigService) => {
        try {
          const connection = await amqp.connect(config.rabbitmqConnectionUrl);
          connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err);
          });
          connection.on('close', () => {
            console.log('RabbitMQ connection closed');
          });
          return connection;
        } catch (error) {
          console.error('Failed to create RabbitMQ connection:', error);
          throw error;
        }
      },
    },
    {
      provide: RABBITMQ_CHANNEL,
      inject: [RABBITMQ_CONNECTION],
      useFactory: async (connection: Connection) => {
        try {
          // Connection type from amqplib may not expose createChannel in types, but it exists at runtime
          const channel = await (connection as Connection & { createChannel(): Promise<Channel> }).createChannel();
          channel.on('error', (err: Error) => {
            console.error('RabbitMQ channel error:', err);
          });
          channel.on('close', () => {
            console.log('RabbitMQ channel closed');
          });
          return channel;
        } catch (error) {
          console.error('Failed to create RabbitMQ channel:', error);
          throw error;
        }
      },
    },
    RabbitmqService,
    RabbitmqWorker,
    RabbitmqHealthIndicator,
  ],
  controllers: [RabbitmqController],
  exports: [RabbitmqService, RabbitmqHealthIndicator],
})
export class RabbitmqModule {}

