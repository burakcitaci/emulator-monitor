// service-bus-message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageDocument, Message } from './message.schema';
import { ServiceBusMessage } from '@azure/service-bus';
import { mapToDocument } from './messages.mapper';

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>
  ) {}

  // message.service.ts
  async saveReceivedMessage(msg: Partial<Message>): Promise<MessageDocument> {
    const doc = new this.messageModel(msg);
    return doc.save();
  }

  async findAll(): Promise<MessageDocument[]> {
    return this.messageModel.find().exec();
  }
}
