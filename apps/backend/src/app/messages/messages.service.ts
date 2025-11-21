/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrackingMessage, TrackingMessageDocument } from './message.schema';

@Injectable()
export class MessageService {
  constructor(
      @InjectModel(TrackingMessage.name, 'MessageTrackingDb') // Add connection name!
    private messageModel: Model<TrackingMessageDocument>,
  ) {}

  async findTrackingMessages(): Promise<TrackingMessageDocument[]> {
    const query = this.messageModel.find().exec();
    return query;
  }

  async findOneTracking(id: string): Promise<TrackingMessageDocument | null> {
    return this.messageModel.findById(id).exec();
  }

  async createTracking(message: Partial<TrackingMessage>): Promise<TrackingMessageDocument> {
    const createdMessage = new this.messageModel(message);
    return createdMessage.save();
  }

  async updateTracking(id: string, message: Partial<TrackingMessage>): Promise<TrackingMessageDocument | null> {
    return this.messageModel.findByIdAndUpdate(id, message, { new: true }).exec();
  }

  async removeTracking(id: string): Promise<void> {
    console.log(`[MessageService] Attempting to delete tracking message with id: ${id}`);
    const result = await this.messageModel.findOneAndDelete({ messageId: id }).exec();
    console.log(`[MessageService] Delete result:`, result);
    if (!result) {
      console.warn(`[MessageService] No document found with id: ${id}`);
    }
  }
}