// message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, type: Object })
  body: any;

  @Prop()
  messageId?: string | number;

  @Prop()
  contentType?: string;

  @Prop()
  correlationId?: string | number;

  @Prop()
  partitionKey?: string;

  @Prop()
  sessionId?: string;

  @Prop()
  replyToSessionId?: string;

  @Prop()
  timeToLive?: number;

  @Prop()
  subject?: string;

  @Prop()
  to?: string;

  @Prop()
  replyTo?: string;

  @Prop()
  scheduledEnqueueTimeUtc?: Date;

  @Prop({ type: Object })
  applicationProperties?: Record<
    string,
    string | number | boolean | Date | null
  >;
  @Prop()
  state?: 'active' | 'deferred' | 'scheduled';

  @Prop({ type: Object })
  rawAmqpMessage?: Record<string, any>;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
