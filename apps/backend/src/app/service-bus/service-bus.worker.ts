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
  private receiver?: ServiceBusReceiver;
  private subscription?: { close(): Promise<void> };

  constructor(
    private readonly serviceBusService: ServiceBusService,
    private readonly messageService: MessageService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(ServiceBusWorker.name);
  }

  async onModuleInit() {
    const queue = this.config.serviceBusQueue;
    if (!queue) {
      this.logger.warn('SERVICE_BUS_QUEUE not configured. Skipping processor bootstrap.');
      return;
    }

    this.receiver = this.serviceBusService.createReceiver(queue);

    const handlers: MessageHandlers = {
      processMessage: async (message) => {
        const messageId = message.messageId?.toString();
        const receivedBy = (message.applicationProperties?.['receivedBy'] as string) ?? 'service-bus-worker';

        if (messageId) {
          await this.messageService.markMessageReceived(messageId, receivedBy);
        }

        await this.receiver?.completeMessage(message);
      },
      processError: async (args: ProcessErrorArgs) => {
        this.logger.error('Service Bus processor error', args.error);
      },
    };

    this.subscription = this.receiver.subscribe(handlers, {
      autoCompleteMessages: false,
      maxConcurrentCalls: 5,
    });

    this.logger.log(`Service Bus subscription started for queue ${queue}`);
  }

  async onModuleDestroy() {
    await this.subscription?.close();
    await this.receiver?.close();
    this.logger.log('Service Bus subscription stopped.');
  }
}
