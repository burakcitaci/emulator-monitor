import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrackingMessage, TrackingMessageDocument } from './message.schema';
import { AppLogger } from '../common/logger.service';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(TrackingMessage.name, 'MessageTrackingDb')
    private readonly messageModel: Model<TrackingMessageDocument>,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(MessageService.name);
  }

  async findTrackingMessages(): Promise<TrackingMessage[]> {
    return this.messageModel.find().sort({ sentAt: -1 }).lean().exec();
  }

  async findOneTracking(id: string): Promise<TrackingMessage | null> {
    return this.messageModel.findById(id).lean().exec();
  }

  async findOneTrackingByMessageId(messageId: string): Promise<TrackingMessage | null> {
    return this.messageModel.findOne({ messageId }).lean().exec();
  }

  async createTracking(message: Partial<TrackingMessage>): Promise<TrackingMessageDocument> {
    const createdMessage = new this.messageModel(message);
    this.logger.log(`Creating tracking entry for ${message.messageId}`);
    return createdMessage.save();
  }

  async updateTracking(id: string, message: Partial<TrackingMessage>): Promise<TrackingMessage | null> {
    return this.messageModel
      .findByIdAndUpdate(id, { ...message, updatedAt: new Date() }, { new: true })
      .lean()
      .exec();
  }

  async removeTracking(id: string): Promise<void> {
    const result = await this.messageModel.findOneAndDelete({ messageId: id }).exec();
    if (!result) {
      this.logger.warn(`No tracking document found with id ${id}`);
    } else {
      this.logger.log(`Removed tracking document ${id}`);
    }
  }

  async markMessageReceived(messageId: string, receivedBy?: string): Promise<TrackingMessage | null> {
    const update = await this.messageModel
      .findOneAndUpdate(
        { messageId },
        {
          status: 'received',
          receivedAt: new Date(),
          receivedBy: receivedBy ?? 'service-bus-worker',
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!update) {
      this.logger.warn(`No tracking document found for received message ${messageId}`);
    } else {
      this.logger.log(`Marked message ${messageId} as received`);
    }

    return update as unknown as TrackingMessage | null;
  }

  async updateDisposition(messageId: string, disposition: string): Promise<TrackingMessage | null> {
    const update = await this.messageModel
      .findOneAndUpdate(
        { messageId },
        {
          $set: {
            disposition,
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!update) {
      this.logger.warn(`No tracking document found for message ${messageId} to update disposition`);
    } else {
      this.logger.log(`Updated disposition for message ${messageId} to ${disposition}. Current document: ${JSON.stringify({ disposition: update.disposition, status: update.status })}`);
    }

    return update as unknown as TrackingMessage | null;
  }
}