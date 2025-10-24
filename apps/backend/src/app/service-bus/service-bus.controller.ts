import {
  Controller,
  Post,
  Get,
  Body,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ServiceBusService } from './service-bus.service';
import { ConfigService } from '../common/config.service';
import * as types from '@e2e-monitor/entities';
import { DeadLetterMessageResponse } from '@e2e-monitor/entities';

@Controller('servicebus')
export class ServiceBusController {
  constructor(
    private readonly serviceBusService: ServiceBusService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Initialize Service Bus with configuration (legacy endpoint - auto-initialization now happens on startup)
   */
  @Post('initialize')
  async initialize(@Body() dto: types.InitializeDto) {
    try {
      if (!dto.config || !dto.connectionString) {
        throw new HttpException(
          'Config and connectionString are required',
          HttpStatus.BAD_REQUEST
        );
      }

      return await this.serviceBusService.initialize(
        dto.config,
        dto.connectionString
      );
    } catch (error: unknown) {
      throw new HttpException(
        (error as Error).message || 'Failed to initialize Service Bus',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get current configuration
   */
  @Get('config')
  getConfig(): types.ServiceBusConfig | null {
    return this.serviceBusService.getConfig();
  }

  /**
   * Get Service Bus status and debugging information
   */
  @Get('status')
  getStatus() {
    const config = this.serviceBusService.getConfig();
    const isInitialized = !!config;

    return {
      initialized: isInitialized,
      config: config ? {
        namespaces: config.UserConfig.Namespaces.length,
        topics: config.UserConfig.Namespaces.flatMap(ns => ns.Topics || []).length,
        queues: config.UserConfig.Namespaces.flatMap(ns => ns.Queues || []).length,
      } : null,
      environment: process.env.NODE_ENV || 'production',
      autoInitDisabled: process.env.SERVICE_BUS_AUTO_INIT === 'false',
      connectionString: config ? 'configured' : 'not configured',
    };
  }

  /**
   * Health check for Service Bus
   */
  @Get('health')
  getHealth() {
    const config = this.serviceBusService.getConfig();
    const isInitialized = !!config;

    return {
      status: isInitialized ? 'healthy' : 'unhealthy',
      initialized: isInitialized,
      timestamp: new Date().toISOString(),
      service: 'servicebus',
    };
  }

  /**
   * Manually initialize Service Bus (for debugging)
   */
  @Post('debug-init')
  async debugInitialize() {
    try {
      const config = this.configService.getServiceBusConfiguration();
      const connectionString = this.configService.serviceBusConnectionString;

      console.log('Manual Service Bus initialization requested...');
      console.log('Config loaded successfully:', !!config);
      console.log('Connection string configured:', !!connectionString);

      const result = await this.serviceBusService.initialize(config, connectionString);

      return {
        success: true,
        message: 'Service Bus initialized successfully',
        result,
      };
    } catch (error: unknown) {
      console.error('Manual initialization failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.stack : String(error),
      };
    }
  }

  /**
   * Get all namespaces and topics
   */
  @Get('namespaces')
  getNamespaces() {
    return this.serviceBusService.getNamespacesAndTopics();
  }

  /**
   * Send a message to a topic
   */
  @Post('send')
  async sendMessage(@Body() dto: types.SendMessageDto) {
    try {
      if (!dto.namespace || !dto.topic || !dto.message) {
        throw new HttpException(
          'Namespace, topic, and message are required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Check if service is initialized
      const config = this.serviceBusService.getConfig();
      if (!config) {
        throw new HttpException(
          'Service Bus is not initialized. Please ensure: 1) Service Bus emulator is running, 2) Configuration file exists, 3) Auto-initialization is enabled (or manually initialize via POST /api/v1/servicebus/initialize)',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      return await this.serviceBusService.sendMessage(dto);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        (error as Error).message || 'Failed to send message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('dead-letter-messages')
  async getDeadLetterMessages(
    @Query('namespace') namespace: string,
    @Query('topic') topic: string,
    @Query('subscription') subscription: string,
    @Query('maxMessages') maxMessages: string,
    @Query('maxWaitTimeInSeconds') maxWaitTimeInSeconds: string
  ): Promise<DeadLetterMessageResponse> {
    try {
      if (!namespace || !topic || !subscription) {
        throw new HttpException(
          'Query parameters namespace, topic, and subscription are required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Check if service is initialized
      const config = this.serviceBusService.getConfig();
      if (!config) {
        throw new HttpException(
          'Service Bus is not initialized. Please ensure: 1) Service Bus emulator is running, 2) Configuration file exists, 3) Auto-initialization is enabled (or manually initialize via POST /api/v1/servicebus/initialize)',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      const maxMsg = maxMessages ? parseInt(maxMessages, 10) : 10;
      const maxWait = maxWaitTimeInSeconds
        ? parseInt(maxWaitTimeInSeconds, 10)
        : 5;

      return await this.serviceBusService.receiveDeadLetterMessages(
        namespace,
        topic,
        subscription,
        maxMsg,
        maxWait
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        (error as Error).message || 'Failed to retrieve Dead Letter Messages',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Peek active messages from a queue or a topic subscription
   * Use either "queue" OR ("topic" + "subscription").
   */
  @Get('messages')
  async getMessages(
    @Query('namespace') namespace: string,
    @Query('queue') queue?: string,
    @Query('topic') topic?: string,
    @Query('subscription') subscription?: string,
    @Query('maxMessages') maxMessages?: string
  ): Promise<DeadLetterMessageResponse> {
    try {
      if (!namespace) {
        throw new HttpException(
          'Query parameter namespace is required',
          HttpStatus.BAD_REQUEST
        );
      }

      if (!queue && !(topic && subscription)) {
        throw new HttpException(
          'Provide either queue or topic and subscription',
          HttpStatus.BAD_REQUEST
        );
      }

      // Check if service is initialized
      const config = this.serviceBusService.getConfig();
      if (!config) {
        throw new HttpException(
          'Service Bus is not initialized. Please ensure: 1) Service Bus emulator is running, 2) Configuration file exists, 3) Auto-initialization is enabled (or manually initialize via POST /api/v1/servicebus/initialize)',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      const maxMsg = maxMessages ? parseInt(maxMessages, 10) : 10;

      return await this.serviceBusService.receiveActiveMessages(
        namespace,
        queue ?? topic!,
        subscription,
        maxMsg
      );
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        (error as Error).message || 'Failed to retrieve messages',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Send multiple messages in a batch
   */
  @Post('send-batch')
  async sendMessageBatch(@Body() dto: types.SendBatchDto) {
    try {
      if (
        !dto.namespace ||
        !dto.topic ||
        !dto.messages ||
        dto.messages.length === 0
      ) {
        throw new HttpException(
          'Namespace, topic, and messages array are required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Check if service is initialized
      const config = this.serviceBusService.getConfig();
      if (!config) {
        throw new HttpException(
          'Service Bus is not initialized. Please ensure: 1) Service Bus emulator is running, 2) Configuration file exists, 3) Auto-initialization is enabled (or manually initialize via POST /api/v1/servicebus/initialize)',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      return await this.serviceBusService.sendMessageBatch(dto);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        (error as Error).message || 'Failed to send message batch',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
