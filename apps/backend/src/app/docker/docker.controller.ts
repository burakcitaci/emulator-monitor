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
    this.logger.logWithContext('Listing all containers', 'DockerController');
    const containers = await this.dockerService.listContainers();
    this.logger.logWithContext(
      `Found ${containers.length} containers`,
      'DockerController'
    );
    return containers;
  }

  @Post('create')
  async createContainer(@Body() createDto: ContainerCreateDto) {
    this.logger.logWithContext('Creating container', 'DockerController', {
      image: createDto.Image,
      name: createDto.name,
    });

    const container = await this.dockerService.createContainer(createDto);

    this.logger.logWithContext(
      'Container created successfully',
      'DockerController',
      {
        id: container.id,
        name: createDto.name,
      }
    );

    return {
      success: true,
      containerId: container.id,
      message: `Container '${
        createDto.name || container.id
      }' created successfully`,
    };
  }

  @Get(':id')
  async getContainer(@Param('id') id: string) {
    this.logger.logWithContext('Inspecting container', 'DockerController', {
      containerId: id,
    });

    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const containerInfo = await this.dockerService.getContainer(id);

    this.logger.logWithContext(
      'Container inspected successfully',
      'DockerController',
      {
        containerId: id,
        state: containerInfo.State.Status,
      }
    );

    return containerInfo;
  }

  @Post(':id/start')
  async startContainer(@Param('id') id: string) {
    this.logger.logWithContext('Starting container', 'DockerController', {
      containerId: id,
    });

    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const result = await this.dockerService.startContainer(id);

    this.logger.logWithContext(
      'Container started successfully',
      'DockerController',
      {
        containerId: id,
      }
    );

    return {
      message: `Container '${id}' started successfully`,
      ...result,
    };
  }

  @Post(':id/stop')
  async stopContainer(@Param('id') id: string) {
    this.logger.logWithContext('Stopping container', 'DockerController', {
      containerId: id,
    });

    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const result = await this.dockerService.stopContainer(id);

    this.logger.logWithContext(
      'Container stopped successfully',
      'DockerController',
      {
        containerId: id,
      }
    );

    return {
      message: `Container '${id}' stopped successfully`,
      ...result,
    };
  }

  @Post(':id/restart')
  async restartContainer(@Param('id') id: string) {
    this.logger.logWithContext('Restarting container', 'DockerController', {
      containerId: id,
    });

    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const result = await this.dockerService.restartContainer(id);

    this.logger.logWithContext(
      'Container restarted successfully',
      'DockerController',
      {
        containerId: id,
      }
    );

    return {
      message: `Container '${id}' restarted successfully`,
      ...result,
    };
  }

  @Get(':id/logs')
  async getContainerLogs(
    @Param('id') id: string,
    @Query() queryDto: ContainerLogsDto
  ) {
    this.logger.logWithContext('Fetching container logs', 'DockerController', {
      containerId: id,
      tail: queryDto.tail,
    });

    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const logs = await this.dockerService.getContainerLogs(
      id,
      queryDto.tail || 100
    );

    this.logger.logWithContext(
      'Container logs fetched successfully',
      'DockerController',
      {
        containerId: id,
        logLength: logs.length,
      }
    );

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
    this.logger.logWithContext('Fetching container stats', 'DockerController', {
      containerId: id,
      stream: queryDto.stream,
    });

    if (!id || id.trim().length === 0) {
      throw new Error('Container ID is required');
    }

    const stats = await this.dockerService.getContainerStats(id);

    this.logger.logWithContext(
      'Container stats fetched successfully',
      'DockerController',
      {
        containerId: id,
      }
    );

    return {
      containerId: id,
      stats,
      stream: queryDto.stream || false,
    };
  }
}
