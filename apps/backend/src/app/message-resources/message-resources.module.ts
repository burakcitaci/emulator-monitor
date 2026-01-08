import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageResourcesService } from './message-resources.service';
import { CommonModule } from '../common/common.module';
import { MessageResourcesController } from './message-resources.controller';
import { MessagingResource, MessagingResourceSchema } from './message-resources.schema';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature(
      [{ name: MessagingResource.name, schema: MessagingResourceSchema }],
      'MessageTrackingDb', // Specify the connection name
    ),
  ],
  controllers: [
    MessageResourcesController,
  ],
  providers: [MessageResourcesService],
  exports: [MessageResourcesService],
})
export class MessageResourcesModule {}
