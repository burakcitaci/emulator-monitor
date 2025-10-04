import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DockerService } from './docker.service';
import Dockerode from 'dockerode';

@Controller('docker')
export class DockerController {
  constructor(private readonly dockerService: DockerService) {}

  @Get()
  async listContainers() {
    return this.dockerService.listContainers();
  }

  @Post('create')
  async createContainer(@Body() body: Dockerode.ContainerCreateOptions) {
    return this.dockerService.createContainer(body);
  }

  @Get(':id')
  async getContainer(@Param('id') id: string) {
    return this.dockerService.getContainer(id);
  }

  @Post(':id/start')
  async startContainer(@Param('id') id: string) {
    return this.dockerService.startContainer(id);
  }

  @Post(':id/stop')
  async stopContainer(@Param('id') id: string) {
    return this.dockerService.stopContainer(id);
  }

  @Post(':id/restart')
  async restartContainer(@Param('id') id: string) {
    return this.dockerService.restartContainer(id);
  }

  @Get(':id/logs')
  async getContainerLogs(@Param('id') id: string) {
    return this.dockerService.getContainerLogs(id);
  }

  @Get(':id/stats')
  async getContainerStats(@Param('id') id: string) {
    return this.dockerService.getContainerStats(id);
  }
}
