// service-bus-message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MessageDocument,
  Message,
  MessageStatus,
  MessageState,
} from './message.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ServiceBusClient,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import {
  ConfigService,
  ServiceBusQueue,
  ServiceBusTopic,
  ServiceBusSubscription,
} from '../common/config.service';
import Long from 'long';

@Injectable()
export class MessageService {
  private readonly serviceBusClient: ServiceBusClient;
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly configService: ConfigService
  ) {
    this.serviceBusClient = new ServiceBusClient(
      'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;'
    );
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async monitorMessages() {
    try {
      console.log('[MonitorMessages] Starting monitoring cycle...');
      const config = this.configService.getServiceBusConfiguration();
      const queues = config.UserConfig.Namespaces.flatMap(
        (element) => element.Queues || []
      );

      const topics = config.UserConfig.Namespaces.flatMap(
        (element) => element.Topics || []
      );

      // Process queues, topics, and DLQs in parallel for better performance
      await Promise.allSettled([
        this.monitorQueues(queues),
        this.monitorTopics(topics),
        this.monitorDeadLetterQueues(queues),
        this.monitorDeadLetterTopics(topics),
      ]);

      // Clean up expired messages based on TTL configuration
      await this.cleanupExpiredMessages(queues, topics);

      console.log('[MonitorMessages] Monitoring cycle completed successfully');
    } catch (error) {
      console.error('[MonitorMessages] Fatal error during monitoring:', error);
    }
  }

  private async monitorQueues(queues: ServiceBusQueue[]): Promise<void> {
    if (!queues || queues.length === 0) {
      console.log('[MonitorQueues] No queues to monitor');
      return;
    }

    console.log(`[MonitorQueues] Monitoring ${queues.length} queue(s)`);

    // Process queues in parallel but with controlled concurrency
    const results = await Promise.allSettled(
      queues.map((queue) => this.processQueue(queue))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `[MonitorQueues] Failed to process queue ${queues[index].Name}:`,
          result.reason
        );
      }
    });
  }

  private async processQueue(queue: ServiceBusQueue): Promise<void> {
    let receiver;
    try {
      console.log(`[ProcessQueue] Processing queue: ${queue.Name}`);
      receiver = this.serviceBusClient.createReceiver(queue.Name);

      // Peek messages from the queue
      const messages = await receiver.peekMessages(100, {
        fromSequenceNumber: Long.fromNumber(1),
      });

      console.log(
        `[ProcessQueue] Found ${messages.length} message(s) in ${queue.Name}`
      );

      // Process messages in parallel for better performance
      await Promise.allSettled(
        messages.map((msg) => this.processMessage(msg, queue.Name))
      );

      // Clean up deferred messages after processing
      await this.cleanDeferredMessages([queue]);
    } catch (error) {
      console.error(
        `[ProcessQueue] Error processing queue ${queue.Name}:`,
        error
      );
      throw error;
    } finally {
      // Ensure receiver is always closed
      if (receiver) {
        try {
          await receiver.close();
        } catch (closeError) {
          console.error(
            `[ProcessQueue] Error closing receiver for ${queue.Name}:`,
            closeError
          );
        }
      }
    }
  }

  private async processMessage(
    msg: ServiceBusReceivedMessage,
    queueOrTopic: string
  ): Promise<void> {
    try {
      console.log(
        `[ProcessMessage] Processing message ${msg.messageId} in ${queueOrTopic} with state: ${msg.state}`
      );

      // Map Azure Service Bus state to our status
      // Status reflects what the cron job observed in Service Bus
      let status = MessageStatus.ACTIVE; // default
      const state = msg.state;

      switch (state) {
        case MessageState.ACTIVE:
          // Message is in queue, waiting to be processed
          status = MessageStatus.ACTIVE;
          break;
        case MessageState.DEFERRED:
          // Message processing was postponed
          status = MessageStatus.DEFERRED;
          break;
        case MessageState.SCHEDULED:
          // Message is scheduled for future delivery
          status = MessageStatus.SCHEDULED;
          break;
        default:
          status = MessageStatus.ACTIVE;
      }

      await this.upsertMessageFromServiceBus(msg, queueOrTopic, status, state);

      console.log(
        `[ProcessMessage] Updated message ${msg.messageId} - Status: ${status}, State: ${state}`
      );
    } catch (error) {
      console.error(
        `[ProcessMessage] Error processing message ${msg.messageId}:`,
        error
      );
      // Don't throw - let other messages continue processing
    }
  }

  private async monitorTopics(topics: ServiceBusTopic[]): Promise<void> {
    if (!topics || topics.length === 0) {
      console.log('[MonitorTopics] No topics to monitor');
      return;
    }

    console.log(`[MonitorTopics] Monitoring ${topics.length} topic(s)`);

    // Process topics in parallel
    const results = await Promise.allSettled(
      topics.map((topic) => this.processTopic(topic))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `[MonitorTopics] Failed to process topic ${topics[index].Name}:`,
          result.reason
        );
      }
    });
  }

  private async processTopic(topic: ServiceBusTopic): Promise<void> {
    const subscriptions = topic.Subscriptions || [];

    if (subscriptions.length === 0) {
      console.log(`[ProcessTopic] No subscriptions for topic ${topic.Name}`);
      return;
    }

    // Process all subscriptions in parallel
    await Promise.allSettled(
      subscriptions.map((subscription: ServiceBusSubscription) =>
        this.processTopicSubscription(topic.Name, subscription)
      )
    );
  }

  private async processTopicSubscription(
    topicName: string,
    subscription: ServiceBusSubscription
  ): Promise<void> {
    let receiver;
    try {
      const subscriptionName = subscription.Name;
      console.log(
        `[ProcessTopicSubscription] Processing topic: ${topicName}, subscription: ${subscriptionName}`
      );

      receiver = this.serviceBusClient.createReceiver(
        topicName,
        subscriptionName
      );

      const messages = await receiver.peekMessages(100);
      console.log(
        `[ProcessTopicSubscription] Found ${messages.length} message(s) in ${topicName}/${subscriptionName}`
      );

      // Process messages in parallel
      await Promise.allSettled(
        messages.map((msg) =>
          this.processMessage(msg, `${topicName}/${subscriptionName}`)
        )
      );
    } catch (error) {
      console.error(
        `[ProcessTopicSubscription] Error processing topic ${topicName}/${subscription.Name}:`,
        error
      );
      throw error;
    } finally {
      // Ensure receiver is always closed
      if (receiver) {
        try {
          await receiver.close();
        } catch (closeError) {
          console.error(
            `[ProcessTopicSubscription] Error closing receiver for ${topicName}/${subscription.Name}:`,
            closeError
          );
        }
      }
    }
  }
  private async cleanDeferredMessages(
    queues: ServiceBusQueue[]
  ): Promise<void> {
    for (const queue of queues) {
      // Find deferred messages stored in MongoDB
      const deferredMsgs = await this.messageModel.find({
        queue: queue.Name,
        state: 'deferred',
        sequenceNumber: { $ne: null },
      });

      if (deferredMsgs.length === 0) continue;

      const sequenceNumbers: Long[] = [];
      for (const msg of deferredMsgs) {
        if (msg.sequenceNumber) {
          sequenceNumbers.push(Long.fromNumber(msg.sequenceNumber));
        }
      }

      if (sequenceNumbers.length === 0) continue;

      const receiver = this.serviceBusClient.createReceiver(queue.Name);

      // ✅ Step 3: Actually receive and complete deferred messages
      const deferredMessages = await receiver.receiveDeferredMessages(
        sequenceNumbers
      );

      for (const msg of deferredMessages) {
        console.log(`Completing deferred message: ${msg.messageId}`);
        await receiver.completeMessage(msg);

        // Update MongoDB record - message is now completed
        await this.messageModel.updateOne(
          { messageId: msg.messageId },
          {
            $set: {
              status: MessageStatus.COMPLETED,
              state: MessageState.ACTIVE, // Message no longer in deferred state
              lastUpdated: new Date(),
            },
          }
        );
      }

      await receiver.close();
    }
  }
  private async upsertMessageFromServiceBus(
    msg: ServiceBusReceivedMessage,
    queueOrTopic: string,
    status: string,
    state: string
  ): Promise<void> {
    const messageId = msg.messageId || msg.body?.id || 'unknown';
    const existing = await this.messageModel.findOne({ messageId });

    const payload = {
      messageId,
      body: msg.body,
      queue: queueOrTopic,
      sequenceNumber: msg.sequenceNumber?.toNumber() || null,
      enqueuedTimeUtc: msg.enqueuedTimeUtc,
      state,
      status,
      lastUpdated: new Date(),
      contentType: msg.contentType,
      correlationId: msg.correlationId,
      partitionKey: msg.partitionKey,
      sessionId: msg.sessionId,
      replyTo: msg.replyTo,
      replyToSessionId: msg.replyToSessionId,
      timeToLive: msg.timeToLive,
      subject: msg.subject,
      to: msg.to,
      scheduledEnqueueTimeUtc: msg.scheduledEnqueueTimeUtc,
      applicationProperties: msg.applicationProperties || undefined,
    };

    if (existing) {
      await this.messageModel.updateOne({ messageId }, { $set: payload });
    } else {
      await this.messageModel.create(payload);
    }
  }
  /**
   * Check Dead Letter Queue for queues
   */
  private async monitorDeadLetterQueues(
    queues: ServiceBusQueue[]
  ): Promise<void> {
    for (const queue of queues) {
      let dlqReceiver;
      try {
        console.log(
          `[MonitorDLQ] Checking Dead Letter Queue for: ${queue.Name}`
        );

        dlqReceiver = this.serviceBusClient.createReceiver(queue.Name, {
          subQueueType: 'deadLetter',
        });

        const messages = await dlqReceiver.peekMessages(100);
        console.log(
          `[MonitorDLQ] Found ${messages.length} dead-lettered message(s) in ${queue.Name}`
        );

        // Process dead-lettered messages
        for (const msg of messages) {
          await this.upsertMessageFromServiceBus(
            msg,
            `${queue.Name}/DLQ`,
            MessageStatus.DEAD_LETTERED,
            MessageState.DEAD_LETTERED
          );
        }
      } catch (error) {
        console.error(
          `[MonitorDLQ] Error checking DLQ for ${queue.Name}:`,
          error
        );
      } finally {
        if (dlqReceiver) {
          try {
            await dlqReceiver.close();
          } catch (closeError) {
            console.error(
              `[MonitorDLQ] Error closing DLQ receiver for ${queue.Name}:`,
              closeError
            );
          }
        }
      }
    }
  }

  /**
   * Check Dead Letter Queue for topic subscriptions
   */
  private async monitorDeadLetterTopics(
    topics: ServiceBusTopic[]
  ): Promise<void> {
    for (const topic of topics) {
      const subscriptions = topic.Subscriptions || [];

      for (const subscription of subscriptions) {
        let dlqReceiver;
        try {
          console.log(
            `[MonitorDLQ] Checking Dead Letter Queue for: ${topic.Name}/${subscription.Name}`
          );

          dlqReceiver = this.serviceBusClient.createReceiver(
            topic.Name,
            subscription.Name,
            {
              subQueueType: 'deadLetter',
            }
          );

          const messages = await dlqReceiver.peekMessages(100);
          console.log(
            `[MonitorDLQ] Found ${messages.length} dead-lettered message(s) in ${topic.Name}/${subscription.Name}`
          );

          // Process dead-lettered messages
          for (const msg of messages) {
            await this.upsertMessageFromServiceBus(
              msg,
              `${topic.Name}/${subscription.Name}/DLQ`,
              MessageStatus.DEAD_LETTERED,
              MessageState.DEAD_LETTERED
            );
          }
        } catch (error) {
          console.error(
            `[MonitorDLQ] Error checking DLQ for ${topic.Name}/${subscription.Name}:`,
            error
          );
        } finally {
          if (dlqReceiver) {
            try {
              await dlqReceiver.close();
            } catch (closeError) {
              console.error(
                `[MonitorDLQ] Error closing DLQ receiver for ${topic.Name}/${subscription.Name}:`,
                closeError
              );
            }
          }
        }
      }
    }
  }
  // CRUD operations
  async findAll(filters?: {
    queue?: string;
    topic?: string;
    subscription?: string;
    maxMessages?: number;
  }): Promise<MessageDocument[]> {
    let query = this.messageModel.find();

    if (filters) {
      const conditions: Record<string, unknown> = {};

      // Filter by queue
      if (filters.queue) {
        conditions.$or = [
          { to: filters.queue },
          { 'applicationProperties.queue': filters.queue },
        ];
      }

      // Filter by topic
      if (filters.topic) {
        conditions.$or = [
          { to: filters.topic },
          { 'applicationProperties.topic': filters.topic },
        ];
      }

      // Filter by subscription
      if (filters.subscription) {
        conditions['applicationProperties.subscription'] = filters.subscription;
      }

      if (Object.keys(conditions).length > 0) {
        query = query.where(conditions);
      }

      // Limit results
      if (filters.maxMessages) {
        query = query.limit(filters.maxMessages);
      }
    }

    return query.lean<MessageDocument[]>();
  }

  async findOne(id: string): Promise<MessageDocument | null> {
    return this.messageModel
      .findById(id)
      .exec() as Promise<MessageDocument | null>;
  }

  async saveReceivedMessage(msg: Partial<Message>) {
    this.messageModel.create(msg);
  }

  async remove(id: string): Promise<void> {
    await this.messageModel.findByIdAndDelete(id).exec();
  }

  async update(
    id: string,
    msg: Partial<Message>
  ): Promise<MessageDocument | null> {
    return this.messageModel
      .findByIdAndUpdate(id, msg, { new: true })
      .exec() as Promise<MessageDocument | null>;
  }

  /**
   * Migrate old messages to use new status enum and ensure queue field is populated
   * This should be run once to update legacy data
   */
  async migrateOldMessages(): Promise<void> {
    console.log('[MigrateMessages] Starting migration of old messages...');

    try {
      // Get the configured queues and topics from config
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

      console.log(
        `[MigrateMessages] Configured queues/topics: ${validQueueTopics.join(
          ', '
        )}`
      );

      // Update old "sent" status to "active"
      const sentResult = await this.messageModel.updateMany(
        { status: 'sent' },
        { $set: { status: MessageStatus.ACTIVE } }
      );
      console.log(
        `[MigrateMessages] Updated ${sentResult.modifiedCount} messages from 'sent' to 'active'`
      );

      // Update old "processed" status to "completed"
      const processedResult = await this.messageModel.updateMany(
        { status: 'processed' },
        { $set: { status: MessageStatus.COMPLETED } }
      );
      console.log(
        `[MigrateMessages] Updated ${processedResult.modifiedCount} messages from 'processed' to 'completed'`
      );

      // Update messages with empty queue field
      const emptyQueueMessages = await this.messageModel.find({
        $or: [{ queue: null }, { queue: '' }, { queue: { $exists: false } }],
      });

      console.log(
        `[MigrateMessages] Found ${emptyQueueMessages.length} messages with empty queue field`
      );

      let updatedCount = 0;
      for (const message of emptyQueueMessages) {
        let queueValue: string | undefined;

        // Try to match to configured queues/topics
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

        // Try to find a match in configured queues/topics
        for (const candidate of candidateValues) {
          // Check exact match
          if (validQueueTopics.includes(candidate)) {
            queueValue = candidate;
            break;
          }
          // Check if candidate is a topic without subscription
          const matchingTopic = configuredTopics.find((qt) =>
            qt.startsWith(candidate + '/')
          );
          if (matchingTopic) {
            queueValue = matchingTopic;
            break;
          }
        }

        // If no match found, use the first configured queue as default
        if (!queueValue && validQueueTopics.length > 0) {
          queueValue = validQueueTopics[0];
          console.log(
            `[MigrateMessages] No match found for message ${message.messageId}, using default: ${queueValue}`
          );
        } else if (!queueValue) {
          queueValue = 'unknown';
        }

        await this.messageModel.updateOne(
          { _id: message._id },
          { $set: { queue: queueValue } }
        );
        updatedCount++;
      }

      console.log(
        `[MigrateMessages] Updated ${updatedCount} messages with empty queue field`
      );

      // Update old "deffered" (typo) state to "deferred"
      const deferredResult = await this.messageModel.updateMany(
        { state: 'deffered' },
        { $set: { state: MessageState.DEFERRED } }
      );
      console.log(
        `[MigrateMessages] Updated ${deferredResult.modifiedCount} messages from 'deffered' to 'deferred'`
      );

      // Ensure all messages have a status field
      const noStatusResult = await this.messageModel.updateMany(
        { $or: [{ status: null }, { status: { $exists: false } }] },
        { $set: { status: MessageStatus.ACTIVE } }
      );
      console.log(
        `[MigrateMessages] Set status for ${noStatusResult.modifiedCount} messages without status`
      );

      console.log('[MigrateMessages] Migration completed successfully');
    } catch (error) {
      console.error('[MigrateMessages] Migration failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired messages based on TTL configuration for each queue/topic
   */
  async cleanupExpiredMessages(
    queues: ServiceBusQueue[],
    topics: ServiceBusTopic[]
  ): Promise<void> {
    console.log('[CleanupExpired] Starting cleanup of expired messages...');

    try {
      const now = new Date();
      let totalDeleted = 0;

      // Clean up expired messages for each queue
      for (const queue of queues) {
        const ttl = this.parseISO8601Duration(
          queue.Properties.DefaultMessageTimeToLive
        );
        if (!ttl) {
          console.log(
            `[CleanupExpired] No valid TTL for queue ${queue.Name}, skipping`
          );
          continue;
        }

        const expireBefore = new Date(now.getTime() - ttl);
        console.log(
          `[CleanupExpired] Cleaning messages in ${
            queue.Name
          } older than ${expireBefore.toISOString()} (TTL: ${
            queue.Properties.DefaultMessageTimeToLive
          })`
        );

        const deletedCount = await this.messageModel.deleteMany({
          queue: queue.Name,
          status: { $ne: MessageStatus.DEAD_LETTERED }, // Don't delete DLQ messages
          createdAt: { $lt: expireBefore },
        });

        if (deletedCount.deletedCount > 0) {
          console.log(
            `[CleanupExpired] Deleted ${deletedCount.deletedCount} expired messages from ${queue.Name}`
          );
          totalDeleted += deletedCount.deletedCount;
        }
      }

      // Clean up expired messages for each topic subscription
      for (const topic of topics) {
        for (const subscription of topic.Subscriptions || []) {
          const topicSubscriptionPath = `${topic.Name}/${subscription.Name}`;
          const ttl = this.parseISO8601Duration(
            topic.Properties.DefaultMessageTimeToLive
          );
          if (!ttl) {
            console.log(
              `[CleanupExpired] No valid TTL for topic ${topic.Name}, skipping`
            );
            continue;
          }

          const expireBefore = new Date(now.getTime() - ttl);
          console.log(
            `[CleanupExpired] Cleaning messages in ${topicSubscriptionPath} older than ${expireBefore.toISOString()} (TTL: ${
              topic.Properties.DefaultMessageTimeToLive
            })`
          );

          const deletedCount = await this.messageModel.deleteMany({
            queue: topicSubscriptionPath,
            status: { $ne: MessageStatus.DEAD_LETTERED }, // Don't delete DLQ messages
            createdAt: { $lt: expireBefore },
          });

          if (deletedCount.deletedCount > 0) {
            console.log(
              `[CleanupExpired] Deleted ${deletedCount.deletedCount} expired messages from ${topicSubscriptionPath}`
            );
            totalDeleted += deletedCount.deletedCount;
          }
        }
      }

      if (totalDeleted > 0) {
        console.log(
          `[CleanupExpired] Total cleaned up ${totalDeleted} expired messages`
        );
      } else {
        console.log('[CleanupExpired] No expired messages found');
      }
    } catch (error) {
      console.error('[CleanupExpired] Error during cleanup:', error);
      // Don't throw - cleanup errors shouldn't stop monitoring
    }
  }

  /**
   * Parse ISO 8601 duration format (e.g., "PT1H", "PT30M", "P1D") to milliseconds
   */
  private parseISO8601Duration(duration: string): number | null {
    try {
      // Handle the format: PT1H, PT30M, P1D, etc.
      const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
      if (!match) return null;

      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      const seconds = parseInt(match[3] || '0', 10);

      return (hours * 3600 + minutes * 60 + seconds) * 1000; // Convert to milliseconds
    } catch (error) {
      console.error(
        `[CleanupExpired] Failed to parse duration "${duration}":`,
        error
      );
      return null;
    }
  }
}
