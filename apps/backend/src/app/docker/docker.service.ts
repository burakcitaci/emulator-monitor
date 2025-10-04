import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';

@Injectable()
export class DockerService {
  private readonly docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async listContainers() {
    return this.docker.listContainers({
      all: true,
    });
  }

  async createContainer(options: Docker.ContainerCreateOptions) {
    return this.docker.createContainer(options);
  }

  async getContainer(idOrName: string) {
    const container = this.docker.getContainer(idOrName);
    return container.inspect();
  }

  async startContainer(idOrName: string) {
    const container = this.docker.getContainer(idOrName);
    return container.start();
  }

  async stopContainer(idOrName: string) {
    const container = this.docker.getContainer(idOrName);
    return container.stop();
  }

  async restartContainer(idOrName: string) {
    const container = this.docker.getContainer(idOrName);
    return container.restart();
  }

  async getContainerLogs(idOrName: string, tail = 100) {
    const container = this.docker.getContainer(idOrName);
    return container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
  }

  async getContainerStats(idOrName: string) {
    const container = this.docker.getContainer(idOrName);
    return container.stats({ stream: false });
  }
}
