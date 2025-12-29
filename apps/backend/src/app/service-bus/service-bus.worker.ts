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

// Helper function to create a random delay between 0 and 2000ms
const randomDelay = (): Promise<void> => {
  const delayMs = Math.floor(Math.random() * 2000); // 0 to 1999ms
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

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
      // Get all queues and topic subscriptions from Service Bus configuration
      const serviceBusConfig = this.config.getServiceBusConfiguration();
      const queues: string[] = [];
      const topicSubscriptions: Array<{ topic: string; subscription: string; entityName: string }> = [];

      if (serviceBusConfig?.UserConfig?.Namespaces) {
        serviceBusConfig.UserConfig.Namespaces.forEach((namespace) => {
          // Collect queues
          if (namespace.Queues) {
            namespace.Queues.forEach((q) => {
              queues.push(q.Name);
            });
          }

          // Collect topic subscriptions
          if (namespace.Topics) {
            namespace.Topics.forEach((topic) => {
              if (topic.Subscriptions) {
                topic.Subscriptions.forEach((sub) => {
                  const entityName = `${topic.Name}/subscriptions/${sub.Name}`;
                  topicSubscriptions.push({
                    topic: topic.Name,
                    subscription: sub.Name,
                    entityName,
                  });
                });
              }
            });
          }
        });
      }

      // Fallback to default queue if no queues found in config
      if (queues.length === 0 && topicSubscriptions.length === 0) {
        const defaultQueue = this.config.serviceBusQueue;
        if (defaultQueue) {
          queues.push(defaultQueue);
          this.logger.warn('No queues or topics found in config, using default queue from SERVICE_BUS_QUEUE');
        } else {
          this.logger.warn('SERVICE_BUS_QUEUE not configured and no queues/topics found in config. Skipping processor bootstrap.');
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

              // Add random delay (0-2 seconds) before completing the message
              await randomDelay();

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

      // Subscribe to all topic subscriptions
      for (const { topic, subscription, entityName } of topicSubscriptions) {
        try {
          const receiver = this.serviceBusService.createReceiver(entityName);
          this.receivers.set(entityName, receiver);

          // Create handlers for each topic subscription with receiver reference
          const handlers: MessageHandlers = {
            processMessage: async (message) => {
              const messageId = message.messageId?.toString();
              const receivedBy = (message.applicationProperties?.['receivedBy'] as string) ?? 'service-bus-worker';

              if (messageId) {
                try {
                  const updated = await this.messageService.markMessageReceived(messageId, receivedBy);
                  if (!updated) {
                    this.logger.warn(`Message ${messageId} received from topic ${topic}/subscription ${subscription} but no tracking entry found`);
                  } else {
                    this.logger.log(`Message ${messageId} received from topic ${topic}/subscription ${subscription} and marked as received`);
                  }
                } catch (error) {
                  this.logger.error(`Failed to mark message ${messageId} as received from topic ${topic}/subscription ${subscription}:`, error);
                }
              } else {
                this.logger.warn(`Received message without messageId from topic ${topic}/subscription ${subscription}`);
              }

              // Add random delay (0-2 seconds) before completing the message
              await randomDelay();

              // Complete the message using the receiver that processed it
              await receiver.completeMessage(message);
            },
            processError: async (args: ProcessErrorArgs) => {
              this.logger.error(`Service Bus processor error for topic ${topic}/subscription ${subscription}:`, args.error);
            },
          };

          const subscriptionHandle = receiver.subscribe(handlers, {
            autoCompleteMessages: false,
            maxConcurrentCalls: 5,
          });

          this.subscriptions.set(entityName, subscriptionHandle);
          this.logger.log(`Service Bus subscription started for topic ${topic}, subscription ${subscription}`);
        } catch (error) {
          this.logger.error(`Failed to subscribe to topic ${topic}, subscription ${subscription}:`, error);
        }
      }

      const totalSubscriptions = queues.length + topicSubscriptions.length;
      const queueList = queues.length > 0 ? `queue(s): ${queues.join(', ')}` : '';
      const topicList = topicSubscriptions.length > 0
        ? `topic subscription(s): ${topicSubscriptions.map((ts) => `${ts.topic}/${ts.subscription}`).join(', ')}`
        : '';
      const subscriptionList = [queueList, topicList].filter(Boolean).join('; ');

      this.logger.log(`Service Bus subscriptions started for ${totalSubscriptions} entity(ies): ${subscriptionList}`);
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
