// messages.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './messages.service';
import { SentMessagesController } from './messages.sent.controller';
import { CommonModule } from '../common/common.module';
import { ServiceBusMessageSchema } from '../common/servicebus.message.schema';
import { ReceivedMessagesController } from './messages.recieved.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ServiceBusMessage', schema: ServiceBusMessageSchema },
      { name: 'ServiceBusReceivedMessage', schema: ServiceBusMessageSchema }
    ]),
    CommonModule,
  ],
  controllers: [SentMessagesController, ReceivedMessagesController],
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
