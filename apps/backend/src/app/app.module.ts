import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { DockerModule } from './docker/docker.module';
import { ServiceBusModule } from './service-bus/service-bus.module';
import { CommonModule } from './common/common.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageModule } from './messages/messages.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    CommonModule,
    FileModule,
    DockerModule,
    ServiceBusModule,
    MongooseModule.forRoot('mongodb://testuser:testpass@localhost:27017/'),
    ScheduleModule.forRoot(),
    MessageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
