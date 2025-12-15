import {
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  ServiceBusClient,
  ServiceBusMessage,
  ServiceBusReceiver,
  ServiceBusSender,
} from '@azure/service-bus';
import { randomUUID } from 'crypto';
import { SERVICE_BUS_CLIENT } from './service-bus.constants';
import { SendServiceBusMessageDto } from './dto/send-service-bus-message.dto';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';
import { MessageService } from '../messages/messages.service';

@Injectable()
export class ServiceBusService implements OnModuleDestroy {
  private readonly senders = new Map<string, ServiceBusSender>();

  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly messageService: MessageService,
  ) {
    this.logger.setContext(ServiceBusService.name);
  }

  async sendMessage(dto: SendServiceBusMessageDto) {
    const queueName = dto.queue ?? this.config.serviceBusQueue;
    const sender = await this.getOrCreateSender(queueName);
    const messageId = dto.messageId ?? randomUUID();
    const body = this.parseBody(dto.body);

    const serviceBusMessage: ServiceBusMessage = {
      body,
      contentType: dto.contentType ?? 'application/json',
      subject: dto.subject,
      messageId,
      applicationProperties: {
        ...(dto.applicationProperties ?? {}),
        sentBy: dto.sentBy ?? 'service-bus-api',
      },
    };

    await sender.sendMessages(serviceBusMessage);

    await this.messageService.createTracking({
      messageId,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      sentBy: dto.sentBy ?? 'service-bus-api',
      sentAt: new Date(),
      status: 'sent',
    });

    this.logger.log(`Sent Service Bus message ${messageId} to ${queueName}`);

    return { queueName, messageId };
  }

  createReceiver(queueName: string = this.config.serviceBusQueue): ServiceBusReceiver {
    return this.client.createReceiver(queueName, {
      receiveMode: 'peekLock',
    });
  }

  async ping(): Promise<void> {
    // Service Bus sender is ready to use immediately after creation
    // This ping method verifies we can create a sender without errors
    await this.getOrCreateSender(this.config.serviceBusQueue);
  }

  private parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  private async getOrCreateSender(queueName: string): Promise<ServiceBusSender> {
    const existing = this.senders.get(queueName);
    if (existing) {
      return existing;
    }

    const sender = this.client.createSender(queueName);
    this.senders.set(queueName, sender);
    return sender;
  }

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.senders.values()).map(async (sender) => sender.close())
    );
    this.senders.clear();
    await this.client.close();
  }
}
