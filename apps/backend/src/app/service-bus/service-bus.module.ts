import { Module } from '@nestjs/common';
import { ServiceBusController } from './service-bus.controller';
import { ServiceBusService } from './service-bus.service';

@Module({
  controllers: [ServiceBusController],
  providers: [ServiceBusService],
  exports: [ServiceBusService],
})
export class ServiceBusModule {}
