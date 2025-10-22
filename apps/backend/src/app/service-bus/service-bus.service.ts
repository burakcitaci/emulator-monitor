/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusMessage,
  ServiceBusReceiver,
} from '@azure/service-bus';
import {
  SendMessageDto,
  SendBatchDto,
  InitializeResponse,
  GetNamespacesResponse,
  SendMessageResponse,
  SendBatchResponse,
  ServiceBusConfig,
  DeadLetterMessageResponse,
} from '@e2e-monitor/entities';

import { ConfigService } from '../common/config.service';
import { MessageService } from '../messages/messages.service';
import { mapToMessage } from '../messages/messages.mapper';

@Injectable()
export class ServiceBusService implements OnModuleDestroy, OnModuleInit {
  private readonly clients: Map<string, ServiceBusClient> = new Map();
  private readonly senders: Map<string, ServiceBusSender> = new Map();
  private readonly receivers: Map<string, ServiceBusReceiver> = new Map(); // 👈 New Map for receivers
  private config: ServiceBusConfig | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly messageService: MessageService
  ) {}

  /**
   * Initialize Service Bus with configuration
   */
  async initialize(
    config: ServiceBusConfig,
    connectionString: string
  ): Promise<InitializeResponse> {
    // Close existing connections before reinitializing
    await this.cleanup();

    this.config = config;

    console.log(
      'Initializing Service Bus with config:',
      JSON.stringify(config, null, 2)
    );
    console.log('Using connection string (key masked):', connectionString.replace(/SharedAccessKey=[^;]+/, 'SharedAccessKey=***'));

    // Create clients for each namespace
    for (const namespace of config.UserConfig.Namespaces) {
      try {
        console.log(`Creating client for namespace: ${namespace.Name}`);
        const client = new ServiceBusClient(connectionString);
        this.clients.set(namespace.Name, client);

        // Test the connection by trying to create a receiver for an existing queue
        console.log(`Testing connection for namespace: ${namespace.Name}`);
        try {
          const testReceiver = client.createReceiver('orders-queue'); // Use a queue from config
          await testReceiver.close();
          console.log(`✓ Successfully connected to namespace: ${namespace.Name}`);
        } catch (error) {
          console.warn(`Could not test connection for namespace ${namespace.Name}:`, error instanceof Error ? error.message : String(error));
          // Continue initialization even if test fails
        }

        // Create senders for each topic
        if (namespace.Topics && Array.isArray(namespace.Topics)) {
          for (const topic of namespace.Topics) {
            const senderKey = `${namespace.Name}:${topic.Name}`;
            console.log(`Creating topic sender with key: ${senderKey}`);
            const sender = client.createSender(topic.Name);
            this.senders.set(senderKey, sender);
            console.log(`✓ Topic sender created and stored for: ${senderKey}`);

            // Create subscriptions for each topic
            if (topic.Subscriptions && Array.isArray(topic.Subscriptions)) {
              for (const subscription of topic.Subscriptions) {
                const subscriptionPath = `${topic.Name}/Subscriptions/${subscription.Name}`;
                console.log(`Creating subscription: ${subscriptionPath}`);
                try {
                  await client.createSubscription(topic.Name, subscription.Name, {
                    maxDeliveryCount: subscription.MaxDeliveryCount || 10,
                    deadLetteringOnMessageExpiration: subscription.DeadLetteringOnMessageExpiration || true,
                  });
                  console.log(`✓ Subscription created: ${subscriptionPath}`);
                } catch (error) {
                  // Subscription might already exist, that's okay
                  console.log(`Subscription ${subscriptionPath} might already exist:`, error instanceof Error ? error.message : String(error));
                }
              }
            }
          }
        }

        // Create senders for each queue
        if (namespace.Queues && Array.isArray(namespace.Queues)) {
          for (const queue of namespace.Queues) {
            const senderKey = `${namespace.Name}:${queue.Name}`;
            console.log(`Creating queue sender with key: ${senderKey}`);
            const sender = client.createSender(queue.Name);
            this.senders.set(senderKey, sender);
            console.log(`✓ Queue sender created and stored for: ${senderKey}`);

            // Create the queue if it doesn't exist
            try {
              await client.createQueue(queue.Name, {
                maxDeliveryCount: queue.Properties.MaxDeliveryCount || 10,
                deadLetteringOnMessageExpiration: queue.Properties.DeadLetteringOnMessageExpiration || true,
                defaultMessageTimeToLive: queue.Properties.DefaultMessageTimeToLive || 'PT1H',
              });
              console.log(`✓ Queue created: ${queue.Name}`);
            } catch (error) {
              // Queue might already exist, that's okay
              console.log(`Queue ${queue.Name} might already exist:`, error instanceof Error ? error.message : String(error));
            }
          }
        }
      } catch (error: any) {
        throw new Error(
          `Failed to initialize Service Bus for namespace ${namespace.Name}: ${error.message}`
        );
      }
    }

    console.log('All senders created. Total senders:', this.senders.size);
    console.log('Sender keys:', Array.from(this.senders.keys()));

    return {
      success: true,
      message: 'Service Bus initialized successfully',
      namespaces: config.UserConfig.Namespaces.map((ns) => ({
        name: ns.Name,
        topics: (ns.Topics ?? []).map((t) => t.Name),
        queues: (ns.Queues ?? []).map((q) => q.Name),
      })),
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ServiceBusConfig | null {
    return this.config;
  }

  /**
   * Get all namespaces and topics
   */
  getNamespacesAndTopics(): GetNamespacesResponse {
    if (!this.config) {
      return {
        success: false,
        message: 'Service Bus not initialized',
        namespaces: [],
      };
    }

    return {
      success: true,
      namespaces: this.config.UserConfig.Namespaces.map((ns) => ({
        name: ns.Name,
        topics: (ns.Topics ?? []).map((topic) => ({
          name: topic.Name,
          properties: topic.Properties,
          subscriptions: (topic.Subscriptions ?? []).map((sub) => ({
            name: sub.Name,
            deadLetteringOnMessageExpiration:
              sub.DeadLetteringOnMessageExpiration,
            maxDeliveryCount: sub.MaxDeliveryCount,
          })),
        })),
        queues: (ns.Queues ?? []).map((queue) => ({
          name: queue.Name,
          properties: queue.Properties,
        })),
      })),
    };
  }

  /**
   * Send a message to a topic
   */
  async sendMessage(dto: SendMessageDto): Promise<SendMessageResponse> {
    console.log('Sending message to:', dto.topic);
    const senderKey = `${dto.namespace}:${dto.topic}`;
    console.log(`Looking for sender with key: ${senderKey}`);
    console.log(`Available senders:`, Array.from(this.senders.keys()));

    const sender = this.senders.get(senderKey);

    if (!sender) {
      console.error(`Sender not found! Looking for: ${senderKey}`);
      console.error(
        `Available senders: ${Array.from(this.senders.keys()).join(', ')}`
      );
      throw new Error(
        `No sender found for namespace: ${dto.namespace}, topic: ${dto.topic}. Make sure Service Bus is initialized.`
      );
    }

    try {
      const message: ServiceBusMessage = {
        body: dto.message.body,
        contentType: dto.message.contentType || 'application/json',
        messageId: dto.message.messageId || this.generateMessageId(),
        correlationId: dto.message.correlationId,
        subject: dto.message.subject,
        applicationProperties: dto.message.applicationProperties || {},
      };

      const mappedMessage = mapToMessage(message);
      
      // Set the queue field based on the topic and subscription from applicationProperties
      // This ensures proper tracking when messages are completed
      if (mappedMessage.applicationProperties) {
        const appProps = mappedMessage.applicationProperties instanceof Map 
          ? Object.fromEntries(mappedMessage.applicationProperties) 
          : mappedMessage.applicationProperties;
        
        if (appProps.topic && appProps.subscription) {
          // For topics, store as "topic/subscription" to match monitoring format
          mappedMessage.queue = `${appProps.topic}/${appProps.subscription}`;
        } else if (appProps.topic) {
          // If no subscription specified, just use topic name
          mappedMessage.queue = appProps.topic;
        } else if (appProps.queue) {
          // For queues, use the queue name
          mappedMessage.queue = appProps.queue;
        }
      }
      
      // Fallback: use the topic name if queue still not set
      if (!mappedMessage.queue) {
        mappedMessage.queue = dto.topic;
      }
      
      await this.messageService.saveReceivedMessage(mappedMessage); // Save the message to MongoDB
      await sender.sendMessages(message);

      return {
        success: true,
        message: 'Message sent successfully',
        messageId: message.messageId ? String(message.messageId) : undefined,
        namespace: dto.namespace,
        topic: dto.topic,
      };
    } catch (error: any) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Send multiple messages in a batch
   */
  async sendMessageBatch(dto: SendBatchDto): Promise<SendBatchResponse> {
    const senderKey = `${dto.namespace}:${dto.topic}`;
    const sender = this.senders.get(senderKey);

    if (!sender) {
      throw new Error(
        `No sender found for namespace: ${dto.namespace}, topic: ${dto.topic}`
      );
    }

    try {
      const batch = await sender.createMessageBatch();
      const serviceBusMessages: ServiceBusMessage[] = dto.messages.map(
        (msg: any) => ({
          body: msg.body,
          contentType: msg.contentType || 'application/json',
          messageId: msg.messageId || this.generateMessageId(),
          correlationId: msg.correlationId,
          subject: msg.subject,
          applicationProperties: msg.applicationProperties || {},
        })
      );

      for (const message of serviceBusMessages) {
        const added = batch.tryAddMessage(message);
        if (!added) {
          throw new Error('Message batch is full');
        }
      }

      await sender.sendMessages(batch);

      return {
        success: true,
        message: `Batch of ${dto.messages.length} messages sent successfully`,
        messageCount: dto.messages.length,
        namespace: dto.namespace,
        topic: dto.topic,
      };
    } catch (error: any) {
      throw new Error(`Failed to send message batch: ${error.message}`);
    }
  }

  /**
   * Gets messages from a Subscription's Dead Letter Queue.
   * @param namespace The Service Bus namespace name.
   * @param topic The topic name.
   * @param subscription The subscription name whose DLQ is to be read.
   * @param maxMessages The maximum number of messages to retrieve (default: 10).
   * @param maxWaitTimeInSeconds The maximum time to wait for messages (default: 5).
   */
  public async receiveDeadLetterMessages(
    namespace: string,
    topic: string,
    subscription: string,
    maxMessages = 10,
    maxWaitTimeInSeconds = 5
  ): Promise<DeadLetterMessageResponse> {
    console.log(`Looking for client with namespace: "${namespace}"`);
    console.log(`Available clients:`, Array.from(this.clients.keys()));

    const client = this.clients.get(namespace);
    if (!client) {
      throw new Error(
        `Client for namespace "${namespace}" not found. Available namespaces: ${Array.from(
          this.clients.keys()
        ).join(', ')}`
      );
    }

    // Dead Letter Queue path format: <topic_name>/Subscriptions/<subscription_name>/$DeadLetterQueue
    const entityPath = `${topic}/Subscriptions/${subscription}/$DeadLetterQueue`;
    const receiverKey = `${namespace}:${entityPath}`;

    // Check if receiver exists and close it to prevent "already receiving" error
    const existingReceiver = this.receivers.get(receiverKey);
    if (existingReceiver) {
      try {
        console.log(`Closing existing receiver for: ${receiverKey}`);
        await existingReceiver.close();
        this.receivers.delete(receiverKey);
      } catch (error) {
        console.error(`Error closing existing receiver: ${error}`);
      }
    }

    // Create a fresh receiver for this request
    let receiver: ServiceBusReceiver | null = null;

    try {
      console.log(`Creating new DLQ receiver for: ${receiverKey}`);
      receiver = client.createReceiver(entityPath, { receiveMode: 'peekLock' });

      console.log(
        `Attempting to receive up to ${maxMessages} messages from DLQ...`
      );

      const messages = await receiver.receiveMessages(maxMessages, {
        maxWaitTimeInMs: maxWaitTimeInSeconds * 1000,
      });

      console.log(`Received ${messages.length} messages from DLQ.`);

      // Transform messages to plain objects to avoid circular reference errors
      const serializedMessages = messages.map((msg) => ({
        body: msg.body,
        messageId: msg.messageId,
        correlationId: msg.correlationId,
        subject: msg.subject,
        contentType: msg.contentType,
        deliveryCount: msg.deliveryCount,
        enqueuedTimeUtc: msg.enqueuedTimeUtc,
        enqueuedSequenceNumber: msg.enqueuedSequenceNumber,
        sequenceNumber: msg.sequenceNumber,
        deadLetterReason: msg.deadLetterReason,
        deadLetterErrorDescription: msg.deadLetterErrorDescription,
        applicationProperties: msg.applicationProperties,
        state: msg.state,
      }));

      return {
        success: true,
        messageCount: messages.length,
        messages: serializedMessages,
        entityPath: receiver.entityPath,
      };
    } catch (error: any) {
      throw new Error(`Failed to receive DLQ messages: ${error.message}`);
    } finally {
      // Always close the receiver after use to prevent "already receiving" errors
      if (receiver) {
        try {
          console.log(`Closing receiver after use: ${receiverKey}`);
          await receiver.close();
        } catch (error) {
          console.error(`Error closing receiver in finally: ${error}`);
        }
      }
    }
  }

  /**
   * Peek active messages from a queue or topic/subscription (non-destructive)
   */
  public async receiveActiveMessages(
    namespace: string,
    entity: string,
    subscription?: string,
    maxMessages = 10
  ): Promise<DeadLetterMessageResponse> {
    const client = this.clients.get(namespace);
    if (!client) {
      throw new Error(`Client for namespace "${namespace}" not found.`);
    }

    const entityPath = subscription
      ? `${entity}/Subscriptions/${subscription}`
      : entity;

    const receiverKey = `${namespace}:${entityPath}:peek`;
    const existingReceiver = this.receivers.get(receiverKey);
    if (existingReceiver) {
      try {
        await existingReceiver.close();
        this.receivers.delete(receiverKey);
      } catch (error) {
        throw new Error(`Error closing existing receiver: ${error}`);
      }
    }

    let receiver: ServiceBusReceiver | null = null;
    try {
      receiver = client.createReceiver(entityPath, { receiveMode: 'peekLock' });

      // Use non-destructive peekMessages
      const messages = await receiver.peekMessages(maxMessages);

      const serializedMessages = messages.map((msg) => ({
        body: msg.body,
        messageId: msg.messageId,
        correlationId: msg.correlationId,
        subject: msg.subject,
        contentType: msg.contentType,
        deliveryCount: msg.deliveryCount,
        enqueuedTimeUtc: msg.enqueuedTimeUtc,
        enqueuedSequenceNumber: msg.enqueuedSequenceNumber,
        sequenceNumber: msg.sequenceNumber,
        applicationProperties: msg.applicationProperties,
        state: msg.state,
      }));

      return {
        success: true,
        messageCount: messages.length,
        messages: serializedMessages,
        entityPath,
      };
    } catch (error: any) {
      throw new Error(`Failed to peek messages: ${error.message}`);
    } finally {
      if (receiver) {
        try {
          await receiver.close();
        } catch (error) {
          // ignore
        }
      }
    }
  }
  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Cleanup connections
   */
  private async cleanup() {
    // Close all senders
    for (const [key, sender] of this.senders.entries()) {
      try {
        await sender.close();
      } catch (error) {
        console.error(`Error closing sender ${key}:`, error);
      }
    }

    // Close all DLQ receivers 👈 New cleanup
    for (const [key, receiver] of this.receivers.entries()) {
      try {
        await receiver.close();
      } catch (error) {
        console.error(`Error closing receiver ${key}:`, error);
      }
    }

    for (const [key, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing client ${key}:`, error);
      }
    }

    this.senders.clear();
    this.receivers.clear(); // 👈 Clear new map
    this.clients.clear();
  }

  /**
   * Auto-initialize Service Bus when module starts
   */
  async onModuleInit() {
    // Skip initialization if SERVICE_BUS_AUTO_INIT is explicitly disabled
    if (process.env.SERVICE_BUS_AUTO_INIT === 'false') {
      console.log('Service Bus auto-initialization disabled (SERVICE_BUS_AUTO_INIT=false)');
      return;
    }

    // Skip initialization in development if SERVICE_BUS_AUTO_INIT is not set
    if (process.env.NODE_ENV === 'development' && !process.env.SERVICE_BUS_AUTO_INIT) {
      console.log('Skipping Service Bus auto-initialization in development mode');
      return;
    }

    try {
      // Load configuration from file
      const config = this.configService.getServiceBusConfiguration();
      const connectionString = this.configService.serviceBusConnectionString;

      console.log('Auto-initializing Service Bus on module start...');
      console.log('Connection string:', connectionString.replace(/SharedAccessKey=[^;]+/, 'SharedAccessKey=***'));
      console.log('Environment:', process.env.NODE_ENV || 'production');

      // Check if Service Bus emulator is accessible first
      console.log('Checking Service Bus emulator connectivity...');
      if (!await this.checkEmulatorConnectivity(connectionString)) {
        console.warn('Service Bus emulator is not accessible. Skipping initialization.');
        console.warn('Please ensure:');
        console.warn('1. Service Bus emulator is running (docker-compose up)');
        console.warn('2. Connection string is correct');
        console.warn('3. Port 5672 is accessible');
        return;
      }

      await this.initialize(config, connectionString);
      console.log('Service Bus auto-initialization completed');
    } catch (error) {
      console.error('Failed to auto-initialize Service Bus:', error);
      console.error('This is non-fatal - the service will remain uninitialized');
      console.error('To disable auto-initialization, set SERVICE_BUS_AUTO_INIT=false');
      console.error('To check emulator status, run: docker-compose ps | grep emulator');
      // Don't throw error here as it might prevent the app from starting
      // The service will remain uninitialized and endpoints will handle this gracefully
    }
  }

  /**
   * Check if Service Bus emulator is accessible
   */
  private async checkEmulatorConnectivity(connectionString: string): Promise<boolean> {
    try {
      const client = new ServiceBusClient(connectionString);
      const testReceiver = client.createReceiver('test-queue');

      // Try to peek (this will fail if entity doesn't exist, but connection should work)
      try {
        await testReceiver.peekMessages(1);
      } catch (peekError) {
        // Entity not found is okay - it means connection works but queue doesn't exist
        if (peekError instanceof Error && peekError.message.includes('not found')) {
          console.log('Service Bus emulator connection successful (entity not found is expected)');
        } else {
          throw peekError;
        }
      }

      await testReceiver.close();
      await client.close();
      return true;
    } catch (error) {
      console.error('Service Bus emulator connectivity check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.cleanup();
  }
}
