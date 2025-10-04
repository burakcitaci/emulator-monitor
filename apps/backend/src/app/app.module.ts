import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { DockerModule } from './docker/docker.module';

@Module({
  imports: [FileModule, DockerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
