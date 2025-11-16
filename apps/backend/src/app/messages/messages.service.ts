import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IServiceBusMessageDocument, IServiceBusReceivedMessageDocument } from '../common/servicebus.message.schema';
import { TrackingMessage, TrackingMessageDocument } from './message.schema';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel('ServiceBusMessage')
    private readonly sentMessageModel: Model<IServiceBusMessageDocument>,
    @InjectModel('ServiceBusReceivedMessage')
    private readonly receivedMessageModel: Model<IServiceBusReceivedMessageDocument>,
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

  async findAll(type: 'sent' | 'received', filters?: {
    queue?: string;
    topic?: string;
    subscription?: string;
    maxMessages?: number;
  }): Promise<(IServiceBusMessageDocument | IServiceBusReceivedMessageDocument)[]> {
    if (type === 'sent') {
      let query = this.sentMessageModel.find();

      if (filters) {
        const andConditions: any[] = [];
        let targetPath: string | undefined;

        if (filters.topic && filters.subscription) {
          targetPath = `${filters.topic}/${filters.subscription}`;
        } else if (filters.queue) {
          targetPath = filters.queue;
        } else if (filters.topic) {
          targetPath = filters.topic;
        }

        if (targetPath) {
          andConditions.push({
            $or: [
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
          query = query.where({ $and: andConditions } as any);
        }

        if (filters.maxMessages) {
          query = query.limit(filters.maxMessages);
        }
      }

      return query.sort({ createdAt: -1 }).exec();
    } else {
      let query = this.receivedMessageModel.find();

      if (filters) {
        const andConditions: any[] = [];
        let targetPath: string | undefined;

        if (filters.topic && filters.subscription) {
          targetPath = `${filters.topic}/${filters.subscription}`;
        } else if (filters.queue) {
          targetPath = filters.queue;
        } else if (filters.topic) {
          targetPath = filters.topic;
        }

        if (targetPath) {
          andConditions.push({
            $or: [
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
          query = query.where({ $and: andConditions } as any);
        }

        if (filters.maxMessages) {
          query = query.limit(filters.maxMessages);
        }
      }

      return query.sort({ createdAt: -1 }).exec();
    }
  }

  async findOne(type: 'sent' | 'received', id: string): Promise<IServiceBusMessageDocument | IServiceBusReceivedMessageDocument | null> {
    if (type === 'sent') {
      return this.sentMessageModel.findById(id).exec();
    } else {
      return this.receivedMessageModel.findById(id).exec();
    }
  }

  async create(type: 'sent' | 'received', message: Partial<IServiceBusMessageDocument | IServiceBusReceivedMessageDocument>): Promise<IServiceBusMessageDocument | IServiceBusReceivedMessageDocument> {
    if (type === 'sent') {
      const createdMessage = new this.sentMessageModel(message);
      return createdMessage.save();
    } else {
      const createdMessage = new this.receivedMessageModel(message);
      return createdMessage.save();
    }
  }

  async update(type: 'sent' | 'received', id: string, message: Partial<IServiceBusMessageDocument | IServiceBusReceivedMessageDocument>): Promise<IServiceBusMessageDocument | IServiceBusReceivedMessageDocument | null> {
    if (type === 'sent') {
      return this.sentMessageModel.findByIdAndUpdate(id, message, { new: true }).exec();
    } else {
      return this.receivedMessageModel.findByIdAndUpdate(id, message, { new: true }).exec();
    }
  }

  async remove(type: 'sent' | 'received', id: string): Promise<void> {
    if (type === 'sent') {
      await this.sentMessageModel.findByIdAndDelete(id).exec();
    } else {
      await this.receivedMessageModel.findByIdAndDelete(id).exec();
    }
  }

  async migrateOldMessages(): Promise<void> {
    // Migration logic for old messages
    console.log('[MessageService] Running migration for old messages...');
    // Add migration logic here if needed
  }
}