/**
 * Service Bus Module
 *
 * Handles Azure Service Bus connectivity and message monitoring.
 * Automatically initializes on startup and runs periodic monitoring via cron.
 *
 * ServiceBusService requires direct access to the Mongoose models,
 * so we register them here as well as in MessageModule.
 * Each module that needs model injection must register them in its own scope.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceBusController } from './service-bus.controller';
import { ServiceBusService } from './service-bus.service';
import { MessageModule } from '../messages/messages.module';
import { ServiceBusReceivedMessageSchema, ServiceBusMessageSchema } from '../common/servicebus.message.schema';

@Module({
  imports: [
    MessageModule,
    MongooseModule.forFeature([
      { name: 'ServiceBusReceivedMessage', schema: ServiceBusReceivedMessageSchema },
      { name: 'ServiceBusMessage', schema: ServiceBusMessageSchema }
    ]),
  ],
  controllers: [ServiceBusController],
  providers: [ServiceBusService],
  exports: [ServiceBusService],
})
export class ServiceBusModule {}
