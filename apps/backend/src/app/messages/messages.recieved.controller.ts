import { Controller, Get, Param, NotFoundException, Post, Body, Put, Delete, Query } from "@nestjs/common";

import { IServiceBusReceivedMessageDocument } from "../common/servicebus.message.schema";
import { MessageService } from "./messages.service";

@Controller('messages/received')
export class ReceivedMessagesController {
  constructor(private readonly messagesService: MessageService) {}

  @Get()
  async findAll(
    @Query('queue') queue?: string,
    @Query('topic') topic?: string,
    @Query('subscription') subscription?: string,
    @Query('maxMessages') maxMessages?: string
  ): Promise<IServiceBusReceivedMessageDocument[]> {
    return this.messagesService.findAll('received', {
      queue,
      topic,
      subscription,
      maxMessages: maxMessages ? parseInt(maxMessages, 10) : undefined,
    }) as Promise<IServiceBusReceivedMessageDocument[]>;
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<IServiceBusReceivedMessageDocument> {
    const result = await this.messagesService.findOne('received', id);
    if (!result) {
      throw new NotFoundException(`Received message with ID ${id} not found`);
    }
    return result as IServiceBusReceivedMessageDocument;
  }

  @Post()
  async create(
    @Body() message: Partial<IServiceBusReceivedMessageDocument>
  ): Promise<IServiceBusReceivedMessageDocument> {
    console.log('Creating received message:', message.body);
    return this.messagesService.create('received', message) as Promise<IServiceBusReceivedMessageDocument>;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() message: Partial<IServiceBusReceivedMessageDocument>
  ): Promise<IServiceBusReceivedMessageDocument> {
    const doc = await this.messagesService.update('received', id, message);
    if (!doc) {
      throw new NotFoundException(`Received message with ID ${id} not found`);
    }
    return doc as IServiceBusReceivedMessageDocument;
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    const existing = await this.messagesService.findOne('received', id);
    if (!existing) {
      throw new NotFoundException(`Received message with ID ${id} not found`);
    }
    await this.messagesService.remove('received', id);
    return { message: 'Received message deleted successfully' };
  }
}