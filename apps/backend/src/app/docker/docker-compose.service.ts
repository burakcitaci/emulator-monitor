/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class DockerComposeService {
  private readonly composePath: string;

  constructor() {
    // Set your docker-compose files directory
    this.composePath = process.env.COMPOSE_PATH || process.cwd();
  }

  /**
   * Execute docker-compose command with proper Windows support
   */
  private async executeCommand(command: string): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
    command?: string;
  }> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.composePath,
        shell:
          process.platform === 'win32'
            ? process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'
            : '/bin/sh', // safer default on Linux
        windowsHide: true,
        env: {
          ...process.env,
          COMPOSE_INTERACTIVE_NO_CLI: '1',
        },
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stderr: error.stderr?.trim() || '',
        stdout: error.stdout?.trim() || '',
        command,
      };
    }
  }

  /**
   * Run docker-compose up -d
   */
  async up(options?: {
    filePath?: string;
    projectName?: string;
    services?: string[];
  }) {
    const { filePath, projectName, services } = options || {};

    let command = 'docker compose'; // Note: newer syntax without hyphen

    // Add custom file path
    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.composePath, filePath);
      command += ` -f "${fullPath}"`;
    }

    // Add project name
    if (projectName) {
      command += ` -p ${projectName}`;
    }

    command += ' up -d';

    // Add specific services
    if (services && services.length > 0) {
      command += ` ${services.join(' ')}`;
    }

    return this.executeCommand(command);
  }

  /**
   * Run docker-compose down
   */
  async down(options?: {
    filePath?: string;
    projectName?: string;
    removeVolumes?: boolean;
  }) {
    const { filePath, projectName, removeVolumes } = options || {};

    let command = 'docker compose';

    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.composePath, filePath);
      command += ` -f "${fullPath}"`;
    }

    if (projectName) {
      command += ` -p ${projectName}`;
    }

    command += ' down';

    if (removeVolumes) {
      command += ' -v';
    }

    return this.executeCommand(command);
  }

  /**
   * Run docker-compose ps
   */
  async ps(options?: { filePath?: string; projectName?: string }) {
    const { filePath, projectName } = options || {};

    let command = 'docker compose';

    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.composePath, filePath);
      command += ` -f "${fullPath}"`;
    }

    if (projectName) {
      command += ` -p ${projectName}`;
    }

    command += ' ps --format json';

    const result = await this.executeCommand(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        containers: [],
      };
    }

    try {
      // Parse JSON output
      const lines = (result.stdout || '')
        .trim()
        .split('\n')
        .filter((line) => line);
      const containers =
        lines.length > 0 ? lines.map((line) => JSON.parse(line)) : [];

      return {
        success: true,
        containers,
      };
    } catch (parseError: any) {
      return {
        success: false,
        error: `Failed to parse container data: ${parseError.message}`,
        containers: [],
      };
    }
  }

  /**
   * Run docker-compose logs
   */
  async logs(options?: {
    filePath?: string;
    projectName?: string;
    service?: string;
    tail?: number;
    follow?: boolean;
  }) {
    const { filePath, projectName, service, tail } = options || {};

    let command = 'docker compose';

    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.composePath, filePath);
      command += ` -f "${fullPath}"`;
    }

    if (projectName) {
      command += ` -p ${projectName}`;
    }

    command += ' logs --no-color';

    if (tail) {
      command += ` --tail=${tail}`;
    }

    if (service) {
      command += ` ${service}`;
    }

    const result = await this.executeCommand(command);

    return {
      success: result.success,
      logs: result.stdout || '',
      stderr: result.stderr,
      error: result.error,
    };
  }

  /**
   * Restart services
   */
  async restart(options?: {
    filePath?: string;
    projectName?: string;
    services?: string[];
  }) {
    const { filePath, projectName, services } = options || {};

    let command = 'docker compose';

    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.composePath, filePath);
      command += ` -f "${fullPath}"`;
    }

    if (projectName) {
      command += ` -p ${projectName}`;
    }

    command += ' restart';

    if (services && services.length > 0) {
      command += ` ${services.join(' ')}`;
    }

    return this.executeCommand(command);
  }

  /**
   * Stop services
   */
  async stop(options?: {
    filePath?: string;
    projectName?: string;
    services?: string[];
  }) {
    const { filePath, projectName, services } = options || {};

    let command = 'docker compose';

    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.composePath, filePath);
      command += ` -f "${fullPath}"`;
    }

    if (projectName) {
      command += ` -p ${projectName}`;
    }

    command += ' stop';

    if (services && services.length > 0) {
      command += ` ${services.join(' ')}`;
    }

    return this.executeCommand(command);
  }

  /**
   * Start services
   */
  async start(options?: {
    filePath?: string;
    projectName?: string;
    services?: string[];
  }) {
    const { filePath, projectName, services } = options || {};

    let command = 'docker compose';

    if (filePath) {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.composePath, filePath);
      command += ` -f "${fullPath}"`;
    }

    if (projectName) {
      command += ` -p ${projectName}`;
    }

    command += ' start';

    if (services && services.length > 0) {
      command += ` ${services.join(' ')}`;
    }

    return this.executeCommand(command);
  }
}
