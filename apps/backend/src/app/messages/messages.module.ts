// messages.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './messages.service';
import { Message, MessageSchema } from './message.schema';
import { MessagesController } from './messages.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    CommonModule,
  ],
  controllers: [MessagesController],
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
