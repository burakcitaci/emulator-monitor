// service-bus-message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MessageDocument,
  Message,
  MessageState,
} from './message.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ServiceBusClient,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import {
  ConfigService,
  ServiceBusQueue,
  ServiceBusTopic,
} from '../common/config.service';
import Long from 'long';

// Constants
const PEEK_BATCH_SIZE = 200;
const MAX_PEEK_MESSAGES = 5000;
const COMPLETION_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
const MESSAGE_TTL_DEFAULT_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class MessageService {
  private readonly serviceBusClient: ServiceBusClient;
  
  // Track last sequence numbers to avoid re-processing old messages
  private lastSequenceNumbers = new Map<string, number>();

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly configService: ConfigService
  ) {
    this.serviceBusClient = new ServiceBusClient(
      this.configService.serviceBusConnectionString
    );
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
   * Monitor a specific queue
   */
  private async monitorQueue(queueName: string, properties?: { MaxDeliveryCount?: number }): Promise<void> {
    let receiver: ServiceBusReceiver | null = null;
    
    try {
      receiver = this.serviceBusClient.createReceiver(queueName);
      
      const maxDeliveryCount = properties?.MaxDeliveryCount || 10;
      console.log(`[MonitorQueue] Monitoring queue: ${queueName} (MaxDeliveryCount: ${maxDeliveryCount})`);

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
          
          await this.messageModel.updateOne(
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
                timeToLive: msg.timeToLive,
                lastUpdated: new Date(),
                lastSeenAt: new Date(),
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
          
          await this.messageModel.updateOne(
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
      
      console.log(
        `[MonitorTopic] Monitoring: ${receiverPath} → storing as: ${storagePath} ` +
        `(MaxDeliveryCount: ${maxDeliveryCount}, DLQ on expiration: ${deadLetterOnExpiration})`
      );

      const currentIds = await this.collectCurrentIds(receiver);
      
      if (currentIds.length > 0) {
        console.log(`[MonitorTopic] Found ${currentIds.length} messages in ${storagePath}`);
      }

      const messages = await this.peekAllMessages(receiver);

      if (messages.length > 0) {
        for (const msg of messages) {
          const messageState = this.mapServiceBusState(msg.state);

          await this.messageModel.updateOne(
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
                timeToLive: msg.timeToLive,
                lastUpdated: new Date(),
                lastSeenAt: new Date(),
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
          
          await this.messageModel.updateOne(
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

      const expiredResult = await this.messageModel.updateMany(
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

      const completedResult = await this.messageModel.updateMany(
        {
          queue: queuePath,
          messageId: { $nin: allCurrentIds },
          state: { $in: [MessageState.ACTIVE, MessageState.EXPIRED] },
          lastSeenAt: { $lt: graceThreshold },
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
   * Verify a specific message immediately after sending
   */
  async verifyMessageDelivery(messageId: string, queuePath: string): Promise<{ found: boolean; state?: MessageState }> {
    let receiver: ServiceBusReceiver | null = null;

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const isTopicSubscription = queuePath.includes('/');
      const receiverPath = isTopicSubscription
        ? queuePath.replace('/', '/Subscriptions/')
        : queuePath;

      receiver = this.serviceBusClient.createReceiver(receiverPath);

      const messages = await receiver.peekMessages(PEEK_BATCH_SIZE);
      const found = messages.find(m => m.messageId === messageId);

      if (found) {
        const state = this.mapServiceBusState(found.state);
        
        await this.messageModel.updateOne(
          { messageId },
          {
            $set: {
              state,
              sequenceNumber: found.sequenceNumber?.toNumber(),
              enqueuedTimeUtc: found.enqueuedTimeUtc,
              deliveryCount: found.deliveryCount,
              verifiedAt: new Date(),
              lastUpdated: new Date(),
            },
          }
        );

        console.log(`[VerifyMessage] Found message ${messageId} in ${queuePath} with state ${state}`);
        return { found: true, state };
      }

      const dlqPath = `${receiverPath}/$DeadLetterQueue`;
      let dlqReceiver: ServiceBusReceiver | null = null;

      try {
        dlqReceiver = this.serviceBusClient.createReceiver(dlqPath);
        const dlqMessages = await dlqReceiver.peekMessages(PEEK_BATCH_SIZE);
        const deadLetter = dlqMessages.find(m => m.messageId === messageId);

        if (deadLetter) {
          const state = this.getDeadLetterState(deadLetter.deadLetterReason);
          
          await this.messageModel.updateOne(
            { messageId },
            {
              $set: {
                state: state,
                deadLetterReason: deadLetter.deadLetterReason,
                deadLetterErrorDescription: deadLetter.deadLetterErrorDescription,
                deliveryCount: deadLetter.deliveryCount,
                verifiedAt: new Date(),
                lastUpdated: new Date(),
              },
            }
          );

          const reason = deadLetter.deadLetterReason === 'MaxDeliveryCountExceeded' 
            ? 'abandoned (MaxDeliveryCountExceeded)' 
            : 'dead-lettered';
          console.log(`[VerifyMessage] Found message ${messageId} in DLQ - ${reason}`);
          return { found: true, state };
        }
      } catch (dlqError) {
        const errorMessage = dlqError instanceof Error ? dlqError.message : 'Unknown error';
        if (!errorMessage.includes('NotFound')) {
          console.error(`[VerifyMessage] Error checking DLQ:`, errorMessage);
        }
      } finally {
        if (dlqReceiver) {
          await dlqReceiver.close();
        }
      }

      console.log(`[VerifyMessage] Message ${messageId} not found in ${queuePath}`);
      return { found: false };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[VerifyMessage] Error verifying message ${messageId}:`, errorMessage);
      return { found: false };
    } finally {
      if (receiver) {
        try {
          await receiver.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[VerifyMessage] Error closing receiver:`, errorMessage);
        }
      }
    }
  }

  /**
   * Clean up old messages based on TTL
   */
  private async cleanupOldMessages(): Promise<void> {
    try {
      const now = new Date();
      const expiryThreshold = new Date(now.getTime() - MESSAGE_TTL_DEFAULT_MS);

      const result = await this.messageModel.deleteMany({
        state: { $in: [MessageState.COMPLETED, MessageState.DEAD_LETTERED] },
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

  async findAll(filters?: {
    queue?: string;
    topic?: string;
    subscription?: string;
    maxMessages?: number;
  }): Promise<MessageDocument[]> {
    let query = this.messageModel.find();

    if (filters) {
      const andConditions: any[] = [];
      let targetPath: string | undefined;

      if (filters.topic && filters.subscription) {
        targetPath = `${filters.topic}/${filters.subscription}`;
      } else if (filters.queue) {
        targetPath = filters.queue;
      } else if (filters.topic) {
        targetPath = filters.topic;
      }

      if (targetPath) {
        andConditions.push({
          $or: [
            { queue: targetPath },
            { to: targetPath },
            { 'applicationProperties.queue': targetPath },
            { 'applicationProperties.topic': filters.topic },
            ...(filters.subscription ? [{ 'applicationProperties.subscription': filters.subscription }] : []),
          ],
        });
      }

      if (!targetPath && filters.subscription) {
        andConditions.push({
          'applicationProperties.subscription': filters.subscription,
        });
      }

      if (andConditions.length > 0) {
        query = query.where({ $and: andConditions });
      }

      if (filters.maxMessages) {
        query = query.limit(filters.maxMessages);
      }
    }

    return query.sort({ enqueuedTimeUtc: -1, createdAt: -1 }).lean<MessageDocument[]>();
  }

  async findOne(id: string): Promise<MessageDocument | null> {
    return this.messageModel
      .findById(id)
      .exec() as Promise<MessageDocument | null>;
  }

  async findByMessageId(messageId: string): Promise<MessageDocument | null> {
    return this.messageModel
      .findOne({ messageId })
      .exec() as Promise<MessageDocument | null>;
  }

  async getStatistics(): Promise<{
    queues: Array<{ 
      name: string; 
      active: number; 
      completed: number; 
      abandoned: number;
      deadLettered: number; 
      total: number 
    }>;
    topics: Array<{ 
      name: string; 
      subscription: string; 
      active: number; 
      completed: number; 
      abandoned: number;
      deadLettered: number; 
      total: number 
    }>;
  }> {
    const config = this.configService.getServiceBusConfiguration();
    const queues = config.UserConfig.Namespaces.flatMap((ns) => ns.Queues || []);
    const topics = config.UserConfig.Namespaces.flatMap((ns) => ns.Topics || []);

    const queueStats = await Promise.all(
      queues.map(async (queue) => {
        const [active, completed, abandoned, deadLettered, total] = await Promise.all([
          this.messageModel.countDocuments({ queue: queue.Name, state: MessageState.ACTIVE }),
          this.messageModel.countDocuments({ queue: queue.Name, state: MessageState.COMPLETED }),
          this.messageModel.countDocuments({ 
            queue: { $regex: `^${queue.Name}/\\$DeadLetterQueue$` },
            state: MessageState.ABANDONED 
          }),
          this.messageModel.countDocuments({ 
            queue: { $regex: `^${queue.Name}/\\$DeadLetterQueue$` },
            state: MessageState.DEAD_LETTERED 
          }),
          this.messageModel.countDocuments({ queue: queue.Name }),
        ]);

        return {
          name: queue.Name,
          active,
          completed,
          abandoned,
          deadLettered,
          total,
        };
      })
    );

    const topicStats: Array<{
      name: string;
      subscription: string;
      active: number;
      completed: number;
      abandoned: number;
      deadLettered: number;
      total: number;
    }> = [];
    
    for (const topic of topics) {
      for (const subscription of topic.Subscriptions || []) {
        const storagePath = `${topic.Name}/${subscription.Name}`;
        const [active, completed, abandoned, deadLettered, total] = await Promise.all([
          this.messageModel.countDocuments({ queue: storagePath, state: MessageState.ACTIVE }),
          this.messageModel.countDocuments({ queue: storagePath, state: MessageState.COMPLETED }),
          this.messageModel.countDocuments({ 
            queue: `${storagePath}/$DeadLetterQueue`,
            state: MessageState.ABANDONED 
          }),
          this.messageModel.countDocuments({ 
            queue: `${storagePath}/$DeadLetterQueue`,
            state: MessageState.DEAD_LETTERED 
          }),
          this.messageModel.countDocuments({ queue: storagePath }),
        ]);

        topicStats.push({
          name: topic.Name,
          subscription: subscription.Name,
          active,
          completed,
          abandoned,
          deadLettered,
          total,
        });
      }
    }

    return {
      queues: queueStats,
      topics: topicStats,
    };
  }

  async getDeliveryCountStats(queueOrTopicPath: string): Promise<{
    averageDeliveryCount: number;
    maxDeliveryCount: number;
    messagesNearMaxDelivery: MessageDocument[];
  }> {
    const messages = await this.messageModel.find({
      queue: queueOrTopicPath,
      state: MessageState.ACTIVE,
      deliveryCount: { $exists: true },
    });

    if (messages.length === 0) {
      return {
        averageDeliveryCount: 0,
        maxDeliveryCount: 0,
        messagesNearMaxDelivery: [],
      };
    }

    const deliveryCounts = messages.map((m) => m.deliveryCount || 0);
    const avgDeliveryCount = deliveryCounts.reduce((a, b) => a + b, 0) / deliveryCounts.length;
    const maxCount = Math.max(...deliveryCounts);

    const nearMax = messages.filter((m) => {
      const count = m.deliveryCount || 0;
      const max = m.maxDeliveryCount || 10;
      return count >= max * 0.7;
    });

    return {
      averageDeliveryCount: Math.round(avgDeliveryCount * 100) / 100,
      maxDeliveryCount: maxCount,
      messagesNearMaxDelivery: nearMax,
    };
  }

  async saveReceivedMessage(msg: Partial<Message>): Promise<void> {
    console.log('[SaveMessage] Received message:', msg.messageId);
    await this.messageModel.create({
      ...msg,
      createdAt: msg.createdAt || new Date(),
      lastUpdated: new Date(),
    });
  }

  async remove(id: string): Promise<void> {
    await this.messageModel.findByIdAndDelete(id).exec();
  }

  async update(id: string, msg: Partial<Message>): Promise<MessageDocument | null> {
    return this.messageModel
      .findByIdAndUpdate(
        id,
        { ...msg, lastUpdated: new Date() },
        { new: true }
      )
      .exec() as Promise<MessageDocument | null>;
  }

  async migrateOldMessages(): Promise<void> {
    console.log('[MigrateMessages] Starting migration of old messages...');

    try {
      const config = this.configService.getServiceBusConfiguration();
      const configuredQueues = config.UserConfig.Namespaces.flatMap(
        (ns) => ns.Queues?.map((q) => q.Name) || []
      );
      const configuredTopics = config.UserConfig.Namespaces.flatMap(
        (ns) =>
          ns.Topics?.flatMap(
            (t) => t.Subscriptions?.map((s) => `${t.Name}/${s.Name}`) || []
          ) || []
      );
      const validQueueTopics = [...configuredQueues, ...configuredTopics];

      console.log(`[MigrateMessages] Configured queues/topics: ${validQueueTopics.join(', ')}`);

      const migrations = [
        { from: 'sent', to: MessageState.ACTIVE },
        { from: 'processed', to: MessageState.COMPLETED },
        { from: 'deffered', to: MessageState.DEFERRED },
      ];

      for (const migration of migrations) {
        const result = await this.messageModel.updateMany(
          { state: migration.from },
          { $set: { state: migration.to } }
        );
        if (result.modifiedCount > 0) {
          console.log(`[MigrateMessages] Updated ${result.modifiedCount} messages from '${migration.from}' to '${migration.to}'`);
        }
      }

      const emptyQueueMessages = await this.messageModel.find({
        $or: [{ queue: null }, { queue: '' }, { queue: { $exists: false } }],
      });

      console.log(`[MigrateMessages] Found ${emptyQueueMessages.length} messages with empty queue field`);

      let updatedCount = 0;
      for (const message of emptyQueueMessages) {
        let queueValue: string | undefined;

        const candidateValues = [
          message.to,
          message.subject,
          message.applicationProperties instanceof Map
            ? message.applicationProperties.get('queue')
            : undefined,
          message.applicationProperties instanceof Map
            ? message.applicationProperties.get('topic')
            : undefined,
        ].filter((v): v is string => typeof v === 'string');

        for (const candidate of candidateValues) {
          if (validQueueTopics.includes(candidate)) {
            queueValue = candidate;
            break;
          }
          const matchingTopic = configuredTopics.find((qt) =>
            qt.startsWith(candidate + '/')
          );
          if (matchingTopic) {
            queueValue = matchingTopic;
            break;
          }
        }

        if (!queueValue && validQueueTopics.length > 0) {
          queueValue = validQueueTopics[0];
        } else if (!queueValue) {
          queueValue = 'unknown';
        }

        await this.messageModel.updateOne(
          { _id: message._id },
          { $set: { queue: queueValue } }
        );
        updatedCount++;
      }

      console.log(`[MigrateMessages] Updated ${updatedCount} messages with empty queue field`);

      const noStatusResult = await this.messageModel.updateMany(
        { $or: [{ state: null }, { state: { $exists: false } }] },
        { $set: { state: MessageState.ACTIVE } }
      );
      console.log(`[MigrateMessages] Set status for ${noStatusResult.modifiedCount} messages without status`);

      console.log('[MigrateMessages] Migration completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[MigrateMessages] Migration failed:', errorMessage);
      throw error;
    }
  }

  async cleanupExpiredMessages(queues: ServiceBusQueue[], topics: ServiceBusTopic[]): Promise<void> {
    console.log('[CleanupExpired] Starting cleanup of expired messages...');

    try {
      const now = new Date();
      let totalDeleted = 0;

      try {
        const perMessageFilter: any = {
          timeToLive: { $gt: 0 },
          enqueuedTimeUtc: { $type: 'date' },
          state: { $ne: MessageState.DEAD_LETTERED },
          $expr: {
            $lt: [{ $add: ['$enqueuedTimeUtc', '$timeToLive'] }, now],
          },
        };
        const perMessageResult = await this.messageModel.deleteMany(perMessageFilter);
        if (perMessageResult.deletedCount && perMessageResult.deletedCount > 0) {
          console.log(`[CleanupExpired] Deleted ${perMessageResult.deletedCount} messages expired by per-message TTL`);
          totalDeleted += perMessageResult.deletedCount;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[CleanupExpired] Error during per-message TTL cleanup:', errorMessage);
      }

      for (const queue of queues) {
        const ttl = this.parseISO8601Duration(queue.Properties.DefaultMessageTimeToLive);
        if (!ttl) continue;

        const expireBefore = new Date(now.getTime() - ttl);
        const queueFilter: any = {
          queue: queue.Name,
          state: { $ne: MessageState.DEAD_LETTERED },
          $or: [
            { timeToLive: { $exists: false } },
            { timeToLive: { $in: [null, 0] } },
          ],
          $expr: {
            $lt: [{ $ifNull: ['$enqueuedTimeUtc', '$createdAt'] }, expireBefore],
          },
        };
        const result = await this.messageModel.deleteMany(queueFilter);

        if (result.deletedCount && result.deletedCount > 0) {
          console.log(`[CleanupExpired] Deleted ${result.deletedCount} expired messages from ${queue.Name}`);
          totalDeleted += result.deletedCount;
        }
      }

      for (const topic of topics) {
        for (const subscription of topic.Subscriptions || []) {
          const topicSubscriptionPath = `${topic.Name}/${subscription.Name}`;
          const ttl = this.parseISO8601Duration(topic.Properties.DefaultMessageTimeToLive);
          if (!ttl) continue;

          const expireBefore = new Date(now.getTime() - ttl);
          const topicFilter: any = {
            queue: topicSubscriptionPath,
            state: { $ne: MessageState.DEAD_LETTERED },
            $or: [
              { timeToLive: { $exists: false } },
              { timeToLive: { $in: [null, 0] } },
            ],
            $expr: {
              $lt: [{ $ifNull: ['$enqueuedTimeUtc', '$createdAt'] }, expireBefore],
            },
          };
          const result = await this.messageModel.deleteMany(topicFilter);

          if (result.deletedCount && result.deletedCount > 0) {
            console.log(`[CleanupExpired] Deleted ${result.deletedCount} expired messages from ${topicSubscriptionPath}`);
            totalDeleted += result.deletedCount;
          }
        }
      }

      if (totalDeleted > 0) {
        console.log(`[CleanupExpired] Total cleaned up ${totalDeleted} expired messages`);
      } else {
        console.log('[CleanupExpired] No expired messages found');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CleanupExpired] Error during cleanup:', errorMessage);
    }
  }

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
}