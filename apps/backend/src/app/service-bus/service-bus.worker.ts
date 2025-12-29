import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  MessageHandlers,
  ProcessErrorArgs,
  ServiceBusReceiver,
} from '@azure/service-bus';
import { ServiceBusService } from './service-bus.service';
import { MessageService } from '../messages/messages.service';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';

@Injectable()
export class ServiceBusWorker implements OnModuleInit, OnModuleDestroy {
  private receivers: Map<string, ServiceBusReceiver> = new Map();
  private subscriptions: Map<string, { close(): Promise<void> }> = new Map();

  constructor(
    private readonly serviceBusService: ServiceBusService,
    private readonly messageService: MessageService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(ServiceBusWorker.name);
  }

  async onModuleInit() {
    try {
      // Get all queues from Service Bus configuration
      const serviceBusConfig = this.config.getServiceBusConfiguration();
      const queues: string[] = [];

      if (serviceBusConfig?.UserConfig?.Namespaces) {
        serviceBusConfig.UserConfig.Namespaces.forEach((namespace) => {
          if (namespace.Queues) {
            namespace.Queues.forEach((q) => {
              queues.push(q.Name);
            });
          }
        });
      }

      // Fallback to default queue if no queues found in config
      if (queues.length === 0) {
        const defaultQueue = this.config.serviceBusQueue;
        if (defaultQueue) {
          queues.push(defaultQueue);
          this.logger.warn('No queues found in config, using default queue from SERVICE_BUS_QUEUE');
        } else {
          this.logger.warn('SERVICE_BUS_QUEUE not configured and no queues found in config. Skipping processor bootstrap.');
          return;
        }
      }

      // Subscribe to all queues
      for (const queueName of queues) {
        try {
          const receiver = this.serviceBusService.createReceiver(queueName);
          this.receivers.set(queueName, receiver);

          // Create handlers for each queue with receiver reference
          const handlers: MessageHandlers = {
            processMessage: async (message) => {
              const messageId = message.messageId?.toString();
              const receivedBy = (message.applicationProperties?.['receivedBy'] as string) ?? 'service-bus-worker';

              if (messageId) {
                await this.messageService.markMessageReceived(messageId, receivedBy);
              }

              // Complete the message using the receiver that processed it
              await receiver.completeMessage(message);
            },
            processError: async (args: ProcessErrorArgs) => {
              this.logger.error(`Service Bus processor error for queue ${queueName}:`, args.error);
            },
          };

          const subscription = receiver.subscribe(handlers, {
            autoCompleteMessages: false,
            maxConcurrentCalls: 5,
          });

          this.subscriptions.set(queueName, subscription);
          this.logger.log(`Service Bus subscription started for queue ${queueName}`);
        } catch (error) {
          this.logger.error(`Failed to subscribe to queue ${queueName}:`, error);
        }
      }

      this.logger.log(`Service Bus subscriptions started for ${queues.length} queue(s): ${queues.join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to initialize Service Bus worker:', error);
    }
  }

  async onModuleDestroy() {
    // Close all subscriptions
    await Promise.all(
      Array.from(this.subscriptions.values()).map(async (subscription) => {
        try {
          await subscription.close();
        } catch (error) {
          this.logger.error('Error closing subscription:', error);
        }
      })
    );

    // Close all receivers
    await Promise.all(
      Array.from(this.receivers.values()).map(async (receiver) => {
        try {
          await receiver.close();
        } catch (error) {
          this.logger.error('Error closing receiver:', error);
        }
      })
    );

    this.receivers.clear();
    this.subscriptions.clear();
    this.logger.log('Service Bus subscriptions stopped.');
  }
}
