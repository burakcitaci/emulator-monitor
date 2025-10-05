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
import * as types from './types';

@Controller('servicebus')
export class ServiceBusController {
  constructor(private readonly serviceBusService: ServiceBusService) {}

  /**
   * Initialize Service Bus with configuration
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
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to initialize Service Bus',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get current configuration
   */
  @Get('config')
  getConfig(): types.ServiceBusConfig | null {
    const config = this.serviceBusService.getConfig();
    if (!config) {
      throw new HttpException(
        'Service Bus not initialized',
        HttpStatus.BAD_REQUEST
      );
    }
    return config;
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

      return await this.serviceBusService.sendMessage(dto);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send message',
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
  ): Promise<types.DeadLetterMessageResponse> {
    try {
      if (!namespace || !topic || !subscription) {
        throw new HttpException(
          'Query parameters namespace, topic, and subscription are required',
          HttpStatus.BAD_REQUEST
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
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to retrieve Dead Letter Messages',
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

      return await this.serviceBusService.sendMessageBatch(dto);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to send message batch',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
