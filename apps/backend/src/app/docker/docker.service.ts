/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';
import { AppLogger } from '../common/logger.service';
import { ConfigService } from '../common/config.service';
import {
  DockerConnectionException,
  ContainerNotFoundException,
  ContainerOperationException,
} from '../common/exceptions';

@Injectable()
export class DockerService {
  private readonly docker: Docker;

  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService
  ) {
    this.logger.setContext('DockerService');

    try {
      const dockerConfig = this.configService.getDockerConfig();
      this.docker = new Docker({
        socketPath: dockerConfig.socketPath,
        timeout: dockerConfig.timeout,
      });
      this.logger.log('Docker initialized', {
        protocol: dockerConfig.protocol,
        socketPath: dockerConfig.socketPath,
      });
    } catch (error) {
      this.logger.error('Docker initialization failed', error as Error);
      throw new DockerConnectionException('Failed to initialize Docker client');
    }
  }

  async listContainers() {
    try {
      const containers = await this.docker.listContainers({ all: true });
      this.logger.log('Containers listed', { count: containers.length });
      return containers;
    } catch (error) {
      this.logger.error('Failed to list containers', error as Error);
      throw new DockerConnectionException('Failed to list Docker containers');
    }
  }

  async createContainer(options: Docker.ContainerCreateOptions) {
    try {
      const container = await this.docker.createContainer(options);
      this.logger.log('Container created', { id: container.id, name: options.name });
      return container;
    } catch (error) {
      this.logger.error('Failed to create container', error as Error, {
        name: options.name,
      });
      throw new ContainerOperationException(
        'create',
        options.name || 'unknown',
        error as Error
      );
    }
  }

  async getContainer(idOrName: string) {
    try {
      const container = this.docker.getContainer(idOrName);
      const info = await container.inspect();
      this.logger.log('Container inspected', { id: idOrName, state: info.State.Status });
      return info;
    } catch (error: any) {
      this.logger.error('Failed to inspect container', error as Error, { id: idOrName });

      if (error.message?.includes('No such container')) {
        throw new ContainerNotFoundException(idOrName);
      }

      throw new ContainerOperationException('inspect', idOrName, error as Error);
    }
  }

  async startContainer(idOrName: string) {
    try {
      const container = this.docker.getContainer(idOrName);
      await container.start();
      this.logger.log('Container started', { id: idOrName });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to start container', error as Error, { id: idOrName });
      throw new ContainerOperationException('start', idOrName, error as Error);
    }
  }

  async stopContainer(idOrName: string) {
    try {
      const container = this.docker.getContainer(idOrName);
      await container.stop();
      this.logger.log('Container stopped', { id: idOrName });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to stop container', error as Error, { id: idOrName });
      throw new ContainerOperationException('stop', idOrName, error as Error);
    }
  }

  async restartContainer(idOrName: string) {
    try {
      const container = this.docker.getContainer(idOrName);
      await container.restart();
      this.logger.log('Container restarted', { id: idOrName });
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to restart container', error as Error, { id: idOrName });
      throw new ContainerOperationException('restart', idOrName, error as Error);
    }
  }

  async getContainerLogs(idOrName: string, tail = 100) {
    try {
      const container = this.docker.getContainer(idOrName);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      this.logger.log('Container logs fetched', { id: idOrName, logLength: logs.length });
      return logs;
    } catch (error: any) {
      this.logger.error('Failed to fetch container logs', error as Error, {
        id: idOrName,
        tail,
      });

      if (error.message?.includes('No such container')) {
        throw new ContainerNotFoundException(idOrName);
      }

      throw new ContainerOperationException('get logs', idOrName, error as Error);
    }
  }

  async getContainerStats(idOrName: string) {
    try {
      const container = this.docker.getContainer(idOrName);
      const stats = await container.stats({ stream: false });
      this.logger.log('Container stats fetched', { id: idOrName });
      return stats;
    } catch (error: any) {
      this.logger.error('Failed to fetch container stats', error as Error, {
        id: idOrName,
      });

      if (error.message?.includes('No such container')) {
        throw new ContainerNotFoundException(idOrName);
      }

      throw new ContainerOperationException('get stats', idOrName, error as Error);
    }
  }
}
