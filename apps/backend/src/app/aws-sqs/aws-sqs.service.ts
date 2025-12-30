import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
  CreateQueueCommand,
  ChangeMessageVisibilityCommand,
  GetQueueAttributesCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import { AWS_SQS_CLIENT } from './aws-sqs.constants';
import { SendSqsMessageDto } from './dto/send-sqs-message.dto';
import { ReceiveSqsMessageDto } from './dto/receive-sqs-message.dto';
import { AppConfigService } from '../common/app-config.service';
import { AppLogger } from '../common/logger.service';
import { MessageService } from '../messages/messages.service';
import { AwsSqsConnectionException } from '../common/exceptions';
import { TrackingMessage } from '../messages/message.schema';

// Helper function to create a random delay between 0 and 2000ms
const randomDelay = (): Promise<void> => {
  const delayMs = Math.floor(Math.random() * 2000); // 0 to 1999ms
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

@Injectable()
export class AwsSqsService implements OnModuleInit, OnModuleDestroy {
  private readonly queueUrlCache = new Map<string, string>();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @Inject(AWS_SQS_CLIENT) private readonly client: SQSClient,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
    private readonly messageService: MessageService,
  ) {
    this.logger.setContext(AwsSqsService.name);
  }

  async sendMessage(dto: SendSqsMessageDto) {
    const queueName = dto.queueUrl 
      ? this.extractQueueNameFromUrl(dto.queueUrl)
      : this.config.awsSqsQueueName;
    
    const queueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);
    const messageId = dto.messageId ?? randomUUID();
    const body = this.parseBody(dto.body);

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: typeof body === 'string' ? body : JSON.stringify(body),
      MessageAttributes: {
        ...(dto.messageAttributes || {}),
        sentBy: {
          DataType: 'String',
          StringValue: dto.sentBy ?? 'aws-sqs-api',
        },
        ...(dto.messageDisposition && {
          messageDisposition: {
            DataType: 'String',
            StringValue: dto.messageDisposition,
          },
        }),
      },
      ...(dto.messageGroupId && { MessageGroupId: dto.messageGroupId }),
      ...(dto.messageDeduplicationId && { MessageDeduplicationId: dto.messageDeduplicationId }),
      ...(dto.delaySeconds !== undefined && { DelaySeconds: dto.delaySeconds }),
    });

    let response;
    try {
      response = await this.client.send(command);
    } catch (error) {
      // If queue doesn't exist, clear cache and retry once
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = (error as { name?: string })?.name || '';
      
      const isQueueNotExistError =
        errorMessage.includes('does not exist') ||
        errorMessage.includes('NonExistentQueue') ||
        errorName === 'QueueDoesNotExist';
      
      if (isQueueNotExistError) {
        this.logger.warn(`Queue ${queueName} not found when sending message (original queueUrl: ${queueUrl}), clearing cache and retrying...`);
        // Clear cache and get/create queue again
        this.queueUrlCache.delete(queueName);
        
        try {
          const retryQueueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);
          this.logger.log(`Retrieved/created queue URL: ${retryQueueUrl}`);
          
          // Create new command with updated queue URL
          const retryCommand = new SendMessageCommand({
            QueueUrl: retryQueueUrl,
            MessageBody: typeof body === 'string' ? body : JSON.stringify(body),
            MessageAttributes: {
              ...(dto.messageAttributes || {}),
              sentBy: {
                DataType: 'String',
                StringValue: dto.sentBy ?? 'aws-sqs-api',
              },
              ...(dto.messageDisposition && {
                messageDisposition: {
                  DataType: 'String',
                  StringValue: dto.messageDisposition,
                },
              }),
            },
            ...(dto.messageGroupId && { MessageGroupId: dto.messageGroupId }),
            ...(dto.messageDeduplicationId && { MessageDeduplicationId: dto.messageDeduplicationId }),
            ...(dto.delaySeconds !== undefined && { DelaySeconds: dto.delaySeconds }),
          });
          response = await this.client.send(retryCommand);
        } catch (retryError) {
          this.logger.error(`Failed to get/create queue ${queueName} during retry:`, retryError);
          throw new Error(
            `Failed to send message: Queue ${queueName} does not exist and could not be created. ` +
            `Original error: ${errorMessage}. Retry error: ${retryError instanceof Error ? retryError.message : String(retryError)}`
          );
        }
      } else {
        this.logger.error(`Error sending message to queue ${queueName}:`, error);
        throw error;
      }
    }

    try {
      await this.messageService.createTracking({
        messageId: response.MessageId || messageId,
        body: typeof body === 'string' ? body : JSON.stringify(body),
        sentBy: dto.sentBy ?? 'aws-sqs-api',
        sentAt: new Date(),
        status: 'processing',
        queue: queueName,
        emulatorType: 'sqs',
      });
      this.logger.log(`Sent SQS message ${response.MessageId || messageId} to ${queueName} and created tracking entry with status: processing`);
    } catch (error) {
      this.logger.error(`Failed to create tracking entry for message ${response.MessageId || messageId} sent to ${queueName}:`, error);
    }

    this.logger.log(`Sent SQS message ${response.MessageId || messageId} to ${queueName}`);

    return {
      queueName,
      queueUrl,
      messageId: response.MessageId || messageId,
      md5OfBody: response.MD5OfMessageBody,
    };
  }

  async getMessages() {
    const queueName = this.config.awsSqsQueueName;
    const queueUrl = await this.getOrCreateQueueUrl(queueName);
    
    const results = {
      dlq: [] as Message[],
      abandoned: [] as Message[],
      deferred: [] as Message[],
      tracking: {
        deadletter: [] as TrackingMessage[],
        abandon: [] as TrackingMessage[],
        defer: [] as TrackingMessage[],
      },
    };

    try {
      // Try to get DLQ queue URL from queue attributes
      const attributesCommand = new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['RedrivePolicy'],
      });
      const attributesResponse = await this.client.send(attributesCommand);
      
      // Check if there's a redrive policy pointing to a DLQ
      const redrivePolicy = attributesResponse.Attributes?.RedrivePolicy;
      if (redrivePolicy) {
        try {
          const redrivePolicyObj = JSON.parse(redrivePolicy);
          const dlqArn = redrivePolicyObj.deadLetterTargetArn;
          if (dlqArn) {
            // Extract DLQ name from ARN (format: arn:aws:sqs:region:account:queue-name)
            const dlqName = dlqArn.split(':').pop();
            if (dlqName) {
              const dlqUrl = await this.getOrCreateQueueUrl(dlqName);
              const dlqCommand = new ReceiveMessageCommand({
                QueueUrl: dlqUrl,
                MaxNumberOfMessages: 10,
                MessageAttributeNames: ['All'],
              });
              const dlqResponse = await this.client.send(dlqCommand);
              if (dlqResponse.Messages) {
                results.dlq = dlqResponse.Messages;
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to parse redrive policy or get DLQ messages: ${error}`);
        }
      }
      
      // Also try common DLQ naming convention: {queue-name}-dlq
      try {
        const dlqName = `${queueName}-dlq`;
        const dlqUrl = await this.getOrCreateQueueUrl(dlqName);
        const dlqCommand = new ReceiveMessageCommand({
          QueueUrl: dlqUrl,
          MaxNumberOfMessages: 10,
          MessageAttributeNames: ['All'],
        });
        const dlqResponse = await this.client.send(dlqCommand);
        if (dlqResponse.Messages && dlqResponse.Messages.length > 0) {
          results.dlq = [...results.dlq, ...dlqResponse.Messages];
        }
      } catch (error) {
        // DLQ queue doesn't exist, that's okay
        this.logger.debug(`DLQ queue ${queueName}-dlq not found: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to get DLQ messages: ${error}`);
    }

    // Get messages from tracking database with specific dispositions
    try {
      const trackingMessages = await this.messageService.findTrackingMessagesByEmulator('sqs');
      
      // Filter by disposition
      results.tracking.deadletter = trackingMessages.filter(
        (msg) => msg.disposition === 'deadletter' && msg.queue === queueName
      );
      results.tracking.abandon = trackingMessages.filter(
        (msg) => msg.disposition === 'abandon' && msg.queue === queueName
      );
      results.tracking.defer = trackingMessages.filter(
        (msg) => msg.disposition === 'defer' && msg.queue === queueName
      );
    } catch (error) {
      this.logger.error(`Failed to get tracking messages: ${error}`);
    }

    // Try to receive abandoned/deferred messages from the main queue
    // These are messages that are still in the queue (not deleted)
    try {
      const receiveCommand = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ['All'],
        VisibilityTimeout: 0, // Make messages immediately visible
      });
      const response = await this.client.send(receiveCommand);
      
      if (response.Messages) {
        // Check each message's disposition from tracking or attributes
        for (const message of response.Messages) {
          const messageId = message.MessageId;
          if (messageId) {
            const tracking = await this.messageService.findOneTrackingByMessageId(messageId);
            const disposition = tracking?.disposition || 
                              message.MessageAttributes?.messageDisposition?.StringValue?.toLowerCase();
            
            if (disposition === 'abandon') {
              results.abandoned.push(message);
            } else if (disposition === 'defer') {
              results.deferred.push(message);
            } else if (disposition === 'deadletter') {
              // This shouldn't happen in main queue, but check anyway
              results.dlq.push(message);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to receive messages from queue: ${error}`);
    }

    return {
      queueName,
      queueUrl,
      dlqMessages: results.dlq,
      abandonedMessages: results.abandoned,
      deferredMessages: results.deferred,
      trackingMessages: results.tracking,
      summary: {
        dlq: results.dlq.length,
        abandoned: results.abandoned.length,
        deferred: results.deferred.length,
        trackingDeadletter: results.tracking.deadletter.length,
        trackingAbandon: results.tracking.abandon.length,
        trackingDefer: results.tracking.defer.length,
      },
    };
  }

  async receiveMessage(dto: ReceiveSqsMessageDto) {
    const queueName = dto.queueUrl
      ? this.extractQueueNameFromUrl(dto.queueUrl)
      : this.config.awsSqsQueueName;
    
    const queueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);

    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: dto.maxNumberOfMessages ?? 1,
      WaitTimeSeconds: dto.waitTimeSeconds ?? 0,
      MessageAttributeNames: ['All']
    });

    let response;
    try {
      response = await this.client.send(command);
    } catch (error) {
      // If queue doesn't exist, clear cache and retry once
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = (error as { name?: string })?.name || '';
      
      const isQueueNotExistError =
        errorMessage.includes('does not exist') ||
        errorMessage.includes('NonExistentQueue') ||
        errorName === 'QueueDoesNotExist';
      
      if (isQueueNotExistError) {
        this.logger.warn(`Queue ${queueName} not found when receiving message, clearing cache and retrying...`);
        // Clear cache and get/create queue again
        this.queueUrlCache.delete(queueName);
        const retryQueueUrl = await this.getOrCreateQueueUrl(dto.queueUrl || queueName);
        
        // Create new command with updated queue URL
        const retryCommand = new ReceiveMessageCommand({
          QueueUrl: retryQueueUrl,
          MaxNumberOfMessages: dto.maxNumberOfMessages ?? 1,
          WaitTimeSeconds: dto.waitTimeSeconds ?? 0,
          MessageAttributeNames: ['All'],
        });
        response = await this.client.send(retryCommand);
      } else {
        throw error;
      }
    }

    if (!response.Messages || response.Messages.length === 0) {
      return {
        success: false,
        message: 'No messages available',
        data: null,
      };
    }

    try {
      const message = response.Messages[0];
      const messageId = message.MessageId || message.ReceiptHandle?.substring(0, 20) || randomUUID();

      if (message.MessageId) {
        await this.messageService.markMessageReceived(message.MessageId, dto.receivedBy);
      }

      // Delete the message after receiving it
      if (message.ReceiptHandle) {
        const deleteCommand = new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        });
        await this.client.send(deleteCommand);
      }

      this.logger.log(`Received SQS message ${messageId} from ${queueName} by ${dto.receivedBy}`);

      return {
        success: true,
        message: 'Message received successfully',
        data: {
          queueName,
          queueUrl,
          messageId: message.MessageId,
          receiptHandle: message.ReceiptHandle,
          body: message.Body,
          messageAttributes: message.MessageAttributes,
          md5OfBody: message.MD5OfBody,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to receive message from ${queueName}:`, error);
      throw error;
    }
  }

  async ping(): Promise<void> {
    // Verify we can list/get queue URL
    try {
      const queueName = this.config.awsSqsQueueName;
      await this.getOrCreateQueueUrl(queueName);
    } catch (error) {
      // Handle AggregateError - extract underlying errors
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's an AggregateError and extract the actual error
      if (error && typeof error === 'object' && 'errors' in error && Array.isArray((error as { errors: unknown[] }).errors)) {
        const aggregateError = error as { errors: unknown[]; message: string };
        const firstError = aggregateError.errors[0];
        if (firstError instanceof Error) {
          errorMessage = firstError.message;
        } else {
          errorMessage = String(firstError) || aggregateError.message;
        }
      }
      
      const isConnectionError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('connect') ||
        errorMessage.includes('AggregateError') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('getaddrinfo') ||
        (error instanceof Error && error.name === 'AggregateError');
      
      if (isConnectionError) {
        throw new AwsSqsConnectionException(
          `Cannot connect to LocalStack at ${this.config.awsSqsEndpoint}. ` +
          `Please ensure LocalStack is running: docker-compose up localstack. ` +
          `Original error: ${errorMessage}`
        );
      }
      throw error;
    }
  }

  private parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  private extractQueueNameFromUrl(queueUrl: string): string {
    // Extract queue name from URL like: http://localhost:4566/000000000000/my-queue
    const parts = queueUrl.split('/');
    return parts[parts.length - 1];
  }

  private async getOrCreateQueueUrl(queueNameOrUrl: string): Promise<string> {
    // If it's already a URL, return it
    if (queueNameOrUrl.startsWith('http://') || queueNameOrUrl.startsWith('https://')) {
      return queueNameOrUrl;
    }

    // Check cache
    const cached = this.queueUrlCache.get(queueNameOrUrl);
    if (cached) {
      return cached;
    }

    try {
      // Try to get existing queue URL
      const getUrlCommand = new GetQueueUrlCommand({
        QueueName: queueNameOrUrl,
      });
      const response = await this.client.send(getUrlCommand);
      
      if (response.QueueUrl) {
        this.queueUrlCache.set(queueNameOrUrl, response.QueueUrl);
        return response.QueueUrl;
      }
    } catch (error) {
      // Log full error structure for debugging
      this.logger.debug(`GetQueueUrlCommand error for ${queueNameOrUrl}:`, {
        errorName: (error as { name?: string })?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : [],
      });
      
      // Check if it's a "queue doesn't exist" error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = (error as { name?: string })?.name || '';
      const errorCode = (error as { Code?: string })?.Code || '';
      
      // Check for specific "queue doesn't exist" errors
      // AWS SDK v3 uses name: "QueueDoesNotExist" or similar
      const isQueueNotExistError =
        errorMessage.includes('does not exist') ||
        errorMessage.includes('NonExistentQueue') ||
        errorMessage.includes('AWS.SimpleQueueService.NonExistentQueue') ||
        errorName === 'QueueDoesNotExist' ||
        errorName === 'AWS.SimpleQueueService.NonExistentQueue' ||
        errorCode === 'AWS.SimpleQueueService.NonExistentQueue' ||
        errorCode === 'NonExistentQueue';
      
      // Check for connection errors
      const isConnectionError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('connect') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('getaddrinfo') ||
        errorMessage.includes('EAI_AGAIN') ||
        errorMessage.includes('AggregateError') ||
        (error && typeof error === 'object' && 'errors' in error);
      
      if (isConnectionError) {
        throw new AwsSqsConnectionException(
          `Cannot connect to LocalStack at ${this.config.awsSqsEndpoint}. ` +
          `Please ensure LocalStack is running: docker-compose up localstack. ` +
          `Original error: ${errorMessage}`
        );
      }
      
      if (!isQueueNotExistError) {
        // Re-throw if it's not a "queue doesn't exist" error
        this.logger.error(`Failed to get queue URL for ${queueNameOrUrl}: ${errorMessage}`, error);
        throw error;
      }
      
      // Queue doesn't exist, try to create it
      this.logger.log(`Queue ${queueNameOrUrl} not found, attempting to create...`);
    }

    try {
      // Create queue if it doesn't exist
      this.logger.log(`Creating queue ${queueNameOrUrl}...`);
      const createCommand = new CreateQueueCommand({
        QueueName: queueNameOrUrl,
      });
      const createResponse = await this.client.send(createCommand);
      
      this.logger.debug(`CreateQueueCommand response:`, {
        queueUrl: createResponse.QueueUrl,
        responseMetadata: createResponse.$metadata,
      });
      
      if (!createResponse.QueueUrl) {
        throw new Error(`Queue creation succeeded but no QueueUrl was returned for ${queueNameOrUrl}`);
      }
      
      // Verify the queue exists by getting its URL again (LocalStack may need a moment)
      // This ensures the queue is fully created before we use it
      let verifiedUrl = createResponse.QueueUrl;
      const maxRetries = 3;
      const retryDelay = 100; // 100ms delay between retries
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Small delay before first verification attempt
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          const verifyCommand = new GetQueueUrlCommand({
            QueueName: queueNameOrUrl,
          });
          const verifyResponse = await this.client.send(verifyCommand);
          if (verifyResponse.QueueUrl) {
            verifiedUrl = verifyResponse.QueueUrl;
            break; // Success, exit retry loop
          }
        } catch (verifyError) {
          if (attempt === maxRetries - 1) {
            // Last attempt failed, log warning but use the URL from creation
            this.logger.warn(`Queue ${queueNameOrUrl} created but verification failed after ${maxRetries} attempts, using creation URL: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`);
          }
          // Continue to next retry attempt
        }
      }
      
      this.queueUrlCache.set(queueNameOrUrl, verifiedUrl);
      this.logger.log(`Created queue ${queueNameOrUrl} with URL: ${verifiedUrl}`);
      return verifiedUrl;
    } catch (error) {
      // Log full error structure for debugging
      this.logger.error(`CreateQueueCommand failed for ${queueNameOrUrl}:`, {
        errorName: (error as { name?: string })?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : [],
        errorCode: (error as { Code?: string })?.Code,
        errorFault: (error as { $fault?: string })?.$fault,
        errorMetadata: (error as { $metadata?: unknown })?.$metadata,
        fullError: error,
      });
      
      // Handle AggregateError - extract underlying errors
      let errorMessage = error instanceof Error ? error.message : String(error);
      let errorDetails = error instanceof Error ? error.stack : String(error);
      let isAggregateError = false;
      
      // Check if it's an AggregateError (Node.js AggregateError or AWS SDK AggregateError)
      if (error && typeof error === 'object') {
        // Check for Node.js AggregateError structure
        if ('errors' in error && Array.isArray((error as { errors: unknown[] }).errors)) {
          isAggregateError = true;
          const aggregateError = error as { errors: unknown[]; message: string };
          const firstError = aggregateError.errors[0];
          if (firstError instanceof Error) {
            errorMessage = firstError.message;
            errorDetails = firstError.stack || errorDetails;
          } else {
            errorMessage = String(firstError) || aggregateError.message;
          }
        }
        // Check error name
        if ((error instanceof Error && error.name === 'AggregateError') || errorMessage.includes('AggregateError')) {
          isAggregateError = true;
        }
      }
      
      // Check for connection-related errors
      const isConnectionError =
        isAggregateError ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('connect') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('getaddrinfo') ||
        errorMessage.includes('EAI_AGAIN') ||
        (error instanceof Error && (
          error.name === 'AggregateError' ||
          error.message.includes('connect')
        ));
      
      this.logger.error(`Failed to create queue ${queueNameOrUrl}: ${errorMessage}`, errorDetails);
      
      if (isConnectionError) {
        throw new AwsSqsConnectionException(
          `Cannot connect to LocalStack at ${this.config.awsSqsEndpoint}. ` +
          `Please ensure LocalStack is running: docker-compose up localstack. ` +
          `Original error: ${errorMessage}`
        );
      }
      
      throw new AwsSqsConnectionException(
        `Failed to create queue ${queueNameOrUrl}: ${errorMessage}`
      );
    }

    throw new Error(`Failed to get or create queue URL for ${queueNameOrUrl}`);
  }

  async onModuleInit() {
    this.logger.log('Initializing SQS worker...');
    try {
      // Start polling for messages in the default queue
      await this.startPolling(this.config.awsSqsQueueName);
      this.logger.log('SQS worker initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SQS worker:', error);
    }
  }

  async onModuleDestroy() {
    this.queueUrlCache.clear();
    // Stop all polling intervals
    for (const [queueName, interval] of this.pollingIntervals) {
      clearInterval(interval);
      this.logger.log(`Stopped polling for queue: ${queueName}`);
    }
    this.pollingIntervals.clear();
  }

  private async startPolling(queueName: string) {
    if (this.pollingIntervals.has(queueName)) {
      this.logger.warn(`Already polling for queue: ${queueName}`);
      return;
    }

    this.logger.log(`Starting to poll for messages in queue: ${queueName}`);

    const interval = setInterval(async () => {
      try {
        this.logger.debug(`Polling for messages in queue: ${queueName}`);
        await this.pollAndProcessMessages(queueName);
      } catch (error) {
        this.logger.error(`Error polling messages for queue ${queueName}:`, error);
      }
    }, 5000); // Poll every 5 seconds

    this.pollingIntervals.set(queueName, interval);
    this.logger.log(`Polling interval set up for queue: ${queueName}`);
  }

  private async pollAndProcessMessages(queueName: string) {
    try {
      this.logger.debug(`Attempting to get queue URL for: ${queueName}`);
      const queueUrl = await this.getOrCreateQueueUrl(queueName);
      this.logger.debug(`Got queue URL: ${queueUrl}`);

      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 0,
        MessageAttributeNames: ['All'],
      });

      this.logger.debug(`Sending receive command for queue: ${queueName}`);
      const response = await this.client.send(command);
      this.logger.debug(`Received response with ${response.Messages?.length || 0} messages`);

      if (!response.Messages || response.Messages.length === 0) {
        this.logger.debug(`No messages to process in queue: ${queueName}`);
        return; // No messages to process
      }

      const message = response.Messages[0];
      const messageId = message.MessageId || message.ReceiptHandle?.substring(0, 20) || randomUUID();
      const receivedBy = 'sqs-worker';

      // Extract disposition from message attributes (default to 'complete')
      const disposition = this.extractDispositionFromMessage(message) || 'complete';

      this.logger.log(`Processing SQS message ${messageId} with disposition: ${disposition}`);

      // Mark message as received
      if (message.MessageId) {
        await this.messageService.markMessageReceived(message.MessageId, receivedBy);
        const dispositionResult = await this.messageService.updateDisposition(message.MessageId, disposition);
        this.logger.log(`Updated SQS message ${messageId} disposition to ${disposition}, result: ${!!dispositionResult}`);
      }

      // Add random delay before handling disposition (simulate processing)
      await randomDelay();

      // Handle message based on disposition
      await this.handleMessageDisposition(queueUrl, message, messageId, disposition, queueName);

    } catch (error) {
      // Log but don't throw - we want polling to continue
      this.logger.error(`Error processing messages for queue ${queueName}:`, error);
    }
  }

  private extractDispositionFromMessage(message: Message): string | null {
    // Check message attributes for disposition
    if (message.MessageAttributes?.messageDisposition?.StringValue) {
      return message.MessageAttributes.messageDisposition.StringValue;
    }
    // Check body for disposition (fallback)
    if (message.Body) {
      try {
        const body = JSON.parse(message.Body);
        if (body.messageDisposition) {
          return body.messageDisposition;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    return null;
  }

  private async handleMessageDisposition(
    queueUrl: string,
    message: Message,
    messageId: string,
    disposition: string,
    queueName: string
  ): Promise<void> {
    const dispositionLower = disposition.toLowerCase();

    switch (dispositionLower) {
      case 'complete':
        // Delete the message after successful processing
        if (message.ReceiptHandle) {
          const deleteCommand = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          });
          await this.client.send(deleteCommand);
          this.logger.log(`Completed and deleted SQS message ${messageId} from ${queueName}`);
        }
        break;

      case 'abandon':
        // Don't delete the message - it will become visible again after visibility timeout
        // This simulates abandoning the message for retry
        this.logger.log(`Abandoned SQS message ${messageId} in ${queueName} (will retry after visibility timeout)`);
        break;

      case 'deadletter':
        // For SQS, we can't directly move to DLQ like Service Bus
        // Instead, we'll log it and not delete (effectively abandoning permanently)
        // In a real implementation, you would configure redrive policies
        this.logger.warn(`Dead-letter requested for SQS message ${messageId} in ${queueName} (not deleting - configure redrive policy for DLQ)`);
        // Don't delete - message will be retried until redrive policy moves it to DLQ
        break;

      case 'defer':
        // Change visibility timeout to defer processing (set to 5 minutes)
        if (message.ReceiptHandle) {
          const visibilityCommand = new ChangeMessageVisibilityCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
            VisibilityTimeout: 300, // 5 minutes
          });
          await this.client.send(visibilityCommand);
          this.logger.log(`Deferred SQS message ${messageId} in ${queueName} (visibility timeout: 5 minutes)`);
        }
        break;

      default:
        // Default to complete
        this.logger.warn(`Unknown disposition '${disposition}' for message ${messageId}, defaulting to complete`);
        if (message.ReceiptHandle) {
          const deleteCommand = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          });
          await this.client.send(deleteCommand);
        }
        break;
    }
  }
}

