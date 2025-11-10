import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceBusController } from './service-bus.controller';
import { ServiceBusService } from './service-bus.service';
import { MessageModule } from '../messages/messages.module';
import { ServiceBusMessageSchema } from '../common/servicebus.message.schema';
import { SentMessage, SentMessageSchema } from '../messages/message.schema';

@Module({
  imports: [
    MessageModule,
    MongooseModule.forFeature([
      { name: 'ServiceBusMessage', schema: ServiceBusMessageSchema },
      { name: SentMessage.name, schema: SentMessageSchema },
    ]),
  ],
  controllers: [ServiceBusController],
  providers: [ServiceBusService],
  exports: [ServiceBusService],
})
export class ServiceBusModule {}
