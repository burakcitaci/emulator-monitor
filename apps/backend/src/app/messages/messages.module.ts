/**
 * Messages Module
 *
 * Central location for managing Service Bus messages with controllers for both sent and received message streams.
 * 
 * Registers two separate MongoDB schemas and collections:
 * - ServiceBusMessage: For sent messages (service_bus_messages collection)
 * - ServiceBusReceivedMessage: For monitored received messages (service_bus_received_messages collection)
 *
 * Model Registration:
 * This module is responsible for registering both models via MongooseModule.forFeature().
 * Other modules (ServiceBusModule, etc.) import this module to access the models.
 * This prevents duplicate model registration which would cause conflicts.
 *
 * Exports:
 * - MessageService: Message CRUD operations
 * - MongooseModule models: Available to injected services in this module and imported modules
 */
import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './messages.service';
import { SentMessagesController } from './messages.sent.controller';
import { CommonModule } from '../common/common.module';
import { ServiceBusMessageSchema, ServiceBusReceivedMessageSchema } from '../common/servicebus.message.schema';
import { ReceivedMessagesController } from './messages.recieved.controller';
import { TrackingMessage, TrackingMessageSchema } from './message.schema';
import { MessagesController } from './messages.controller';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: 'ServiceBusMessage', schema: ServiceBusMessageSchema },
      { name: 'ServiceBusReceivedMessage', schema: ServiceBusReceivedMessageSchema },
    ]),
        MongooseModule.forFeature(
      [
        { name: TrackingMessage.name, schema: TrackingMessageSchema }
      ],
      'MessageTrackingDb' // Specify the connection name
    ),
  ],
  controllers: [SentMessagesController, ReceivedMessagesController, MessagesController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule implements OnModuleInit {
  constructor(private readonly messageService: MessageService) {}

  async onModuleInit() {
    // Run migration on startup to fix old message statuses and populate queue field
    console.log('[MessageModule] Running message migration on startup...');
    try {
      await this.messageService.migrateOldMessages();
    } catch (error) {
      console.error('[MessageModule] Migration failed on startup:', error);
      // Don't throw - let the app continue running
    }
  }
}
