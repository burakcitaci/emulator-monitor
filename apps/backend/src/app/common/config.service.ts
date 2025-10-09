import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ServiceBusConfig {
  UserConfig: {
    Namespaces: ServiceBusNamespace[];
    Logging: LoggingConfig;
  };
}

export interface ServiceBusNamespace {
  Name: string;
  Topics?: ServiceBusTopic[];
  Queues?: ServiceBusQueue[];
}

export interface ServiceBusTopic {
  Name: string;
  Properties: TopicProperties;
  Subscriptions: ServiceBusSubscription[];
}

export interface ServiceBusQueue {
  Name: string;
  Properties: QueueProperties;
}

export interface TopicProperties {
  readonly DefaultMessageTimeToLive: string;
  readonly DuplicateDetectionHistoryTimeWindow: string;
  readonly RequiresDuplicateDetection: boolean;
}

export interface ServiceBusSubscription {
  Name: string;
  DeadLetteringOnMessageExpiration: boolean;
  MaxDeliveryCount: number;
}

export interface QueueProperties {
  readonly DefaultMessageTimeToLive: string;
  readonly MaxDeliveryCount: number;
  readonly DeadLetteringOnMessageExpiration: boolean;
}

export interface LoggingConfig {
  readonly Type: 'console' | 'file' | 'applicationInsights';
}

@Injectable()
export class ConfigService {
  get dockerSocketPath(): string {
    // On Windows, use named pipe
    if (process.platform === 'win32') {
      return process.env.DOCKER_SOCKET_PATH || '\\\\.\\pipe\\docker_engine';
    }
    return process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
  }

  get dockerHost(): string {
    return process.env.DOCKER_HOST || 'tcp://localhost:2376';
  }

  get dockerProtocol(): string {
    switch (process.platform) {
      case 'win32':
        return 'npipe'; // Windows uses named pipes
      case 'linux':
      case 'darwin':
        return 'unix'; // Linux/macOS use Unix sockets
      default:
        return 'socket'; // fallback for other OS types
    }
  }

  get dockerTimeout(): number {
    return parseInt(process.env.DOCKER_TIMEOUT || '30000', 10);
  }

  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }

  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get corsOrigin(): string | string[] {
    const origin = process.env.CORS_ORIGIN || 'http://localhost:4200';
    return origin.includes(',') ? origin.split(',') : origin;
  }

  get logLevel(): string {
    return process.env.LOG_LEVEL || 'info';
  }

  get serviceBusConnectionString(): string {
    return (
      process.env.SERVICE_BUS_CONNECTION_STRING ||
      'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true'
    );
  }

  get serviceBusNamespace(): string {
    return process.env.SERVICE_BUS_NAMESPACE || 'sbemulatorns';
  }

  // Validation methods
  validateRequiredEnvVars(): void {
    const requiredVars = [
      'NODE_ENV',
      // Add other required environment variables here
    ];

    const missing = requiredVars.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }

  // Docker-specific configuration
  getDockerConfig() {
    return {
      socketPath: this.dockerSocketPath,
      host: this.dockerHost,
      protocol: this.dockerProtocol,
      timeout: this.dockerTimeout,
      checkSocketExists: process.env.DOCKER_CHECK_SOCKET !== 'false',
    };
  }

  // Service Bus configuration
  getServiceBusConfig() {
    return {
      connectionString: this.serviceBusConnectionString,
      namespace: this.serviceBusNamespace,
      maxRetries: parseInt(process.env.SERVICE_BUS_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.SERVICE_BUS_RETRY_DELAY || '1000', 10),
    };
  }

  // Load Service Bus configuration from file
  getServiceBusConfiguration(): ServiceBusConfig {
    try {
      // Try multiple possible paths for the config file
      const possiblePaths = [
        join(process.cwd(), 'config', 'servicebus-config.json'),
        join(
          __dirname,
          '..',
          '..',
          '..',
          '..',
          'config',
          'servicebus-config.json'
        ),
        join(__dirname, '..', '..', 'config', 'servicebus-config.json'),
      ];

      let configData: string | null = null;
      let configPath = '';

      for (const path of possiblePaths) {
        try {
          configData = readFileSync(path, 'utf8');
          configPath = path;
          break;
        } catch {
          // Try next path
        }
      }

      if (!configData) {
        throw new Error(
          'Configuration file not found in any expected location'
        );
      }

      console.log(`Loading Service Bus configuration from: ${configPath}`);
      const config = JSON.parse(configData);

      // Validate the configuration structure
      if (!config.UserConfig?.Namespaces) {
        throw new Error(
          'Invalid configuration structure: missing UserConfig.Namespaces'
        );
      }

      return config;
    } catch (error) {
      console.error(
        'Failed to load Service Bus configuration from file:',
        error
      );

      // Instead of throwing, return a default configuration
      console.log('Using default Service Bus configuration');
      return this.getDefaultServiceBusConfig();
    }
  }

  // Get default Service Bus configuration as fallback
  private getDefaultServiceBusConfig(): ServiceBusConfig {
    return {
      UserConfig: {
        Namespaces: [
          {
            Name: this.serviceBusNamespace,
            Topics: [
              {
                Name: 'test-topic',
                Properties: {
                  DefaultMessageTimeToLive: 'P14D',
                  DuplicateDetectionHistoryTimeWindow: 'PT10M',
                  RequiresDuplicateDetection: false,
                },
                Subscriptions: [
                  {
                    Name: 'test-subscription',
                    DeadLetteringOnMessageExpiration: true,
                    MaxDeliveryCount: 10,
                  },
                ],
              },
            ],
            Queues: [
              {
                Name: 'test-queue',
                Properties: {
                  DefaultMessageTimeToLive: 'P14D',
                  MaxDeliveryCount: 10,
                  DeadLetteringOnMessageExpiration: true,
                },
              },
            ],
          },
        ],
        Logging: {
          Type: 'console',
        },
      },
    };
  }
}
