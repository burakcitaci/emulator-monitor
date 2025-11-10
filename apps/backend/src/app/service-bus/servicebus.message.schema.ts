import { Schema, model, Document } from 'mongoose';

/**
 * MongoDB document interface extending ServiceBusMessage
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
}

/**
 * MongoDB document interface for ServiceBusReceivedMessage
 * Extends ServiceBusMessage with additional received message properties
 */
export interface IServiceBusReceivedMessageDocument extends IServiceBusMessageDocument {
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
  state: 'active' | 'deferred' | 'scheduled';
  rawAmqpMessage?: any;
}

/**
 * Mongoose schema for ServiceBusMessage
 */
const ServiceBusMessageSchema = new Schema<IServiceBusMessageDocument>(
  {
    body: {
      type: Schema.Types.Mixed,
      required: true,
    },
    messageId: {
      type: Schema.Types.Mixed, // Supports string, number, or Buffer
      index: true,
    },
    contentType: {
      type: String,
      maxlength: 255,
    },
    correlationId: {
      type: Schema.Types.Mixed, // Supports string, number, or Buffer
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
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'service_bus_messages',
    discriminatorKey: 'messageType', // Enable discriminator pattern
  }
);

// Indexes for common query patterns
ServiceBusMessageSchema.index({ createdAt: -1 });
ServiceBusMessageSchema.index({ scheduledEnqueueTimeUtc: 1 }, { sparse: true });

/**
 * Mongoose schema for ServiceBusReceivedMessage
 * Extends the base ServiceBusMessage schema
 */
const ServiceBusReceivedMessageSchema = new Schema<IServiceBusReceivedMessageDocument>(
  {
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
    },
    deadLetterSource: {
      type: String,
      maxlength: 255,
    },
    state: {
      type: String,
      enum: ['active', 'deferred', 'scheduled'],
      required: true,
      default: 'active',
      index: true,
    },
    rawAmqpMessage: {
      type: Schema.Types.Mixed,
    },
  },
  {
    _id: false, // Don't create separate _id for discriminator fields
  }
);

// Additional indexes for received messages
ServiceBusReceivedMessageSchema.index({ state: 1, enqueuedTimeUtc: -1 });
ServiceBusReceivedMessageSchema.index({ deliveryCount: 1 });
ServiceBusReceivedMessageSchema.index({ deadLetterReason: 1 }, { sparse: true });
ServiceBusReceivedMessageSchema.index({ expiresAtUtc: 1 }, { sparse: true });

// Pre-save hook to calculate expiresAtUtc if not set
ServiceBusReceivedMessageSchema.pre('save', function (next) {
  if (this.enqueuedTimeUtc && this.timeToLive && !this.expiresAtUtc) {
    this.expiresAtUtc = new Date(
      this.enqueuedTimeUtc.getTime() + this.timeToLive
    );
  }
  next();
});

// Export the schema and base model
export { ServiceBusMessageSchema, ServiceBusReceivedMessageSchema };

export const ServiceBusMessageModel = model<IServiceBusMessageDocument>(
  'ServiceBusMessage',
  ServiceBusMessageSchema
);

// Export the discriminator model for received messages
export const ServiceBusReceivedMessageModel = ServiceBusMessageModel.discriminator<IServiceBusReceivedMessageDocument>(
  'ServiceBusReceivedMessage',
  ServiceBusReceivedMessageSchema
);

// Helper utilities for Long type conversion
export const LongHelper = {
  /**
   * Convert Long to string for MongoDB storage
   * @param long - Long value or compatible type
   * @returns String representation or undefined
   */
  toString(long: any): string | undefined {
    if (!long) return undefined;
    return typeof long.toString === 'function' ? long.toString() : String(long);
  },

  /**
   * Convert string from MongoDB back to Long
   * Requires 'long' package: import Long from 'long'
   * @param str - String representation of Long
   * @returns Long instance or undefined
   */
  fromString(str: string | undefined | null): any {
    if (!str) return undefined;
    // Return string as-is; caller should convert to Long if needed
    // Example: Long.fromString(str)
    return str;
  },
};

// Example usage:
/*
import { 
  ServiceBusMessageModel, 
  ServiceBusReceivedMessageModel,
  LongHelper 
} from './serviceBusMessageSchema';
import Long from 'long';

// Create a basic message
const message = new ServiceBusMessageModel({
  body: { text: 'Hello World' },
  messageId: '12345',
  contentType: 'application/json',
  subject: 'Test Message',
  applicationProperties: new Map([
    ['priority', 1],
    ['source', 'api'],
  ]),
});
await message.save();

// Create a received message with all properties
const receivedMessage = new ServiceBusReceivedMessageModel({
  body: { data: 'Received data' },
  messageId: '67890',
  contentType: 'application/json',
  lockToken: 'abc-def-123',
  deliveryCount: 1,
  enqueuedTimeUtc: new Date(),
  sequenceNumber: LongHelper.toString(Long.fromNumber(12345678901234)),
  state: 'active',
  timeToLive: 60000, // Will auto-calculate expiresAtUtc
  applicationProperties: new Map([
    ['priority', 1],
    ['source', 'servicebus'],
  ]),
});
await receivedMessage.save();

// Query received messages by state
const activeMessages = await ServiceBusReceivedMessageModel.find({
  state: 'active'
}).exec();

// Query messages about to expire
const expiringMessages = await ServiceBusReceivedMessageModel.find({
  expiresAtUtc: { $lt: new Date(Date.now() + 3600000) } // Within 1 hour
}).exec();

// Query dead-lettered messages
const deadLettered = await ServiceBusReceivedMessageModel.find({
  deadLetterReason: { $exists: true }
}).exec();

// Query messages by delivery count
const retriedMessages = await ServiceBusReceivedMessageModel.find({
  deliveryCount: { $gte: 3 }
}).exec();

// Retrieve and convert sequence number back to Long
const msg = await ServiceBusReceivedMessageModel.findOne({ messageId: '67890' });
if (msg && msg.sequenceNumber) {
  const seqNum = Long.fromString(msg.sequenceNumber);
  console.log('Sequence Number as Long:', seqNum);
}
*/