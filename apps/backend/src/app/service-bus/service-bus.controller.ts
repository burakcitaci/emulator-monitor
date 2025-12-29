import { Body, Controller, Get, Post } from '@nestjs/common';
import { SendServiceBusMessageDto } from './dto/send-service-bus-message.dto';
import { ReceiveServiceBusMessageDto } from './dto/receive-service-bus-message.dto';
import { ServiceBusService } from './service-bus.service';
import { AppConfigService } from '../common/app-config.service';

@Controller('service-bus')
export class ServiceBusController {
  constructor(
    private readonly serviceBusService: ServiceBusService,
    private readonly config: AppConfigService,
  ) {}

  @Post('messages')
  async sendMessage(@Body() dto: SendServiceBusMessageDto) {
    const result = await this.serviceBusService.sendMessage(dto);
    return {
      success: true,
      message: 'Message enqueued successfully',
      data: result,
    };
  }

  @Post('messages/receive')
  async receiveMessage(@Body() dto: ReceiveServiceBusMessageDto) {
    const result = await this.serviceBusService.receiveMessage(dto);
    return result;
  }

  @Get('config')
  getConfiguration() {
    return {
      success: true,
      data: this.config.getServiceBusConfiguration(),
    };
  }
}
