import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { MessageService } from './messages.service';
import { Message } from './message.schema';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessageService) {}

  @Get()
  async findAll(
    @Query('queue') queue?: string,
    @Query('topic') topic?: string,
    @Query('subscription') subscription?: string,
    @Query('maxMessages') maxMessages?: string
  ): Promise<Message[]> {
    return this.messagesService.findAll({
      queue,
      topic,
      subscription,
      maxMessages: maxMessages ? parseInt(maxMessages, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Message> {
    const result = await this.messagesService.findOne(id);
    if (result === null) {
      throw new Error('Message not found');
    }
    return result;
  }

  @Post()
  async create(@Body() message: Message): Promise<Message> {
    this.messagesService.saveReceivedMessage(message);
    return message;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() message: Message
  ): Promise<Message> {
    const doc = await this.messagesService.update(id, message);
    if (doc === null) {
      throw new Error('Message not found');
    }
    return doc;
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.messagesService.remove(id);
  }
}
