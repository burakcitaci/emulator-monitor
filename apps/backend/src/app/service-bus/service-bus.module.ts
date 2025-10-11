import { Module } from '@nestjs/common';
import { ServiceBusController } from './service-bus.controller';
import { ServiceBusService } from './service-bus.service';
import { MessageModule } from '../messages/messages.module';

@Module({
  imports: [MessageModule],
  controllers: [ServiceBusController],
  providers: [ServiceBusService],
  exports: [ServiceBusService],
})
export class ServiceBusModule {}
