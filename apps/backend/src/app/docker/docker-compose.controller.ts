import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { DockerComposeService } from './docker-compose.service';

@Controller('docker-compose')
export class DockerComposeController {
  constructor(private readonly composeService: DockerComposeService) {}

  @Post('up')
  async up(
    @Body()
    body: {
      filePath?: string;
      projectName?: string;
      services?: string[];
    }
  ) {
    return this.composeService.up(body);
  }

  @Post('down')
  async down(
    @Body()
    body: {
      filePath?: string;
      projectName?: string;
      removeVolumes?: boolean;
    }
  ) {
    return this.composeService.down(body);
  }

  @Get('ps')
  async ps(
    @Query('filePath') filePath?: string,
    @Query('projectName') projectName?: string
  ) {
    return this.composeService.ps({ filePath, projectName });
  }

  @Get('logs')
  async logs(
    @Query('filePath') filePath?: string,
    @Query('projectName') projectName?: string,
    @Query('service') service?: string,
    @Query('tail') tail?: string
  ) {
    return this.composeService.logs({
      filePath,
      projectName,
      service,
      tail: tail ? parseInt(tail, 10) : undefined,
    });
  }

  @Post('restart')
  async restart(
    @Body()
    body: {
      filePath?: string;
      projectName?: string;
      services?: string[];
    }
  ) {
    return this.composeService.restart(body);
  }
}
