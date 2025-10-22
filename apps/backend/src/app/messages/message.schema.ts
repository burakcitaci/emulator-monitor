// message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

/**
 * Azure Service Bus Message Status
 * Tracks the processing status of a message
 */
export enum MessageStatus {
  ACTIVE = 'active', // Message is available for processing
  DEFERRED = 'deferred', // Message processing postponed
  SCHEDULED = 'scheduled', // Message scheduled for future delivery
  DEAD_LETTERED = 'dead-lettered', // Message moved to Dead Letter Queue
  COMPLETED = 'completed', // Message successfully processed
  ABANDONED = 'abandoned', // Message processing failed, returned to queue
  RECEIVED = 'received', // Message received but not yet completed
}

/**
 * Azure Service Bus Message State
 * The actual state of the message in Service Bus
 */
export enum MessageState {
  ACTIVE = 'active',
  DEFERRED = 'deferred',
  SCHEDULED = 'scheduled',
  DEAD_LETTERED = 'dead-lettered',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class Message {
  // Arbitrary message body. Use Mixed for flexibility, 'unknown' for type-safety.
  @Prop({ required: true, type: MongooseSchema.Types.Mixed })
  body: any;

  // Message identifier, index for faster lookup.
  @Prop({ type: MongooseSchema.Types.Mixed, index: true }) // ← allows string | number | anything
  messageId?: string | number;

  @Prop({ type: String })
  contentType?: string;

  // Correlation identifier, index for faster correlation queries.
  @Prop({ type: MongooseSchema.Types.Mixed, index: true })
  correlationId?: string | number;

  @Prop({ type: String })
  partitionKey?: string;

  @Prop({ type: String })
  sessionId?: string;

  @Prop({ type: String })
  replyToSessionId?: string;

  @Prop({ type: Number })
  timeToLive?: number;

  @Prop({ type: String })
  subject?: string;

  @Prop({ type: String })
  to?: string;

  @Prop({ type: String })
  replyTo?: string;

  @Prop({ type: Date })
  scheduledEnqueueTimeUtc?: Date;

  // Application properties as a Map with Mixed values.
  @Prop({ type: Map, of: MongooseSchema.Types.Mixed })
  applicationProperties?: Map<string, string | number | boolean | Date | null>;

  @Prop({
    type: String,
    enum: ['active', 'deferred', 'scheduled', 'dead-lettered', 'completed'],
    index: true, // Index for faster queries on state
  })
  state?: 'active' | 'deferred' | 'scheduled' | 'dead-lettered' | 'completed';

  @Prop({ type: Number })
  sequenceNumber?: number;

  @Prop({ type: String })
  queue?: string;

  @Prop({ type: Date })
  enqueuedTimeUtc?: Date;

  @Prop({ type: Date })
  lastUpdated?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  rawAmqpMessage?: Record<string, unknown>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index(
  { enqueuedTimeUtc: 1 },
  { expireAfterSeconds: 30 } // PT1H = 1 hour
);
