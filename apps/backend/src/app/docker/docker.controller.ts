import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { DockerService } from './docker.service';
import {
  ContainerCreateDto,
  ContainerLogsDto,
  ContainerStatsDto,
} from './dto/container.dto';
import { AppLogger } from '../common/logger.service';

@Controller('docker')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DockerController {
  constructor(
    private readonly dockerService: DockerService,
    private readonly logger: AppLogger
  ) {
    this.logger.setContext('DockerController');
  }

  @Get()
  async listContainers() {
    this.logger.log('Listing containers');
    const containers = await this.dockerService.listContainers();
    return containers;
  }

  @Post('create')
  async createContainer(@Body() createDto: ContainerCreateDto) {
    const container = await this.dockerService.createContainer(createDto);
    this.logger.log('Container created', { id: container.id, name: createDto.name });

    return {
      success: true,
      containerId: container.id,
      message: `Container '${createDto.name || container.id}' created successfully`,
    };
  }

  @Get(':id')
  async getContainer(@Param('id') id: string) {
    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const containerInfo = await this.dockerService.getContainer(id);
    this.logger.log('Container inspected', { id, state: containerInfo.State.Status });
    return containerInfo;
  }

  @Post(':id/start')
  async startContainer(@Param('id') id: string) {
    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    await this.dockerService.startContainer(id);
    this.logger.log('Container started', { id });

    return {
      success: true,
      message: `Container '${id}' started successfully`,
    };
  }

  @Post(':id/stop')
  async stopContainer(@Param('id') id: string) {
    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    await this.dockerService.stopContainer(id);
    this.logger.log('Container stopped', { id });

    return {
      success: true,
      message: `Container '${id}' stopped successfully`,
    };
  }

  @Post(':id/restart')
  async restartContainer(@Param('id') id: string) {
    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    await this.dockerService.restartContainer(id);
    this.logger.log('Container restarted', { id });

    return {
      success: true,
      message: `Container '${id}' restarted successfully`,
    };
  }

  @Get(':id/logs')
  async getContainerLogs(
    @Param('id') id: string,
    @Query() queryDto: ContainerLogsDto
  ) {
    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const logs = await this.dockerService.getContainerLogs(
      id,
      queryDto.tail || 100
    );

    this.logger.log('Container logs fetched', { id, logLength: logs.length });

    return {
      containerId: id,
      logs: logs.toString(),
      tail: queryDto.tail || 100,
      timestamps: queryDto.timestamps !== false,
    };
  }

  @Get(':id/stats')
  async getContainerStats(
    @Param('id') id: string,
    @Query() queryDto: ContainerStatsDto
  ) {
    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const stats = await this.dockerService.getContainerStats(id);
    this.logger.log('Container stats fetched', { id });

    return {
      containerId: id,
      stats,
      stream: queryDto.stream || false,
    };
  }
}
