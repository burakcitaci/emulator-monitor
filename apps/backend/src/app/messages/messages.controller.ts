import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { MessageService } from './messages.service';
import { TrackingMessage } from './message.schema';
import { AppLogger } from '../common/logger.service';

@Controller('tracked-messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessageService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(MessagesController.name);
  }

  @Get('tracking')
  async getTrackingMessages() {
    const result = await this.messagesService.findTrackingMessages();
    this.logger.log(`Retrieved ${result.length} tracking messages`);
    return {
      success: true,
      data: result,
    };
  }
  @Get('tracking/emulator/:emulator')
  async getTrackingMessagesByEmulator(@Param('emulator') emulator: string) {
    const result = await this.messagesService.findTrackingMessagesByEmulator(emulator);
    this.logger.log(`Retrieved ${result.length} tracking messages for emulator ${emulator}`);
    return {
      success: true,
      data: result,
    };
  }

  @Get('tracking/:id')
  async getTrackingMessage(@Param('id') id: string) {
    const result = await this.messagesService.findOneTracking(id);
    this.logger.log(`Retrieved tracking message ${id}`);
    return {
      success: true,
      data: result,
    };
  }

  @Post('tracking')
  async createTrackingMessage(@Body() message: Partial<TrackingMessage>) {
    const result = await this.messagesService.createTracking(message);
    this.logger.log(`Created tracking message ${result.messageId}`);
    return {
      success: true,
      data: result,
    };
  }

  @Put('tracking/:id')
  async updateTrackingMessage(@Param('id') id: string, @Body() message: Partial<TrackingMessage>) {
    const result = await this.messagesService.updateTracking(id, message);
    this.logger.log(`Updated tracking message ${id}`);
    return {
      success: true,
      data: result,
    };
  }

  @Delete('tracking/:id')
  async deleteTrackingMessage(@Param('id') id: string) {
    await this.messagesService.removeTracking(id);
    this.logger.log(`Deleted tracking message ${id}`);
    return {
      success: true,
      message: 'Tracking message deleted successfully',
    };
  }
}
