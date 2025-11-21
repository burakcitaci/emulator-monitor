import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { ServiceBusModule } from './service-bus/service-bus.module';
import { CommonModule } from './common/common.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageModule } from './messages/messages.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forRoot('mongodb://testuser:testpass@localhost:27017/'),
    MongooseModule.forRoot(
      'mongodb://testuser:testpass@localhost:27017/MessageTrackingDb?authSource=admin',
      {
        connectionName: 'MessageTrackingDb', // Give it a name!
      }
    ),
    ScheduleModule.forRoot(),
    // MessageModule must be imported BEFORE ServiceBusModule
    // so that models are registered before ServiceBusService tries to inject them
    MessageModule,
    FileModule,
    ServiceBusModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
