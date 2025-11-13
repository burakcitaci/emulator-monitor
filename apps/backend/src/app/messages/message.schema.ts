import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TrackingMessageDocument = TrackingMessage & Document;

@Schema({ collection: 'Messages', timestamps: true })
export class TrackingMessage {
  @Prop({ type: Types.ObjectId, auto: true })
  _id?: Types.ObjectId;
  
  @Prop({ required: true })
  messageId?: string;

  @Prop({ required: true })
  body?: string;

  @Prop({ required: true })
  sentBy?: string;

  @Prop({ required: true })
  sentAt?: Date;

  @Prop()
  receivedBy?: string;

  @Prop()
  receivedAt?: Date;

  @Prop({ required: true, enum: ['sent', 'received'], default: 'sent' })
  status?: string;
}


export const TrackingMessageSchema = SchemaFactory.createForClass(TrackingMessage);
