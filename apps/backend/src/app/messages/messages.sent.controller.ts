import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { MessageService } from './messages.service';
import { IServiceBusMessageDocument } from '../common/servicebus.message.schema';

// Controller for SENT messages
@Controller('messages/sent')
export class SentMessagesController {
  constructor(private readonly messagesService: MessageService) {}

  @Get()
  async findAll(
    @Query('queue') queue?: string,
    @Query('topic') topic?: string,
    @Query('subscription') subscription?: string,
    @Query('maxMessages') maxMessages?: string
  ): Promise<IServiceBusMessageDocument[]> {
    return this.messagesService.findAll('sent', {
      queue,
      topic,
      subscription,
      maxMessages: maxMessages ? parseInt(maxMessages, 10) : undefined,
    }) as Promise<IServiceBusMessageDocument[]>;
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IServiceBusMessageDocument> {
    const result = await this.messagesService.findOne('sent', id);
    if (!result) {
      throw new NotFoundException(`Sent message with ID ${id} not found`);
    }
    return result as IServiceBusMessageDocument;
  }

  @Post()
  async create(
    @Body() message: Partial<IServiceBusMessageDocument>
  ): Promise<IServiceBusMessageDocument> {
    console.log('Creating sent message:', message.body);
    return this.messagesService.create('sent', message) as Promise<IServiceBusMessageDocument>;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() message: Partial<IServiceBusMessageDocument>
  ): Promise<IServiceBusMessageDocument> {
    const doc = await this.messagesService.update('sent', id, message);
    if (!doc) {
      throw new NotFoundException(`Sent message with ID ${id} not found`);
    }
    return doc as IServiceBusMessageDocument;
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    const existing = await this.messagesService.findOne('sent', id);
    if (!existing) {
      throw new NotFoundException(`Sent message with ID ${id} not found`);
    }
    await this.messagesService.remove('sent', id);
    return { message: 'Sent message deleted successfully' };
  }
}
