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

      // Use socket path for both platforms (named pipe on Windows, Unix socket on Linux)
      const dockerOptions: any = {
        socketPath: dockerConfig.socketPath,
        timeout: dockerConfig.timeout,
      };

      this.docker = new Docker(dockerOptions);
      this.logger.logDockerOperation('initialized', undefined, {
        protocol: dockerConfig.protocol,
        host: dockerConfig.host,
        socketPath: dockerConfig.socketPath,
      });
    } catch (error) {
      this.logger.logDockerError('initialization', error as Error);
      throw new DockerConnectionException('Failed to initialize Docker client');
    }
  }

  async listContainers() {
    try {
      this.logger.logDockerOperation('listing containers');
      const containers = await this.docker.listContainers({
        all: true,
      });

      this.logger.logDockerOperation('containers listed', undefined, {
        count: containers.length,
      });

      return containers;
    } catch (error) {
      this.logger.logDockerError('list containers', error as Error);
      throw new DockerConnectionException('Failed to list Docker containers');
    }
  }

  async createContainer(options: Docker.ContainerCreateOptions) {
    try {
      this.logger.logDockerOperation('creating container', undefined, {
        image: options.Image,
        name: options.name,
      });

      const container = await this.docker.createContainer(options);

      this.logger.logDockerOperation('container created', container.id);
      return container;
    } catch (error) {
      this.logger.logDockerError(
        'create container',
        error as Error,
        undefined,
        {
          image: options.Image,
          name: options.name,
        }
      );
      throw new ContainerOperationException(
        'create',
        options.name || 'unknown',
        error as Error
      );
    }
  }

  async getContainer(idOrName: string) {
    try {
      this.logger.logDockerOperation('inspecting container', idOrName);
      const container = this.docker.getContainer(idOrName);
      const info = await container.inspect();

      this.logger.logDockerOperation('container inspected', idOrName, {
        state: info.State.Status,
      });

      return info;
    } catch (error: any) {
      this.logger.logDockerError('inspect container', error as Error, idOrName);

      if (error.message?.includes('No such container')) {
        throw new ContainerNotFoundException(idOrName);
      }

      throw new ContainerOperationException(
        'inspect',
        idOrName,
        error as Error
      );
    }
  }

  async startContainer(idOrName: string) {
    try {
      this.logger.logDockerOperation('starting container', idOrName);
      const container = this.docker.getContainer(idOrName);
      await container.start();

      this.logger.logDockerOperation('container started', idOrName);
      return { success: true };
    } catch (error) {
      this.logger.logDockerError('start container', error as Error, idOrName);
      throw new ContainerOperationException('start', idOrName, error as Error);
    }
  }

  async stopContainer(idOrName: string) {
    try {
      this.logger.logDockerOperation('stopping container', idOrName);
      const container = this.docker.getContainer(idOrName);
      await container.stop();

      this.logger.logDockerOperation('container stopped', idOrName);
      return { success: true };
    } catch (error) {
      this.logger.logDockerError('stop container', error as Error, idOrName);
      throw new ContainerOperationException('stop', idOrName, error as Error);
    }
  }

  async restartContainer(idOrName: string) {
    try {
      this.logger.logDockerOperation('restarting container', idOrName);
      const container = this.docker.getContainer(idOrName);
      await container.restart();

      this.logger.logDockerOperation('container restarted', idOrName);
      return { success: true };
    } catch (error) {
      this.logger.logDockerError('restart container', error as Error, idOrName);
      throw new ContainerOperationException(
        'restart',
        idOrName,
        error as Error
      );
    }
  }

  async getContainerLogs(idOrName: string, tail = 100) {
    try {
      this.logger.logDockerOperation('fetching container logs', idOrName, {
        tail,
      });
      const container = this.docker.getContainer(idOrName);

      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });

      this.logger.logDockerOperation('container logs fetched', idOrName, {
        logLength: logs.length,
      });

      return logs;
    } catch (error: any) {
      this.logger.logDockerError(
        'fetch container logs',
        error as Error,
        idOrName,
        { tail }
      );

      if (error.message?.includes('No such container')) {
        throw new ContainerNotFoundException(idOrName);
      }

      throw new ContainerOperationException(
        'get logs',
        idOrName,
        error as Error
      );
    }
  }

  async getContainerStats(idOrName: string) {
    try {
      this.logger.logDockerOperation('fetching container stats', idOrName);
      const container = this.docker.getContainer(idOrName);

      const stats = await container.stats({ stream: false });

      this.logger.logDockerOperation('container stats fetched', idOrName);
      return stats;
    } catch (error: any) {
      this.logger.logDockerError(
        'fetch container stats',
        error as Error,
        idOrName
      );

      if (error.message?.includes('No such container')) {
        throw new ContainerNotFoundException(idOrName);
      }

      throw new ContainerOperationException(
        'get stats',
        idOrName,
        error as Error
      );
    }
  }
}
