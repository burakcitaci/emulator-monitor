import { Module } from '@nestjs/common';
import { DockerService } from './docker.service';
import { DockerController } from './docker.controller';
import { DockerComposeController } from './docker-compose.controller';
import { DockerComposeService } from './docker-compose.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [DockerController, DockerComposeController],
  providers: [DockerService, DockerComposeService],
  exports: [DockerService, DockerComposeService],
})
export class DockerModule {}
