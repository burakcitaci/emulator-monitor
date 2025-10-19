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
  ServiceBusReceiver,
} from '@azure/service-bus';
import {
  ConfigService,
  ServiceBusQueue,
  ServiceBusTopic,
  ServiceBusSubscription,
} from '../common/config.service';
import Long from 'long';
import * as parse from 'iso8601-duration';
@Injectable()
export class MessageService {
  private readonly serviceBusClient: ServiceBusClient;
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly configService: ConfigService
  ) {
    // Use centrally configured connection string
    this.serviceBusClient = new ServiceBusClient(
      this.configService.serviceBusConnectionString
    );
  }

  // @Cron(CronExpression.EVERY_30_SECONDS)
  // async monitorMessages() {
  //   try {
  //     console.log('[MonitorMessages] Starting monitoring cycle...');
  //     // Reconcile MongoDB-saved messages against Service Bus. Any missing are marked completed.
  //     await this.reconcileMongoWithServiceBus();

  //     console.log('[MonitorMessages] Monitoring cycle completed successfully');
  //   } catch (error) {
  //     console.error('[MonitorMessages] Fatal error during monitoring:', error);
  //   }
  // }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async monitorMessages() {
    const config = this.configService.getServiceBusConfiguration();
    const queues = config.UserConfig.Namespaces.flatMap(
      (ns) => ns.Queues || []
    );
    let reciever;
    for (const queue of queues) {
      reciever = this.serviceBusClient.createReceiver(queue.Name);

      // Peek messages from the queue
      const messages = await reciever.peekMessages(100, {
        fromSequenceNumber: Long.fromNumber(1),
      });

      if (messages.length > 0) {
        for (const msg of messages) {
          console.log(
            `[MonitorMessages] Processing message ${msg.messageId} in ${queue.Name} with state: ${msg.state}`
          );

          await this.messageModel.updateOne(
            { messageId: msg.messageId }, // Match by messageId only
            {
              $set: {
                body: msg.body,
                subject: queue.Name,
                state: msg.state,
                applicationProperties: msg.applicationProperties || undefined,
                lastUpdated: new Date(),
              },
            },
            { upsert: true }
          );
        }
      }
      const ids = await this.messageModel
        .find({ subject: queue.Name })
        .distinct('messageId')
        .exec();
      console.log(ids);
      const serviceBusIds = messages.map((m) => m.messageId);

      await this.messageModel
        .updateMany(
          { subject: queue.Name, messageId: { $nin: serviceBusIds } },
          {
            $set: {
              state: 'completed',
              lastUpdated: new Date(),
            },
          }
        )
        .exec();

      const now = new Date();
      const ttlSeconds = parse.toSeconds(parse.parse('PT1H')); // 3600
      const expiryThreshold = new Date(now.getTime() - ttlSeconds * 1000);

      const result = await this.messageModel
        .deleteMany({
          createdAt: { $lt: expiryThreshold },
        })
        .exec();
      console.log(
        `[MonitorMessages] Deleted ${result.deletedCount} expired messages from ${queue.Name}`
      );
    }
    await reciever?.close();
  }
  /**
   * Separate cron to cleanup expired messages (by per-message TTL and entity default TTL)
   */
  //@Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredMessagesCron() {
    try {
      const config = this.configService.getServiceBusConfiguration();
      const queues = config.UserConfig.Namespaces.flatMap(
        (ns) => ns.Queues || []
      );
      const topics = config.UserConfig.Namespaces.flatMap(
        (ns) => ns.Topics || []
      );
      await this.cleanupExpiredMessages(queues, topics);
    } catch (error) {
      console.error('[CleanupExpired] Cron failed:', error);
    }
  }

  /**
   * Reconcile all messages stored in MongoDB against Service Bus peek results.
   * If a messageId no longer appears in Service Bus for its path, mark it completed.
   */
  private async reconcileMongoWithServiceBus(): Promise<void> {
    // Drive from MongoDB: get distinct stored paths and reconcile those
    const allPaths = (await this.messageModel.distinct('queue')) as (
      | string
      | null
      | undefined
    )[];
    const paths: string[] = allPaths
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (!paths || paths.length === 0) {
      console.log('[Reconcile] No paths found in MongoDB to reconcile');
      return;
    }

    console.log(`[Reconcile] Reconciling ${paths.length} path(s)`);

    // Process in parallel
    await Promise.allSettled(
      paths.map(async (path) => {
        let receiver: ServiceBusReceiver | undefined;
        try {
          // Determine if path is queue, topic/subscription, or a DLQ variant
          const parts = path.split('/');
          const isDlq = parts[parts.length - 1] === 'DLQ';
          if (isDlq) {
            if (parts.length === 2) {
              // queue/DLQ
              const [queueName] = parts;
              receiver = this.serviceBusClient.createReceiver(queueName, {
                subQueueType: 'deadLetter',
              });
            } else if (parts.length === 3) {
              // topic/sub/DLQ
              const [topicName, subscriptionName] = parts;
              receiver = this.serviceBusClient.createReceiver(
                topicName,
                subscriptionName,
                { subQueueType: 'deadLetter' }
              );
            } else {
              // Fallback: skip malformed DLQ path
              console.warn(
                `[Reconcile] Skipping unrecognized DLQ path: ${path}`
              );
              return;
            }
          } else if (parts.length === 2) {
            // topic/subscription
            const [topicName, subscriptionName] = parts;
            receiver = this.serviceBusClient.createReceiver(
              topicName,
              subscriptionName
            );
          } else {
            // plain queue
            receiver = this.serviceBusClient.createReceiver(path);
          }

          const currentIds = await this.collectCurrentIds(receiver);
          await this.reconcileCompletedForPath(path, currentIds);
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error(`[Reconcile] Error reconciling path ${path}:`, err);
        } finally {
          if (receiver) {
            try {
              await receiver.close();
            } catch (closeError) {
              console.error(
                `[Reconcile] Error closing receiver for ${path}:`,
                closeError
              );
            }
          }
        }
      })
    );
  }

  // backfillMissingQueues removed to simplify reconciliation

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

      // Mark messages that are no longer present as completed
      const currentIds = await this.collectCurrentIds(receiver);
      await this.reconcileCompletedForPath(queue.Name, currentIds);

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
        `[ProcessTopicSubscription] ${topicName}/${subscriptionName}`
      );

      receiver = this.serviceBusClient.createReceiver(
        topicName,
        subscriptionName
      );

      const messages = await receiver.peekMessages(100);
      console.log(
        `[ProcessTopicSubscription] Found ${messages.length} message(s)`
      );

      // Process messages in parallel
      await Promise.allSettled(
        messages.map((msg) =>
          this.processMessage(msg, `${topicName}/${subscriptionName}`)
        )
      );

      // Mark messages that are no longer present as completed
      const currentIds = await this.collectCurrentIds(receiver);
      await this.reconcileCompletedForPath(
        `${topicName}/${subscriptionName}`,
        currentIds
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
    console.log('[DeferredSync] Starting deferred message synchronization...');

    for (const queue of queues) {
      // Find deferred messages stored in MongoDB
      const deferredMsgs = await this.messageModel.find({
        queue: queue.Name,
        state: MessageState.DEFERRED,
        sequenceNumber: { $ne: null },
      });

      if (deferredMsgs.length === 0) {
        console.log(
          `[DeferredSync] No deferred messages found for ${queue.Name}`
        );
        continue;
      }

      console.log(
        `[DeferredSync] Found ${deferredMsgs.length} deferred messages in MongoDB for ${queue.Name}`
      );

      const receiver = this.serviceBusClient.createReceiver(queue.Name);
      const stillDeferred: string[] = [];

      for (const msg of deferredMsgs) {
        if (!msg.sequenceNumber) continue;

        try {
          const deferredMessage = await receiver.receiveDeferredMessages([
            Long.fromNumber(msg.sequenceNumber),
          ]);

          if (deferredMessage && deferredMessage.length > 0) {
            const sbMessage = deferredMessage[0];

            await this.upsertMessageFromServiceBus(
              sbMessage,
              queue.Name,
              MessageStatus.DEFERRED,
              MessageState.DEFERRED
            );

            stillDeferred.push(msg.messageId + '');
            console.log(
              `[DeferredSync] Synced deferred message ${msg.messageId} (Seq: ${msg.sequenceNumber})`
            );
          } else {
            // Not found — message might have expired or been completed
            console.log(
              `[DeferredSync] Deferred message ${msg.messageId} (Seq: ${msg.sequenceNumber}) not found in queue, marking expired`
            );

            await this.messageModel.updateOne(
              { _id: msg._id },
              {
                $set: {
                  status: MessageStatus.COMPLETED,
                  state: MessageState.DEFERRED,
                  lastUpdated: new Date(),
                },
              }
            );
          }
        } catch (error: unknown) {
          const err = error as { code?: string };
          if (err && err.code === 'MessageNotFound') {
            console.warn(
              `[DeferredSync] Deferred message ${msg.messageId} no longer exists (MessageNotFound)`
            );

            await this.messageModel.updateOne(
              { _id: msg._id },
              {
                $set: {
                  status: MessageStatus.COMPLETED,
                  lastUpdated: new Date(),
                },
              }
            );
          } else {
            console.error(
              `[DeferredSync] Error receiving deferred message ${msg.messageId}:`,
              err
            );
          }
        }
      }

      await receiver.close();

      console.log(
        `[DeferredSync] Completed syncing deferred messages for ${queue.Name}. Still deferred: ${stillDeferred.length}`
      );
    }

    console.log('[DeferredSync] Deferred message synchronization finished.');
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

        if (messages.length === 0) {
          console.log(
            `[MonitorDLQ] No messages in DLQ for ${queue.Name}. Deleting synced records from MongoDB...`
          );
          await this.messageModel.deleteMany({
            queue: `${queue.Name}/DLQ`,
            status: MessageStatus.DEAD_LETTERED,
            state: MessageState.DEAD_LETTERED,
          });
          return;
        }

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
      const andConditions: any[] = [];

      // Build a target path if topic/subscription provided
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
            { 'applicationProperties.topic': targetPath },
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

    return query.lean<MessageDocument[]>();
  }

  async findOne(id: string): Promise<MessageDocument | null> {
    return this.messageModel
      .findById(id)
      .exec() as Promise<MessageDocument | null>;
  }

  async saveReceivedMessage(msg: Partial<Message>) {
    // Convert body safely
    console.log('Reieved', msg.body);
    await this.messageModel.create({
      ...msg,
      body: msg.body, // store object directly
    });
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

      // First cleanup: per-message TTL (enqueuedTimeUtc + timeToLive)
      try {
        const perMessageFilter: any = {
          timeToLive: { $gt: 0 },
          enqueuedTimeUtc: { $type: 'date' },
          status: { $ne: MessageStatus.DEAD_LETTERED },
          $expr: {
            $lt: [{ $add: ['$enqueuedTimeUtc', '$timeToLive'] }, now],
          },
        };
        const perMessageResult = await this.messageModel.deleteMany(
          perMessageFilter
        );
        if (
          perMessageResult.deletedCount &&
          perMessageResult.deletedCount > 0
        ) {
          console.log(
            `[CleanupExpired] Deleted ${perMessageResult.deletedCount} messages expired by per-message TTL`
          );
          totalDeleted += perMessageResult.deletedCount;
        }
      } catch (e) {
        console.error(
          '[CleanupExpired] Error during per-message TTL cleanup:',
          e
        );
      }

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

        // Use enqueuedTimeUtc if available, otherwise createdAt; and only for docs without per-message TTL
        const queueFilter: any = {
          queue: queue.Name,
          status: { $ne: MessageStatus.DEAD_LETTERED },
          $or: [
            { timeToLive: { $exists: false } },
            { timeToLive: { $in: [null, 0] } },
          ],
          $expr: {
            $lt: [
              { $ifNull: ['$enqueuedTimeUtc', '$createdAt'] },
              expireBefore,
            ],
          },
        };
        const deletedCount = await this.messageModel.deleteMany(queueFilter);

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

          // Use enqueuedTimeUtc if available, otherwise createdAt; and only for docs without per-message TTL
          const topicFilter: any = {
            queue: topicSubscriptionPath,
            status: { $ne: MessageStatus.DEAD_LETTERED },
            $or: [
              { timeToLive: { $exists: false } },
              { timeToLive: { $in: [null, 0] } },
            ],
            $expr: {
              $lt: [
                { $ifNull: ['$enqueuedTimeUtc', '$createdAt'] },
                expireBefore,
              ],
            },
          };
          const deletedCount = await this.messageModel.deleteMany(topicFilter);

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
      // Support ISO 8601: PnD, PTnH, PTnM, PTnS and combinations like P1DT2H30M
      const match = duration.match(
        /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
      );
      if (!match) return null;

      const days = parseInt(match[1] || '0', 10);
      const hours = parseInt(match[2] || '0', 10);
      const minutes = parseInt(match[3] || '0', 10);
      const seconds = parseInt(match[4] || '0', 10);

      const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
      return totalSeconds * 1000; // milliseconds
    } catch (error) {
      console.error(
        `[CleanupExpired] Failed to parse duration "${duration}":`,
        error
      );
      return null;
    }
  }

  /**
   * Mark messages as completed in MongoDB if they no longer appear in Service Bus peek results
   */
  async reconcileCompletedForPath(
    path: string,
    currentIds: ReadonlyArray<string | number | undefined>
  ): Promise<void> {
    const allSyncedMessages = await this.messageModel.find({ queue: path });

    if (allSyncedMessages.length === null || allSyncedMessages.length === 0)
      return;

    // Normalize ids to strings to avoid union complexity and ensure stable comparison
    const currentIdStrings: string[] = (currentIds ?? []).map((id) =>
      id === undefined ? 'undefined' : String(id)
    );
    const currentIdSet = new Set<string>(currentIdStrings);

    for (const msg of allSyncedMessages) {
      const msgIdStr =
        msg.messageId === undefined ? 'undefined' : String(msg.messageId);
      if (currentIdSet.has(msgIdStr)) continue;
      await this.messageModel.updateOne(
        { messageId: msg.messageId, queue: path },
        {
          $set: {
            status: MessageStatus.COMPLETED,
            lastUpdated: new Date(),
          },
        }
      );
    }
  }

  /**
   * Collect all current messageIds in a receiver by peeking batches until exhaustion
   */
  private async collectCurrentIds(
    receiver: ServiceBusReceiver
  ): Promise<string[]> {
    const ids: string[] = [];
    let fromSeq = Long.fromNumber(1);
    const batchSize = 200;
    const cap = 5000;
    while (ids.length < cap) {
      const batch = await receiver.peekMessages(batchSize, {
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
      const lastSeq = batch[batch.length - 1].sequenceNumber?.toNumber();
      if (!lastSeq) break;
      fromSeq = Long.fromNumber(lastSeq + 1);
      if (batch.length < batchSize) break;
    }
    return ids;
  }
}
