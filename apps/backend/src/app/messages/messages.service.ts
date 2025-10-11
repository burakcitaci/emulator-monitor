// service-bus-message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageDocument, Message } from './message.schema';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>
  ) {}

  // CRUD operations
  async findAll(filters?: {
    queue?: string;
    topic?: string;
    subscription?: string;
    maxMessages?: number;
  }): Promise<MessageDocument[]> {
    let query = this.messageModel.find();

    if (filters) {
      const conditions: Record<string, unknown> = {};

      // Filter by queue
      if (filters.queue) {
        conditions.$or = [
          { to: filters.queue },
          { 'applicationProperties.queue': filters.queue },
        ];
      }

      // Filter by topic
      if (filters.topic) {
        conditions.$or = [
          { to: filters.topic },
          { 'applicationProperties.topic': filters.topic },
        ];
      }

      // Filter by subscription
      if (filters.subscription) {
        conditions['applicationProperties.subscription'] = filters.subscription;
      }

      if (Object.keys(conditions).length > 0) {
        query = query.where(conditions);
      }

      // Limit results
      if (filters.maxMessages) {
        query = query.limit(filters.maxMessages);
      }
    }

    return query.lean<MessageDocument[]>();
  }

  async findOne(id: string): Promise<MessageDocument | null> {
    return this.messageModel
      .findById(id)
      .exec() as Promise<MessageDocument | null>;
  }

  async saveReceivedMessage(msg: Partial<Message>) {
    this.messageModel.create(msg);
  }

  async remove(id: string): Promise<void> {
    await this.messageModel.findByIdAndDelete(id).exec();
  }

  async update(
    id: string,
    msg: Partial<Message>
  ): Promise<MessageDocument | null> {
    return this.messageModel
      .findByIdAndUpdate(id, msg, { new: true })
      .exec() as Promise<MessageDocument | null>;
  }
}
