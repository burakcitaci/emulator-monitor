// message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  // ==================== Identifiers ====================
  @Prop({ required: true, index: true })
  messageId?: string;

  @Prop({ index: true })
  queue?: string; // Storage path: "queueName" or "topicName/subscriptionName"

  @Prop({ index: true })
  topic?: string; // Original topic name (for topic subscriptions)

  @Prop({ index: true })
  subscription?: string; // Original subscription name (for topic subscriptions)

  // ==================== Message Content ====================
  @Prop({ type: Object })
  body?: any;

  @Prop({ type: Object })
  applicationProperties?: Record<string, any>;

  @Prop()
  contentType?: string;

  @Prop()
  subject?: string;

  @Prop()
  to?: string;

  @Prop()
  replyTo?: string;

  @Prop()
  correlationId?: string;

  @Prop()
  sessionId?: string;

  @Prop()
  partitionKey?: string;

  // ==================== State & Lifecycle ====================
  @Prop({ 
    type: String, 
    enum: Object.values(MessageState), 
    default: MessageState.ACTIVE,
    index: true 
  })
  state?: MessageState;

  @Prop()
  enqueuedTimeUtc?: Date; // When message was enqueued in Service Bus

  @Prop()
  scheduledEnqueueTimeUtc?: Date; // For scheduled messages

  @Prop()
  expiresAtUtc?: Date; // When message will expire

  @Prop()
  completedAt?: Date; // When marked as completed (no longer in Service Bus)

  @Prop()
  expiredAt?: Date; // When message TTL expired

  @Prop()
  verifiedAt?: Date; // When immediately verified after send (for UI tracking)

  // ==================== Service Bus Metadata ====================
  @Prop()
  sequenceNumber?: number; // Service Bus sequence number

  @Prop()
  deliveryCount?: number; // Current delivery attempt count

  @Prop()
  maxDeliveryCount?: number; // Max delivery count from config

  @Prop()
  timeToLive?: number; // Message-specific TTL in milliseconds

  @Prop()
  lockToken?: string; // Lock token for receiver

  // ==================== Dead Letter Information ====================
  @Prop()
  deadLetterReason?: string; // Why message was dead-lettered

  @Prop()
  deadLetterErrorDescription?: string; // Detailed error description

  @Prop()
  deadLetteredAt?: Date; // When we detected message in DLQ

  // ==================== Timestamps ====================
  @Prop()
  createdAt?: Date; // When record was created in MongoDB

  @Prop()
  lastUpdated?: Date; // Last time record was updated

  @Prop()
  lastSeenAt?: Date; // Last time message was seen in Service Bus

  // ==================== Additional Metadata ====================
  @Prop()
  sentViaUI?: boolean; // Flag for messages sent through UI (for tracking)

  @Prop({ type: [{ state: String, timestamp: Date, reason: String }] })
  stateHistory?: Array<{
    state: MessageState;
    timestamp: Date;
    reason?: string;
  }>; // Track state transitions over time
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Add indexes for common queries
MessageSchema.index({ messageId: 1 });
MessageSchema.index({ queue: 1, state: 1 });
MessageSchema.index({ state: 1, lastUpdated: 1 });
MessageSchema.index({ enqueuedTimeUtc: 1 });
MessageSchema.index({ createdAt: 1 });
MessageSchema.index({ topic: 1, subscription: 1 });
MessageSchema.index({ deliveryCount: 1, maxDeliveryCount: 1 });