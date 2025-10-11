// message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({
    required: true,
    enum: [
      'sent', // Just sent to Service Bus
      'in-queue', // Confirmed in queue via peek
      'processing', // Disappeared from peek (likely being processed)
      'completed', // Not in queue or DLQ (successful)
      'dead-lettered', // Found in DLQ
      'timeout', // Too old, assume lost
    ],
    default: 'sent',
  })
  status?: string;

  // Arbitrary message body. Use Mixed for flexibility, 'unknown' for type-safety.
  @Prop({ required: true, type: MongooseSchema.Types.Mixed })
  body: unknown;

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

  @Prop({ type: String, enum: ['active', 'deferred', 'scheduled'] })
  state?: 'active' | 'deferred' | 'scheduled';

  @Prop({ type: MongooseSchema.Types.Mixed })
  rawAmqpMessage?: Record<string, unknown>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
