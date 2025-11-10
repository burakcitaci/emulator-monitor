/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusMessage,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import {
  SendMessageDto,
  SendBatchDto,
  InitializeResponse,
  GetNamespacesResponse,
  SendMessageResponse,
  SendBatchResponse,
  ServiceBusConfig,
  DeadLetterMessageResponse,
} from '@e2e-monitor/entities';

import { ConfigService } from '../common/config.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IServiceBusMessageDocument, MessageState } from '../common/servicebus.message.schema';
import Long from 'long';
import { Cron, CronExpression } from '@nestjs/schedule';

// Constants
const PEEK_BATCH_SIZE = 200;
const MAX_PEEK_MESSAGES = 5000;
const COMPLETION_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds
const MESSAGE_TTL_DEFAULT_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class ServiceBusService implements OnModuleDestroy, OnModuleInit {
  private readonly clients: Map<string, ServiceBusClient> = new Map();
  private readonly senders: Map<string, ServiceBusSender> = new Map();
  private readonly receivers: Map<string, ServiceBusReceiver> = new Map(); // 👈 New Map for receivers
  private config: ServiceBusConfig | null = null;
  private readonly serviceBusClient: ServiceBusClient;
  constructor(
    private readonly configService: ConfigService,
    @InjectModel('ServiceBusMessage') private readonly serviceBusMessageModel: Model<IServiceBusMessageDocument>
  ) {
     this.serviceBusClient = new ServiceBusClient(
          this.configService.serviceBusConnectionString
    );
  }

  /**
   * Initialize Service Bus with configuration
   */
  async initialize(
    config: ServiceBusConfig,
    connectionString: string
  ): Promise<InitializeResponse> {
    // Close existing connections before reinitializing
    await this.cleanup();

    this.config = config;

    // Create senders for all configured topics and queues
    for (const ns of config.UserConfig.Namespaces) {
      for (const topic of ns.Topics ?? []) {
        const senderKey = `${ns.Name}:${topic.Name}`;
        const sender = this.serviceBusClient.createSender(topic.Name);
        this.senders.set(senderKey, sender);
      }
      for (const queue of ns.Queues ?? []) {
        const senderKey = `${ns.Name}:${queue.Name}`;
        const sender = this.serviceBusClient.createSender(queue.Name);
        this.senders.set(senderKey, sender);
      }
    }

    return {
      success: true,
      message: 'Service Bus initialized successfully',
      namespaces: config.UserConfig.Namespaces.map((ns) => ({
        name: ns.Name,
        topics: (ns.Topics ?? []).map((t) => t.Name),
        queues: (ns.Queues ?? []).map((q) => q.Name),
      })),
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ServiceBusConfig | null {
    return this.config;
  }

  /**
   * Get all namespaces and topics
   */
  getNamespacesAndTopics(): GetNamespacesResponse {
    if (!this.config) {
      return {
        success: false,
        message: 'Service Bus not initialized',
        namespaces: [],
      };
    }

    return {
      success: true,
      namespaces: this.config.UserConfig.Namespaces.map((ns) => ({
        name: ns.Name,
        topics: (ns.Topics ?? []).map((topic) => ({
          name: topic.Name,
          properties: topic.Properties,
          subscriptions: (topic.Subscriptions ?? []).map((sub) => ({
            name: sub.Name,
            deadLetteringOnMessageExpiration:
              sub.DeadLetteringOnMessageExpiration,
            maxDeliveryCount: sub.MaxDeliveryCount,
          })),
        })),
        queues: (ns.Queues ?? []).map((queue) => ({
          name: queue.Name,
          properties: queue.Properties,
        })),
      })),
    };
  }

  /**
   * Send a message to a topic
   */
  async sendMessage(dto: SendMessageDto): Promise<SendMessageResponse> {
    const senderKey = `${dto.namespace}:${dto.topic}`;
    const sender = this.senders.get(senderKey);

    if (!sender) {
      console.error(`Sender not found! Looking for: ${senderKey}`);
      console.error(
        `Available senders: ${Array.from(this.senders.keys()).join(', ')}`
      );
      throw new Error(
        `No sender found for namespace: ${dto.namespace}, topic: ${dto.topic}. Make sure Service Bus is initialized.`
      );
    }

    try {
      const message: ServiceBusMessage = {
        body: dto.message.body,
        contentType: dto.message.contentType || 'application/json',
        messageId: dto.message.messageId,
        correlationId: dto.message.correlationId,
        subject: dto.message.subject,
        applicationProperties: dto.message.applicationProperties || {},
      };

      // Send the message
      await sender.sendMessages(message);

      await this.serviceBusMessageModel.create(message);
    
     /*  // Persist the sent message
      const sentMessage: Partial<SentMessage> = {
        messageId: message.messageId ? String(message.messageId) : undefined,
        body: dto.message.body,
        applicationProperties: dto.message.applicationProperties || {},
        contentType: dto.message.contentType || 'application/json',
        subject: dto.message.subject,
        correlationId: dto.message.correlationId,
        sentViaUI: true, // This is sent via UI
        sentBy: dto.message.sentBy,
        sentAt: dto.message.sentAt || new Date(),
        state: SentMessageState.SENT,
      };

      await this.sentMessageModel.create(sentMessage); */

      return {
        success: true,
        message: 'Message sent successfully',
        messageId: message.messageId ? String(message.messageId) : undefined,
        namespace: dto.namespace,
        topic: dto.topic,
      };
    } catch (error: any) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async monitorMessages(): Promise<void> {
    const startTime = Date.now();
    console.log('[MonitorMessages] ========== Starting monitoring cycle ==========');

    const config = this.configService.getServiceBusConfiguration();
    const queues = config.UserConfig.Namespaces.flatMap(
      (ns) => ns.Queues || []
    );
    const topics = config.UserConfig.Namespaces.flatMap(
      (ns) => ns.Topics || []
    );

    if (queues.length === 0 && topics.length === 0) {
      console.log('[MonitorMessages] No queues or topics configured, skipping monitoring');
      return;
    }

    if (!this.serviceBusClient) {
      console.log('[MonitorMessages] Service Bus client not available, skipping monitoring');
      return;
    }

    console.log(`[MonitorMessages] Monitoring ${queues.length} queues and ${topics.length} topics`);

    // Monitor all queues
    for (const queue of queues) {
      await this.monitorDeadLetterQueue(queue.Name);
      await this.monitorQueue(queue.Name, queue.Properties);
    }

    // Monitor all topic subscriptions
    for (const topic of topics) {
      for (const subscription of topic.Subscriptions || []) {
        await this.monitorTopicDeadLetterQueue(topic.Name, subscription.Name);
        await this.monitorTopicSubscription(
          topic.Name,
          subscription.Name,
          topic.Properties,
          subscription
        );
      }
    }

    // Clean up old messages after monitoring
    await this.cleanupOldMessages();

    const duration = Date.now() - startTime;
    console.log(`[MonitorMessages] ========== Monitoring cycle completed in ${duration}ms ==========`);
  }

  /**
   * Cleanup connections
   */
  private async cleanup() {
    // Close all senders
    for (const [key, sender] of this.senders.entries()) {
      try {
        await sender.close();
      } catch (error) {
        console.error(`Error closing sender ${key}:`, error);
      }
    }

    // Close all DLQ receivers 👈 New cleanup
    for (const [key, receiver] of this.receivers.entries()) {
      try {
        await receiver.close();
      } catch (error) {
        console.error(`Error closing receiver ${key}:`, error);
      }
    }

    for (const [key, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing client ${key}:`, error);
      }
    }

    this.senders.clear();
    this.receivers.clear(); // 👈 Clear new map
    this.clients.clear();
  }

  /**
   * Monitor a specific queue
   */
  private async monitorQueue(queueName: string, properties?: { MaxDeliveryCount?: number; DefaultMessageTimeToLive?: string }): Promise<void> {
    let receiver: ServiceBusReceiver | null = null;

    try {
      receiver = this.serviceBusClient.createReceiver(queueName);

      const maxDeliveryCount = properties?.MaxDeliveryCount || 10;
      const timeToLiveMs = properties?.DefaultMessageTimeToLive ? this.parseISO8601Duration(properties.DefaultMessageTimeToLive) : MESSAGE_TTL_DEFAULT_MS;
      console.log(`[MonitorQueue] Monitoring queue: ${queueName} (MaxDeliveryCount: ${maxDeliveryCount}, TTL: ${timeToLiveMs}ms)`);

      // Collect all current message IDs using improved pagination
      const currentIds = await this.collectCurrentIds(receiver);

      if (currentIds.length > 0) {
        console.log(`[MonitorQueue] Found ${currentIds.length} messages in ${queueName}`);
      }

      // Get detailed information for messages (peek in batches)
      const messages = await this.peekAllMessages(receiver);

      // Update or insert messages in database
      if (messages.length > 0) {
        for (const msg of messages) {
          const messageState = this.mapServiceBusState(msg.state);

          // Extract additional properties from message body if present
          const bodyObj = typeof msg.body === 'object' && msg.body !== null ? msg.body as any : {};
          const sentBy = bodyObj.sentBy;
          const recievedBy = bodyObj.recievedBy;
          const sentAt = bodyObj.sentAt ? new Date(bodyObj.sentAt) : undefined;
          const recievedAt = bodyObj.recievedAt ? new Date(bodyObj.recievedAt) : undefined;

          await this.serviceBusMessageModel.updateOne(
            { messageId: msg.messageId },
            {
              $set: {
                body: msg.body,
                queue: queueName,
                state: messageState,
                applicationProperties: msg.applicationProperties || undefined,
                sequenceNumber: msg.sequenceNumber?.toNumber(),
                enqueuedTimeUtc: msg.enqueuedTimeUtc,
                deliveryCount: msg.deliveryCount,
                maxDeliveryCount: maxDeliveryCount,
                timeToLive: timeToLiveMs,
                lastUpdated: new Date(),
                lastSeenAt: new Date(),
                ...(sentBy && { sentBy }),
                ...(recievedBy && { recievedBy }),
                ...(sentAt && { sentAt }),
                ...(recievedAt && { recievedAt }),
              },
            },
            { upsert: true }
          );
        }
        console.log(`[MonitorQueue] Updated ${messages.length} messages in ${queueName}`);
      }

      // Mark messages as completed with grace period
      await this.markCompletedMessages(queueName, currentIds);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MonitorQueue] Error monitoring queue ${queueName}:`, errorMessage);
    } finally {
      if (receiver) {
        try {
          await receiver.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[MonitorQueue] Error closing receiver for ${queueName}:`, errorMessage);
        }
      }
    }
  }

  /**
   * Monitor dead letter queue for a specific queue
   */
  private async monitorDeadLetterQueue(queueName: string): Promise<void> {
    const deadLetterPath = `${queueName}/$DeadLetterQueue`;
    let dlqReceiver: ServiceBusReceiver | null = null;

    try {
      dlqReceiver = this.serviceBusClient.createReceiver(deadLetterPath);

      const dlqMessages = await this.peekAllMessages(dlqReceiver);

      if (dlqMessages.length > 0) {
        console.log(`[MonitorDLQ] Found ${dlqMessages.length} dead-lettered messages in ${deadLetterPath}`);

        for (const msg of dlqMessages) {
          // Determine the correct state based on dead letter reason
          const state = this.getDeadLetterState(msg.deadLetterReason);

          // Extract additional properties from message body if present
          const bodyObj = typeof msg.body === 'object' && msg.body !== null ? msg.body as any : {};
          const sentBy = bodyObj.sentBy;
          const recievedBy = bodyObj.recievedBy;
          const sentAt = bodyObj.sentAt ? new Date(bodyObj.sentAt) : undefined;
          const recievedAt = bodyObj.recievedAt ? new Date(bodyObj.recievedAt) : undefined;

          await this.serviceBusMessageModel.updateOne(
            { messageId: msg.messageId },
            {
              $set: {
                body: msg.body,
                queue: queueName,
                state: state,
                applicationProperties: msg.applicationProperties || undefined,
                sequenceNumber: msg.sequenceNumber?.toNumber(),
                enqueuedTimeUtc: msg.enqueuedTimeUtc,
                deliveryCount: msg.deliveryCount,
                deadLetteredAt: new Date(),
                deadLetterReason: msg.deadLetterReason,
                deadLetterErrorDescription: msg.deadLetterErrorDescription,
                lastUpdated: new Date(),
                ...(sentBy && { sentBy }),
                ...(recievedBy && { recievedBy }),
                ...(sentAt && { sentAt }),
                ...(recievedAt && { recievedAt }),
              },
            },
            { upsert: true }
          );
        }

        // Log summary
        const abandonedCount = dlqMessages.filter(m => m.deadLetterReason === 'MaxDeliveryCountExceeded').length;
        const otherDlqCount = dlqMessages.length - abandonedCount;

        if (abandonedCount > 0) {
          console.log(`[MonitorDLQ] ${abandonedCount} abandoned messages (MaxDeliveryCountExceeded) in ${deadLetterPath}`);
        }
        if (otherDlqCount > 0) {
          console.log(`[MonitorDLQ] ${otherDlqCount} dead-lettered messages (other reasons) in ${deadLetterPath}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('NotFound') && !errorMessage.includes('does not exist')) {
        console.error(`[MonitorDLQ] Error monitoring ${deadLetterPath}:`, errorMessage);
      }
    } finally {
      if (dlqReceiver) {
        try {
          await dlqReceiver.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[MonitorDLQ] Error closing DLQ receiver for ${deadLetterPath}:`, errorMessage);
        }
      }
    }
  }

  /**
   * Monitor a topic subscription
   */
  private async monitorTopicSubscription(
    topicName: string,
    subscriptionName: string,
    topicProperties?: { DefaultMessageTimeToLive?: string },
    subscriptionProperties?: { MaxDeliveryCount?: number; DeadLetteringOnMessageExpiration?: boolean }
  ): Promise<void> {
    const receiverPath = `${topicName}/Subscriptions/${subscriptionName}`;
    const storagePath = `${topicName}/${subscriptionName}`;
    let receiver: ServiceBusReceiver | null = null;

    try {
      receiver = this.serviceBusClient.createReceiver(receiverPath);

      const maxDeliveryCount = subscriptionProperties?.MaxDeliveryCount || 10;
      const deadLetterOnExpiration = subscriptionProperties?.DeadLetteringOnMessageExpiration || false;
      const timeToLiveMs = topicProperties?.DefaultMessageTimeToLive ? this.parseISO8601Duration(topicProperties.DefaultMessageTimeToLive) : MESSAGE_TTL_DEFAULT_MS;

      console.log(
        `[MonitorTopic] Monitoring: ${receiverPath} → storing as: ${storagePath} ` +
        `(MaxDeliveryCount: ${maxDeliveryCount}, DLQ on expiration: ${deadLetterOnExpiration}, TTL: ${timeToLiveMs}ms)`
      );

      const currentIds = await this.collectCurrentIds(receiver);

      if (currentIds.length > 0) {
        console.log(`[MonitorTopic] Found ${currentIds.length} messages in ${storagePath}`);
      }

      const messages = await this.peekAllMessages(receiver);

      if (messages.length > 0) {
        for (const msg of messages) {
          const messageState = this.mapServiceBusState(msg.state);

          // Extract additional properties from message body if present
          const bodyObj = typeof msg.body === 'object' && msg.body !== null ? msg.body as any : {};
          const sentBy = bodyObj.sentBy;
          const recievedBy = bodyObj.recievedBy;
          const sentAt = bodyObj.sentAt ? new Date(bodyObj.sentAt) : undefined;
          const recievedAt = bodyObj.recievedAt ? new Date(bodyObj.recievedAt) : undefined;

          await this.serviceBusMessageModel.updateOne(
            { messageId: msg.messageId },
            {
              $set: {
                body: msg.body,
                queue: storagePath,
                topic: topicName,
                subscription: subscriptionName,
                state: messageState,
                applicationProperties: msg.applicationProperties || undefined,
                sequenceNumber: msg.sequenceNumber?.toNumber(),
                enqueuedTimeUtc: msg.enqueuedTimeUtc,
                deliveryCount: msg.deliveryCount,
                maxDeliveryCount: maxDeliveryCount,
                timeToLive: timeToLiveMs,
                lastUpdated: new Date(),
                lastSeenAt: new Date(),
                ...(sentBy && { sentBy }),
                ...(recievedBy && { recievedBy }),
                ...(sentAt && { sentAt }),
                ...(recievedAt && { recievedAt }),
              },
            },
            { upsert: true }
          );
        }
        console.log(`[MonitorTopic] Updated ${messages.length} messages in ${storagePath}`);
      }

      // Mark messages as completed with grace period
      await this.markCompletedMessages(storagePath, currentIds);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MonitorTopic] Error monitoring ${receiverPath}:`, errorMessage);
    } finally {
      if (receiver) {
        try {
          await receiver.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[MonitorTopic] Error closing receiver for ${receiverPath}:`, errorMessage);
        }
      }
    }
  }

  /**
   * Monitor dead letter queue for a topic subscription
   */
  private async monitorTopicDeadLetterQueue(topicName: string, subscriptionName: string): Promise<void> {
    const dlqReceiverPath = `${topicName}/Subscriptions/${subscriptionName}/$DeadLetterQueue`;
    const dlqStoragePath = `${topicName}/${subscriptionName}/$DeadLetterQueue`;
    let dlqReceiver: ServiceBusReceiver | null = null;

    try {
      dlqReceiver = this.serviceBusClient.createReceiver(dlqReceiverPath);

      const dlqMessages = await this.peekAllMessages(dlqReceiver);

      if (dlqMessages.length > 0) {
        console.log(`[MonitorTopicDLQ] Found ${dlqMessages.length} dead-lettered messages in ${dlqStoragePath}`);

        for (const msg of dlqMessages) {
          // Determine the correct state based on dead letter reason
          const state = this.getDeadLetterState(msg.deadLetterReason);

          // Extract additional properties from message body if present
          const bodyObj = typeof msg.body === 'object' && msg.body !== null ? msg.body as any : {};
          const sentBy = bodyObj.sentBy;
          const recievedBy = bodyObj.recievedBy;
          const sentAt = bodyObj.sentAt ? new Date(bodyObj.sentAt) : undefined;
          const recievedAt = bodyObj.recievedAt ? new Date(bodyObj.recievedAt) : undefined;

          await this.serviceBusMessageModel.updateOne(
            { messageId: msg.messageId },
            {
              $set: {
                body: msg.body,
                queue: dlqStoragePath,
                topic: topicName,
                subscription: subscriptionName,
                state: state,
                applicationProperties: msg.applicationProperties || undefined,
                sequenceNumber: msg.sequenceNumber?.toNumber(),
                enqueuedTimeUtc: msg.enqueuedTimeUtc,
                deliveryCount: msg.deliveryCount,
                deadLetteredAt: new Date(),
                deadLetterReason: msg.deadLetterReason,
                deadLetterErrorDescription: msg.deadLetterErrorDescription,
                lastUpdated: new Date(),
                ...(sentBy && { sentBy }),
                ...(recievedBy && { recievedBy }),
                ...(sentAt && { sentAt }),
                ...(recievedAt && { recievedAt }),
              },
            },
            { upsert: true }
          );
        }

        // Log summary
        const abandonedCount = dlqMessages.filter(m => m.deadLetterReason === 'MaxDeliveryCountExceeded').length;
        const otherDlqCount = dlqMessages.length - abandonedCount;

        if (abandonedCount > 0) {
          console.log(`[MonitorTopicDLQ] ${abandonedCount} abandoned messages (MaxDeliveryCountExceeded) in ${dlqStoragePath}`);
        }
        if (otherDlqCount > 0) {
          console.log(`[MonitorTopicDLQ] ${otherDlqCount} dead-lettered messages (other reasons) in ${dlqStoragePath}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('NotFound') && !errorMessage.includes('does not exist')) {
        console.error(`[MonitorTopicDLQ] Error monitoring ${dlqReceiverPath}:`, errorMessage);
      }
    } finally {
      if (dlqReceiver) {
        try {
          await dlqReceiver.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[MonitorTopicDLQ] Error closing DLQ receiver for ${dlqReceiverPath}:`, errorMessage);
        }
      }
    }
  }

  /**
   * Mark messages as expired or completed based on TTL and grace period
   */
  private async markCompletedMessages(queuePath: string, currentServiceBusIds: string[]): Promise<void> {
    try {
      const now = new Date();
      const graceThreshold = new Date(now.getTime() - COMPLETION_GRACE_PERIOD_MS);

      const dlqIds = await this.collectDlqIds(queuePath);
      const allCurrentIds = [...currentServiceBusIds, ...dlqIds];

      const expiredResult = await this.serviceBusMessageModel.updateMany(
        {
          queue: queuePath,
          messageId: { $nin: allCurrentIds },
          state: MessageState.ACTIVE,
          timeToLive: { $gt: 0 },
          enqueuedTimeUtc: { $exists: true },
          $expr: {
            $lt: [{ $add: ['$enqueuedTimeUtc', '$timeToLive'] }, now],
          },
        },
        {
          $set: {
            state: MessageState.EXPIRED,
            expiredAt: now,
            lastUpdated: now,
          },
        }
      );

      if (expiredResult.modifiedCount > 0) {
        console.log(`[MarkExpired] Marked ${expiredResult.modifiedCount} messages as expired in ${queuePath}`);
      }

      const completedResult = await this.serviceBusMessageModel.updateMany(
        {
          queue: queuePath,
          messageId: { $nin: allCurrentIds },
          state: { $in: [MessageState.ACTIVE, MessageState.EXPIRED] },
        },
        {
          $set: {
            state: MessageState.COMPLETED,
            completedAt: now,
            lastUpdated: now,
          },
        }
      );
      if (completedResult.modifiedCount > 0) {
        console.log(`[MarkCompleted] Marked ${completedResult.modifiedCount} messages as completed in ${queuePath}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MarkCompleted] Error marking completed messages for ${queuePath}:`, errorMessage);
    }
  }

  /**
   * Peek all messages from a receiver in batches
   */
  private async peekAllMessages(receiver: ServiceBusReceiver): Promise<ServiceBusReceivedMessage[]> {
    const allMessages: ServiceBusReceivedMessage[] = [];
    let fromSeq = Long.fromNumber(1);

    while (allMessages.length < MAX_PEEK_MESSAGES) {
      const batch = await receiver.peekMessages(PEEK_BATCH_SIZE, {
        fromSequenceNumber: fromSeq,
      });

      if (batch.length === 0) break;

      allMessages.push(...batch);

      const lastSeq = batch[batch.length - 1]?.sequenceNumber;
      if (!lastSeq) break;

      fromSeq = lastSeq.add(1);

      if (batch.length < PEEK_BATCH_SIZE) break;
    }

    return allMessages;
  }

  /**
   * Collect all current messageIds in a receiver
   */
  private async collectCurrentIds(receiver: ServiceBusReceiver): Promise<string[]> {
    const ids: string[] = [];
    let fromSeq = Long.fromNumber(1);

    while (ids.length < MAX_PEEK_MESSAGES) {
      const batch = await receiver.peekMessages(PEEK_BATCH_SIZE, {
        fromSequenceNumber: fromSeq,
      });

      if (batch.length === 0) break;

      for (const m of batch) {
        const bodyObj =
          typeof m.body === 'object' && m.body !== null
            ? (m.body as { id?: string | number })
            : undefined;
        const id = `${m.messageId ?? bodyObj?.id ?? 'unknown'}`;
        ids.push(id);
      }

      const lastSeq = batch[batch.length - 1]?.sequenceNumber;
      if (!lastSeq) break;

      fromSeq = lastSeq.add(1);

      if (batch.length < PEEK_BATCH_SIZE) break;
    }

    return ids;
  }

  /**
   * Collect all messageIds from the dead letter queue
   */
  private async collectDlqIds(queuePath: string): Promise<string[]> {
    let dlqPath: string;
    if (queuePath.includes('/')) {
      const [topic, subscription] = queuePath.split('/');
      dlqPath = `${topic}/Subscriptions/${subscription}/$DeadLetterQueue`;
    } else {
      dlqPath = `${queuePath}/$DeadLetterQueue`;
    }

    let dlqReceiver: ServiceBusReceiver | null = null;

    try {
      dlqReceiver = this.serviceBusClient.createReceiver(dlqPath);
      return await this.collectCurrentIds(dlqReceiver);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('NotFound') && !errorMessage.includes('does not exist')) {
        console.error(`[CollectDlqIds] Error collecting DLQ IDs for ${dlqPath}:`, errorMessage);
      }
      return [];
    } finally {
      if (dlqReceiver) {
        try {
          await dlqReceiver.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[CollectDlqIds] Error closing DLQ receiver for ${dlqPath}:`, errorMessage);
        }
      }
    }
  }

  /**
   * Map Service Bus message state to internal MessageState enum
   */
  private mapServiceBusState(state: unknown): MessageState {
    const serviceBusState = state?.toString().toLowerCase() || 'active';

    switch (serviceBusState) {
      case 'deferred':
        return MessageState.DEFERRED;
      case 'scheduled':
        return MessageState.SCHEDULED;
      case 'active':
      default:
        return MessageState.ACTIVE;
    }
  }

  /**
   * Determine message state based on dead letter reason
   */
  private getDeadLetterState(deadLetterReason?: string): MessageState {
    if (deadLetterReason === 'MaxDeliveryCountExceeded') {
      return MessageState.ABANDONED;
    }
    return MessageState.DEAD_LETTERED;
  }

  /**
   * Clean up old messages based on TTL
   */
  private async cleanupOldMessages(): Promise<void> {
    try {
      const now = new Date();
      const expiryThreshold = new Date(now.getTime() - MESSAGE_TTL_DEFAULT_MS);

      const result = await this.serviceBusMessageModel.deleteMany({
        state: { $nin: [MessageState.ACTIVE] },
        lastUpdated: { $lt: expiryThreshold },
      });

      if (result.deletedCount && result.deletedCount > 0) {
        console.log(`[Cleanup] Deleted ${result.deletedCount} old messages`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Cleanup] Error cleaning up old messages:', errorMessage);
    }
  }

  /**
   * Parse ISO 8601 duration string to milliseconds
   */
  private parseISO8601Duration(duration: string): number | null {
    try {
      const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
      if (!match) return null;

      const days = parseInt(match[1] || '0', 10);
      const hours = parseInt(match[2] || '0', 10);
      const minutes = parseInt(match[3] || '0', 10);
      const seconds = parseInt(match[4] || '0', 10);

      const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
      return totalSeconds * 1000;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[CleanupExpired] Failed to parse duration "${duration}":`, errorMessage);
      return null;
    }
  }

  /**
   * Auto-initialize Service Bus when module starts
   */
  async onModuleInit() {
    // Skip initialization if SERVICE_BUS_AUTO_INIT is explicitly disabled
    if (process.env.SERVICE_BUS_AUTO_INIT === 'false') {
      console.log('Service Bus auto-initialization disabled (SERVICE_BUS_AUTO_INIT=false)');
      return;
    }

    // Enable auto-initialization in development mode
    if (process.env.NODE_ENV === 'development' && !process.env.SERVICE_BUS_AUTO_INIT) {
      console.log('Auto-initializing Service Bus in development mode');
      // Continue with initialization
    }

    try {
      // Load configuration from file
      const config = this.configService.getServiceBusConfiguration();
      const connectionString = this.configService.serviceBusConnectionString;

      console.log('Auto-initializing Service Bus on module start...');
      console.log('Connection string:', connectionString.replace(/SharedAccessKey=[^;]+/, 'SharedAccessKey=***'));
      console.log('Environment:', process.env.NODE_ENV || 'production');

      // Check if Service Bus emulator is accessible first
      console.log('Checking Service Bus emulator connectivity...');
      if (!await this.checkEmulatorConnectivity(connectionString)) {
        console.warn('Service Bus emulator is not accessible. Skipping initialization.');
        console.warn('Please ensure:');
        console.warn('1. Service Bus emulator is running (docker-compose up)');
        console.warn('2. Connection string is correct');
        console.warn('3. Port 5672 is accessible');
        return;
      }

      await this.initialize(config, connectionString);
      console.log('Service Bus auto-initialization completed');
    } catch (error) {
      console.error('Failed to auto-initialize Service Bus:', error);
      console.error('This is non-fatal - the service will remain uninitialized');
      console.error('To disable auto-initialization, set SERVICE_BUS_AUTO_INIT=false');
      console.error('To check emulator status, run: docker-compose ps | grep emulator');
      // Don't throw error here as it might prevent the app from starting
      // The service will remain uninitialized and endpoints will handle this gracefully
    }
  }

  /**
   * Check if Service Bus emulator is accessible
   */
  private async checkEmulatorConnectivity(connectionString: string): Promise<boolean> {
    try {
      const client = new ServiceBusClient(connectionString);
      const testReceiver = client.createReceiver('test-queue');

      // Try to peek (this will fail if entity doesn't exist, but connection should work)
      try {
        await testReceiver.peekMessages(1);
      } catch (peekError) {
        // Entity not found is okay - it means connection works but queue doesn't exist
        if (peekError instanceof Error && peekError.message.includes('not found')) {
          console.log('Service Bus emulator connection successful (entity not found is expected)');
        } else {
          throw peekError;
        }
      }

      await testReceiver.close();
      await client.close();
      return true;
    } catch (error) {
      console.error('Service Bus emulator connectivity check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.cleanup();
  }
}
