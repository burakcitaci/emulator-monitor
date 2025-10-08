import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { DockerModule } from './docker/docker.module';
import { ServiceBusModule } from './service-bus/service-bus.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [CommonModule, FileModule, DockerModule, ServiceBusModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
