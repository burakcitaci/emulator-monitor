import { Body, Controller, Get, Post } from '@nestjs/common';
import { SendRabbitmqMessageDto } from './dto/send-rabbitmq-message.dto';
import { ReceiveRabbitmqMessageDto } from './dto/receive-rabbitmq-message.dto';
import { RabbitmqService } from './rabbitmq.service';
import { AppConfigService } from '../common/app-config.service';

@Controller('rabbitmq')
export class RabbitmqController {
  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly config: AppConfigService,
  ) {}

  @Post('messages')
  async sendMessage(@Body() dto: SendRabbitmqMessageDto) {
    const result = await this.rabbitmqService.sendMessage(dto);
    return {
      success: true,
      message: 'Message enqueued successfully',
      data: result,
    };
  }

  @Post('messages/receive')
  async receiveMessage(@Body() dto: ReceiveRabbitmqMessageDto) {
    const result = await this.rabbitmqService.receiveMessage(dto);
    return result;
  }

  @Get('config')
  getConfiguration() {
    return {
      success: true,
      data: this.config.getRabbitmqConfiguration(),
    };
  }
}

