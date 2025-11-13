/**
 * Service Bus Message Schema & Models
 *
 * This module defines two separate MongoDB collections for Service Bus messages:
 * 1. service_bus_messages - Sent messages (created when a message is published to Service Bus)
 * 2. service_bus_received_messages - Received messages (monitored from queues and topic subscriptions)
 *
 * Separation rationale:
 * - Different lifecycle: sent messages are transient, received messages are monitored
 * - Different fields: received messages have delivery count, dead-letter info, etc.
 * - Different access patterns: monitoring system polls received messages continuously
 *
 * Both collections share a base schema with message properties but have different indexes
 * and metadata to support their distinct operational purposes.
 */

import { Schema, model, Document } from 'mongoose';
import { ServiceBusMessage, ServiceBusReceivedMessage } from '@azure/service-bus';

/**
 * Message state enumeration for tracking lifecycle of received messages
 */
export enum MessageState {
  ACTIVE = 'active',
  SCHEDULED = 'scheduled',
  DEFERRED = 'deferred',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  DEAD_LETTERED = 'dead-lettered',
  ABANDONED = 'abandoned',
  RECEIVED = 'received',
}

/**
 * MongoDB document interface for ServiceBusMessage
 */
export interface IServiceBusMessageDocument extends Document {
  body: any;
  messageId?: string | number | Buffer;
  contentType?: string;
  correlationId?: string | number | Buffer;
  partitionKey?: string;
  sessionId?: string;
  replyToSessionId?: string;
  timeToLive?: number;
  subject?: string;
  to?: string;
  replyTo?: string;
  scheduledEnqueueTimeUtc?: Date;
  applicationProperties?: Map<string, number | boolean | string | Date | null>;
  // Audit fields
  createdAt?: Date;
  updatedAt?: Date;
  // Sent message specific fields
  sentBy?: string;
  sentAt?: Date;
}

/**
 * MongoDB document interface for ServiceBusReceivedMessage
 * Based on Azure SDK's ServiceBusReceivedMessage interface
 *
 * Represents messages received/monitored from Service Bus queues and topic subscriptions.
 * Tracked separately from sent messages to maintain message lifecycle integrity.
 */
export interface IServiceBusReceivedMessageDocument extends IServiceBusMessageDocument {
  // Received message specific properties (all readonly in SDK)
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
  lockToken?: string;
  deliveryCount?: number;
  enqueuedTimeUtc?: Date;
  expiresAtUtc?: Date;
  lockedUntilUtc?: Date;
  enqueuedSequenceNumber?: number;
  sequenceNumber?: string; // Stored as string to preserve Long (64-bit) values
  deadLetterSource?: string;
  state: MessageState;
  rawAmqpMessage?: any; // Stored as _rawAmqpMessage in SDK

  // Additional monitoring fields
  queue?: string;
  topic?: string;
  subscription?: string;
  maxDeliveryCount?: number;
  timeToLive?: number;
  lastUpdated?: Date;
  lastSeenAt?: Date;
  sentBy?: string;
  receivedBy?: string; // Fixed typo: recievedBy → receivedBy
  sentAt?: Date;
  receivedAt?: Date; // Fixed typo: recievedAt → receivedAt
  deadLetteredAt?: Date;
  expiredAt?: Date;
  completedAt?: Date;
}

/**
 * Base schema definition for ServiceBusMessage
 */
const baseSchemaDefinition = {
  body: {
    type: Schema.Types.Mixed,
    required: true,
  },
  messageId: {
    type: Schema.Types.Mixed,
    index: true,
  },
  contentType: {
    type: String,
    maxlength: 255,
  },
  correlationId: {
    type: Schema.Types.Mixed,
    index: true,
  },
  partitionKey: {
    type: String,
    maxlength: 128,
  },
  sessionId: {
    type: String,
    maxlength: 128,
    index: true,
  },
  replyToSessionId: {
    type: String,
    maxlength: 128,
  },
  timeToLive: {
    type: Number,
    min: 0,
  },
  subject: {
    type: String,
    maxlength: 255,
  },
  to: {
    type: String,
    maxlength: 255,
  },
  replyTo: {
    type: String,
    maxlength: 255,
  },
  scheduledEnqueueTimeUtc: {
    type: Date,
  },
  applicationProperties: {
    type: Map,
    of: Schema.Types.Mixed,
  },
  // Sent message specific fields
  sentBy: {
    type: String,
    maxlength: 255,
  },
  sentAt: {
    type: Date,
  },
};

/**
 * Mongoose schema for ServiceBusMessage
 */
const ServiceBusMessageSchema = new Schema<IServiceBusMessageDocument>(
  baseSchemaDefinition,
  {
    timestamps: true,
    collection: 'service_bus_messages',
  }
);

// Indexes for common query patterns
ServiceBusMessageSchema.index({ createdAt: -1 });
ServiceBusMessageSchema.index({ scheduledEnqueueTimeUtc: 1 }, { sparse: true });

/**
 * Mongoose schema for ServiceBusReceivedMessage
 * Based on Azure SDK's ServiceBusReceivedMessage interface
 */
const ServiceBusReceivedMessageSchema = new Schema<IServiceBusReceivedMessageDocument>(
  {
    ...baseSchemaDefinition,
    // Received message specific fields
    deadLetterReason: {
      type: String,
      maxlength: 4096,
    },
    deadLetterErrorDescription: {
      type: String,
      maxlength: 4096,
    },
    lockToken: {
      type: String,
      index: true,
      unique: false, // Lock tokens can change on redelivery
    },
    deliveryCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    enqueuedTimeUtc: {
      type: Date,
      index: true,
    },
    expiresAtUtc: {
      type: Date,
      index: true,
    },
    lockedUntilUtc: {
      type: Date,
    },
    enqueuedSequenceNumber: {
      type: Number,
    },
    sequenceNumber: {
      type: String, // Store as string to handle Long (64-bit) values safely
      index: true,
      // unique: true, // Sequence numbers are unique per message - removed for now to debug
    },
    deadLetterSource: {
      type: String,
      maxlength: 255,
    },
    state: {
      type: String,
      enum: Object.values(MessageState),
      required: true,
      default: MessageState.ACTIVE,
      index: true,
    },
    rawAmqpMessage: {
      type: Schema.Types.Mixed,
    },
    // Additional monitoring fields
    queue: {
      type: String,
      maxlength: 255,
    },
    topic: {
      type: String,
      maxlength: 255,
    },
    subscription: {
      type: String,
      maxlength: 255,
    },
    maxDeliveryCount: {
      type: Number,
      min: 0,
    },
    timeToLive: {
      type: Number,
      min: 0,
    },
    lastUpdated: {
      type: Date,
    },
    lastSeenAt: {
      type: Date,
    },
    sentBy: {
      type: String,
      maxlength: 255,
    },
    receivedBy: {
      type: String,
      maxlength: 255,
    },
    sentAt: {
      type: Date,
    },
    receivedAt: {
      type: Date,
    },
    deadLetteredAt: {
      type: Date,
    },
    expiredAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'service_bus_received_messages',
  }
);

// Base indexes
ServiceBusReceivedMessageSchema.index({ createdAt: -1 });
ServiceBusReceivedMessageSchema.index({ scheduledEnqueueTimeUtc: 1 }, { sparse: true });

// Additional indexes for received messages
// Indexes for filtering and sorting received messages by state and time
ServiceBusReceivedMessageSchema.index({ state: 1, enqueuedTimeUtc: -1 });
// Index for messages with high delivery counts (retry tracking)
ServiceBusReceivedMessageSchema.index({ deliveryCount: 1 });
// Index for dead-letter reason filtering
ServiceBusReceivedMessageSchema.index({ deadLetterReason: 1 }, { sparse: true });
// Index for expiration tracking
ServiceBusReceivedMessageSchema.index({ expiresAtUtc: 1 }, { sparse: true });
// Compound index for unique message identification per queue/topic
ServiceBusReceivedMessageSchema.index({ queue: 1, sequenceNumber: 1 });
// Index for message lookups by ID and sequence
ServiceBusReceivedMessageSchema.index({ messageId: 1, sequenceNumber: 1 });

// Pre-save hook to calculate expiresAtUtc if not set
ServiceBusReceivedMessageSchema.pre('save', function (next) {
  if (this.enqueuedTimeUtc && this.timeToLive && !this.expiresAtUtc) {
    this.expiresAtUtc = new Date(
      this.enqueuedTimeUtc.getTime() + this.timeToLive
    );
  }
  next();
});

// Export the schemas
export { ServiceBusMessageSchema, ServiceBusReceivedMessageSchema };

// Export separate models
export const ServiceBusMessageModel = model<IServiceBusMessageDocument>(
  'ServiceBusMessage',
  ServiceBusMessageSchema
);

export const ServiceBusReceivedMessageModel = model<IServiceBusReceivedMessageDocument>(
  'ServiceBusReceivedMessage',
  ServiceBusReceivedMessageSchema
);

/**
 * Converts Azure ServiceBusReceivedMessage to MongoDB document
 */
export function convertServiceBusReceivedMessageToDocument(
  message: ServiceBusReceivedMessage,
  additionalFields?: {
    queue?: string;
    topic?: string;
    subscription?: string;
    maxDeliveryCount?: number;
    timeToLive?: number;
    sentBy?: string;
    receivedBy?: string;
    sentAt?: Date;
    receivedAt?: Date;
    deadLetteredAt?: Date;
  }
): Partial<IServiceBusReceivedMessageDocument> {
  // Convert applicationProperties to Map if it exists
  const appProps = message.applicationProperties
    ? new Map(Object.entries(message.applicationProperties))
    : undefined;

  // Extract additional properties from message body if present
  const bodyObj =
    typeof message.body === 'object' && message.body !== null
      ? (message.body as any)
      : {};
  const sentBy = bodyObj.sentBy || additionalFields?.sentBy;
  const receivedBy = bodyObj.receivedBy || additionalFields?.receivedBy;
  const sentAt = bodyObj.sentAt ? new Date(bodyObj.sentAt) : additionalFields?.sentAt;
  const receivedAt = bodyObj.receivedAt ? new Date(bodyObj.receivedAt) : additionalFields?.receivedAt;

  return {
    // Base message properties
    body: message.body,
    messageId: message.messageId,
    contentType: message.contentType,
    correlationId: message.correlationId,
    partitionKey: message.partitionKey,
    sessionId: message.sessionId,
    replyToSessionId: message.replyToSessionId,
    timeToLive: additionalFields?.timeToLive,
    subject: message.subject,
    to: message.to,
    replyTo: message.replyTo,
    scheduledEnqueueTimeUtc: message.scheduledEnqueueTimeUtc,
    applicationProperties: appProps,

    // Received message specific properties
    deadLetterReason: message.deadLetterReason,
    deadLetterErrorDescription: message.deadLetterErrorDescription,
    lockToken: message.lockToken,
    deliveryCount: message.deliveryCount,
    enqueuedTimeUtc: message.enqueuedTimeUtc,
    expiresAtUtc: message.expiresAtUtc,
    lockedUntilUtc: message.lockedUntilUtc,
    enqueuedSequenceNumber: message.enqueuedSequenceNumber,

    // Convert Long to string for sequenceNumber
    sequenceNumber: message.sequenceNumber?.toString(),

    deadLetterSource: message.deadLetterSource,
    state: MessageState.ACTIVE,

    // Store raw AMQP message (note: _rawAmqpMessage in SDK, rawAmqpMessage in DB)
    rawAmqpMessage: message._rawAmqpMessage,

    // Additional monitoring fields
    queue: additionalFields?.queue,
    topic: additionalFields?.topic,
    subscription: additionalFields?.subscription,
    maxDeliveryCount: additionalFields?.maxDeliveryCount,
    lastUpdated: new Date(),
    lastSeenAt: new Date(),
    sentBy,
    receivedBy,
    sentAt,
    receivedAt,
    deadLetteredAt: additionalFields?.deadLetteredAt,
  };
}

/**
 * Converts Azure ServiceBusMessage to MongoDB document
 */
export function convertServiceBusMessageToDocument(
  message: ServiceBusMessage
): Partial<IServiceBusMessageDocument> {
  const appProps = message.applicationProperties
    ? new Map(Object.entries(message.applicationProperties))
    : undefined;

  return {
    body: message.body,
    messageId: message.messageId,
    contentType: message.contentType,
    correlationId: message.correlationId,
    partitionKey: message.partitionKey,
    sessionId: message.sessionId,
    replyToSessionId: message.replyToSessionId,
    timeToLive: message.timeToLive,
    subject: message.subject,
    to: message.to,
    replyTo: message.replyTo,
    scheduledEnqueueTimeUtc: message.scheduledEnqueueTimeUtc,
    applicationProperties: appProps,
  };
}

// Example usage:
/*
import {
  ServiceBusReceivedMessageModel,
  convertServiceBusReceivedMessageToDocument
} from './serviceBusMessageSchema';

// In your monitorQueue method:
const messages = await this.peekAllMessages(receiver);

if (messages && messages.length > 0) {
  console.log(`[MonitorQueue] Peeked ${messages.length} messages`);

  // Convert SDK messages to MongoDB documents
  const mongoDocuments = messages.map(msg =>
    convertServiceBusReceivedMessageToDocument(msg)
  );

  // Upsert to avoid duplicates (using sequenceNumber as unique key)
  const bulkOps = mongoDocuments.map(doc => ({
    updateOne: {
      filter: { sequenceNumber: doc.sequenceNumber },
      update: {
        $set: doc,
        $setOnInsert: { createdAt: new Date() }
      },
      upsert: true
    }
  }));

  try {
    const result = await ServiceBusReceivedMessageModel.bulkWrite(bulkOps, {
      ordered: false
    });

    console.log(`[MonitorQueue] Upserted ${result.upsertedCount} new messages, modified ${result.modifiedCount}`);
  } catch (error: any) {
    console.error('[MonitorQueue] Error persisting messages:', error.message);
    throw error;
  }
}

// Query examples:
// Active messages
const activeMessages = await ServiceBusReceivedMessageModel.find({
  state: 'active'
}).exec();

// Messages about to expire
const expiringMessages = await ServiceBusReceivedMessageModel.find({
  expiresAtUtc: { $lt: new Date(Date.now() + 3600000) }
}).exec();

// Dead-lettered messages
const deadLettered = await ServiceBusReceivedMessageModel.find({
  deadLetterReason: { $exists: true }
}).exec();

// High delivery count messages
const retriedMessages = await ServiceBusReceivedMessageModel.find({
  deliveryCount: { $gte: 3 }
}).exec();
*/
