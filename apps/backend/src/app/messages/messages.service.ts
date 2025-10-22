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
} from '@azure/service-bus';
import {
  ConfigService,
  ServiceBusQueue,
  ServiceBusTopic,
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

  @Cron(CronExpression.EVERY_30_SECONDS)
  async monitorMessages() {
    const config = this.configService.getServiceBusConfiguration();
    const queues = config.UserConfig.Namespaces.flatMap(
      (ns) => ns.Queues || []
    );
    const topics = config.UserConfig.Namespaces.flatMap(
      (ns) => ns.Topics || []
    );

    // Skip monitoring if no queues or topics configured
    if (queues.length === 0 && topics.length === 0) {
      console.log('[MonitorMessages] No queues or topics configured, skipping monitoring');
      return;
    }

    // Check if Service Bus client is available
    if (!this.serviceBusClient) {
      console.log('[MonitorMessages] Service Bus client not available, skipping monitoring');
      return;
    }

    // Monitor queues
    for (const queue of queues) {
      let receiver;
      try {
        receiver = this.serviceBusClient.createReceiver(queue.Name);

        // Peek messages from the queue
        const messages = await receiver.peekMessages(100, {
          fromSequenceNumber: Long.fromNumber(1),
        });

        if (messages.length > 0) {
          for (const msg of messages) {
            console.log(
              `[MonitorMessages] Processing message ${msg.messageId} in ${queue.Name} with state: ${msg.state}`
            );

            // Map Service Bus state to our MessageState enum
            let messageState: MessageState;
            const serviceBusState = msg.state?.toString().toLowerCase() || 'active';

            switch (serviceBusState) {
              case 'deferred':
                messageState = MessageState.DEFERRED;
                break;
              case 'scheduled':
                messageState = MessageState.SCHEDULED;
                break;
              case 'dead-lettered':
              case 'deadlettered':
                messageState = MessageState.DEAD_LETTERED;
                break;
              case 'active':
              default:
                messageState = MessageState.ACTIVE;
                break;
            }

            await this.messageModel.updateOne(
              { messageId: msg.messageId }, // Match by messageId only
              {
                $set: {
                  body: msg.body,
                  queue: queue.Name, // Store in queue field for consistency
                  state: messageState, // Use the actual Service Bus state
                  applicationProperties: msg.applicationProperties || undefined,
                  lastUpdated: new Date(),
                },
              },
              { upsert: true }
            );
          }
        }

        const ids = await this.messageModel
          .find({ queue: queue.Name })
          .distinct('messageId')
          .exec();
        console.log(ids);
        const serviceBusIds = messages.map((m) => m.messageId);

        // Mark messages that are not in Service Bus as completed, but only if they were active (being processed)
        await this.messageModel
          .updateMany(
            { queue: queue.Name, messageId: { $nin: serviceBusIds }, state: MessageState.ACTIVE },
            {
              $set: {
                state: MessageState.COMPLETED,
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
            queue: queue.Name,
            createdAt: { $lt: expiryThreshold },
          })
          .exec();
        console.log(
          `[MonitorMessages] Deleted ${result.deletedCount} expired messages from ${queue.Name}`
        );
      } catch (error) {
        console.error(`Error monitoring queue ${queue.Name}:`, error);
        // Continue with other queues even if one fails
      } finally {
        if (receiver) {
          try {
            await receiver.close();
          } catch (error) {
            console.error(`Error closing receiver for queue ${queue.Name}:`, error);
          }
        }
      }

      // Also monitor dead letter queue for this queue
      const deadLetterPath = `${queue.Name}/$DeadLetterQueue`;
      console.log(`Creating receiver for queue dead letter queue: ${deadLetterPath}`);

      let dlqReceiver;
      try {
        dlqReceiver = this.serviceBusClient.createReceiver(deadLetterPath);

        // Peek messages from the dead letter queue
        const dlqMessages = await dlqReceiver.peekMessages(100, {
          fromSequenceNumber: Long.fromNumber(1),
        });

        if (dlqMessages.length > 0) {
          for (const msg of dlqMessages) {
            console.log(
              `[MonitorMessages] Processing dead-lettered message ${msg.messageId} in ${deadLetterPath} with state: ${msg.state}`
            );

            // Dead-lettered messages should be marked as dead-lettered in our database
            await this.messageModel.updateOne(
              { messageId: msg.messageId }, // Match by messageId only
              {
                $set: {
                  body: msg.body,
                  queue: deadLetterPath, // Store in queue field for consistency
                  state: MessageState.DEAD_LETTERED,
                  applicationProperties: msg.applicationProperties || undefined,
                  lastUpdated: new Date(),
                },
              },
              { upsert: true }
            );
          }
        }
      } catch (error) {
        console.error(`Error monitoring queue dead letter queue ${deadLetterPath}:`, error);
        // Dead letter queue might not exist yet, that's okay
      } finally {
        if (dlqReceiver) {
          try {
            await dlqReceiver.close();
          } catch (error) {
            console.error(`Error closing DLQ receiver for ${deadLetterPath}:`, error);
          }
        }
      }
    }

    // Monitor topics and subscriptions (including dead letter queues)
    for (const topic of topics) {
      for (const subscription of topic.Subscriptions || []) {
        // Monitor active subscription
        // SDK requires "topic/Subscriptions/subscription" format for creating receivers
        const receiverPath = `${topic.Name}/Subscriptions/${subscription.Name}`;
        // But we store in MongoDB as "topic/subscription" for simplicity
        const storagePath = `${topic.Name}/${subscription.Name}`;
        console.log(`Creating receiver for topic subscription: ${receiverPath} (storing as: ${storagePath})`);

        let receiver;
        try {
          receiver = this.serviceBusClient.createReceiver(receiverPath);

          // Peek messages from the topic subscription
          const messages = await receiver.peekMessages(100, {
            fromSequenceNumber: Long.fromNumber(1),
          });

          if (messages.length > 0) {
            for (const msg of messages) {
              console.log(
                `[MonitorMessages] Processing message ${msg.messageId} in ${receiverPath} with state: ${msg.state}`
              );

              // Map Service Bus state to our MessageState enum
              let messageState: MessageState;
              const serviceBusState = msg.state?.toString().toLowerCase() || 'active';

              switch (serviceBusState) {
                case 'deferred':
                  messageState = MessageState.DEFERRED;
                  break;
                case 'scheduled':
                  messageState = MessageState.SCHEDULED;
                  break;
                case 'dead-lettered':
                case 'deadlettered':
                  messageState = MessageState.DEAD_LETTERED;
                  break;
                case 'active':
                default:
                  messageState = MessageState.ACTIVE;
                  break;
              }

              await this.messageModel.updateOne(
                { messageId: msg.messageId }, // Match by messageId only
                {
                  $set: {
                    body: msg.body,
                    queue: storagePath, // Store in queue field using simplified path
                    state: messageState, // Use the actual Service Bus state
                    applicationProperties: msg.applicationProperties || undefined,
                    lastUpdated: new Date(),
                  },
                },
                { upsert: true }
              );
            }
          }

          const ids = await this.messageModel
            .find({ queue: storagePath })
            .distinct('messageId')
            .exec();
          console.log(ids);
          const serviceBusIds = messages.map((m) => m.messageId);

          // Mark messages that are not in Service Bus as completed, but only if they were active (being processed)
          await this.messageModel
            .updateMany(
              { queue: storagePath, messageId: { $nin: serviceBusIds }, state: MessageState.ACTIVE },
              {
                $set: {
                  state: MessageState.COMPLETED,
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
              queue: storagePath,
              createdAt: { $lt: expiryThreshold },
            })
            .exec();
          console.log(
            `[MonitorMessages] Deleted ${result.deletedCount} expired messages from ${storagePath}`
          );
        } catch (error) {
          console.error(`Error monitoring topic subscription ${receiverPath}:`, error);
          // Continue with other subscriptions even if one fails
        } finally {
          if (receiver) {
            try {
              await receiver.close();
            } catch (error) {
              console.error(`Error closing receiver for ${receiverPath}:`, error);
            }
          }
        }

        // Also monitor dead letter queue for this subscription
        // SDK requires full path with "Subscriptions"
        const dlqReceiverPath = `${topic.Name}/Subscriptions/${subscription.Name}/$DeadLetterQueue`;
        // Store as simplified path
        const dlqStoragePath = `${topic.Name}/${subscription.Name}/$DeadLetterQueue`;
        console.log(`Creating receiver for dead letter queue: ${dlqReceiverPath} (storing as: ${dlqStoragePath})`);

        let dlqReceiver;
        try {
          dlqReceiver = this.serviceBusClient.createReceiver(dlqReceiverPath);

          // Peek messages from the dead letter queue
          const dlqMessages = await dlqReceiver.peekMessages(100, {
            fromSequenceNumber: Long.fromNumber(1),
          });

          if (dlqMessages.length > 0) {
            for (const msg of dlqMessages) {
              console.log(
                `[MonitorMessages] Processing dead-lettered message ${msg.messageId} in ${dlqReceiverPath} with state: ${msg.state}`
              );

              // Dead-lettered messages should be marked as dead-lettered in our database
              await this.messageModel.updateOne(
                { messageId: msg.messageId }, // Match by messageId only
                {
                  $set: {
                    body: msg.body,
                    queue: dlqStoragePath, // Store in queue field using simplified path
                    state: MessageState.DEAD_LETTERED,
                    applicationProperties: msg.applicationProperties || undefined,
                    lastUpdated: new Date(),
                  },
                },
                { upsert: true }
              );
            }
          }
        } catch (error) {
          console.error(`Error monitoring dead letter queue ${dlqReceiverPath}:`, error);
          // Dead letter queue might not exist yet, that's okay
        } finally {
          if (dlqReceiver) {
            try {
              await dlqReceiver.close();
            } catch (error) {
              console.error(`Error closing DLQ receiver for ${dlqReceiverPath}:`, error);
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
        // For topic subscriptions, use the subscription path that matches how we store them
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
        { state: 'sent' },
        { $set: { state: MessageState.ACTIVE } }
      );
      console.log(
        `[MigrateMessages] Updated ${sentResult.modifiedCount} messages from 'sent' to 'active'`
      );

      // Update old "processed" status to "completed"
      const processedResult = await this.messageModel.updateMany(
        { state: 'processed' },
        { $set: { state: MessageState.COMPLETED } }
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

      // Ensure all messages have a state field
      const noStatusResult = await this.messageModel.updateMany(
        { $or: [{ state: null }, { state: { $exists: false } }] },
        { $set: { state: MessageState.ACTIVE } }
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
          state: { $ne: MessageState.DEAD_LETTERED },
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
          state: { $ne: MessageState.DEAD_LETTERED },
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
            state: { $ne: MessageState.DEAD_LETTERED },
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
            state: MessageState.COMPLETED,
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
