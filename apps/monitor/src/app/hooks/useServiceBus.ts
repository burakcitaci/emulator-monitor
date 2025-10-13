/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';

interface Namespace {
  name: string;
  topics: Array<{
    name: string;
    properties: {
      DefaultMessageTimeToLive: string;
      DuplicateDetectionHistoryTimeWindow: string;
      RequiresDuplicateDetection: boolean;
    };
    subscriptions: Array<{
      name: string;
      deadLetteringOnMessageExpiration: boolean;
      maxDeliveryCount: number;
    }>;
  }>;
}

interface SendMessageOptions {
  namespace: string;
  topic: string;
  message: {
    body: any;
    contentType?: string;
    messageId?: string;
    correlationId?: string;
    subject?: string;
    timeToLive?: number;
    applicationProperties?: Record<string, any>;
  };
}

interface SendBatchOptions {
  namespace: string;
  topic: string;
  messages: Array<{
    body: any;
    contentType?: string;
    messageId?: string;
    correlationId?: string;
    subject?: string;
    applicationProperties?: Record<string, any>;
  }>;
}

interface DeadLetterMessageOptions {
  namespace: string;
  topic: string;
  subscription: string;
  maxMessages?: number;
  maxWaitTimeInSeconds?: number;
}

interface MessageFetchOptions {
  namespace: string;
  queue?: string;
  topic?: string;
  subscription?: string;
  maxMessages?: number;
}

export interface DeadLetterMessage {
  body: any;
  messageId?: string;
  correlationId?: string;
  subject?: string;
  contentType?: string;
  deliveryCount?: number;
  enqueuedTimeUtc?: Date;
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
  applicationProperties?: Record<string, any>;
  status?: string;
  state?: string;
  sequenceNumber?: number;
}
export interface DeadLetterMessageResponse {
  success: boolean;
  messageCount: number;
  messages: DeadLetterMessage[];
  entityPath: string;
}

export interface MessageResponse {
  success: boolean;
  messageCount: number;
  messages: Message[];
  entityPath: string;
}

interface UseServiceBusReturn {
  namespaces: Namespace[];
  loading: boolean;
  error: Error | null;
  isInitialized: boolean;
  fetchNamespaces: () => Promise<void>;
  sendMessage: (options: SendMessageOptions) => Promise<{
    success: boolean;
    messageId?: string;
    namespace?: string;
    topic?: string;
  }>;
  sendMessageBatch: (options: SendBatchOptions) => Promise<{
    success: boolean;
    messageCount?: number;
    namespace?: string;
    topic?: string;
  }>;
  getDeadLetterMessages: (
    options: DeadLetterMessageOptions
  ) => Promise<DeadLetterMessageResponse>;
  getMessages: (options: MessageFetchOptions) => Promise<MessageResponse>;
}

const API_BASE_URL = 'http://localhost:3000/api/v1';

export const useServiceBus = (): UseServiceBusReturn => {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchNamespaces = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/servicebus/namespaces`);

      if (!response.ok) {
        // If service unavailable, it might mean Service Bus is not initialized yet
        if (response.status === 503) {
          setNamespaces([]);
          setIsInitialized(false);
          return;
        }
        throw new Error('Failed to fetch namespaces');
      }

      const data = await response.json();

      if (data.success) {
        setNamespaces(data.namespaces || []);
        setIsInitialized(true);
      } else {
        setNamespaces([]);
        setIsInitialized(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setNamespaces([]);
      setIsInitialized(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (options: SendMessageOptions) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/servicebus/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      console.log('Send message response:', response);
      if (!response.ok) {
        // If service unavailable, it might mean Service Bus is not initialized yet
        if (response.status === 503) {
          throw new Error(
            'Service Bus is not initialized. Please ensure Service Bus is properly configured.'
          );
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessageBatch = useCallback(async (options: SendBatchOptions) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/servicebus/send-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        // If service unavailable, it might mean Service Bus is not initialized yet
        if (response.status === 503) {
          throw new Error(
            'Service Bus is not initialized. Please ensure Service Bus is properly configured.'
          );
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message batch');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDeadLetterMessages = useCallback(
    async (options: DeadLetterMessageOptions) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          namespace: options.namespace,
          topic: options.topic,
          subscription: options.subscription,
          ...(options.maxMessages && {
            maxMessages: options.maxMessages.toString(),
          }),
          ...(options.maxWaitTimeInSeconds && {
            maxWaitTimeInSeconds: options.maxWaitTimeInSeconds.toString(),
          }),
        });

        const response = await fetch(
          `${API_BASE_URL}/servicebus/dead-letter-messages?${params}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          // If service unavailable, it might mean Service Bus is not initialized yet
          if (response.status === 503) {
            throw new Error(
              'Service Bus is not initialized. Please ensure Service Bus is properly configured.'
            );
          }
          const errorData = await response.json();
          throw new Error(
            errorData.message || 'Failed to retrieve dead letter messages'
          );
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getMessages = useCallback(async (options: MessageFetchOptions) => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters for filtering
      const params = new URLSearchParams();

      if (options.queue) {
        params.append('queue', options.queue);
      }
      if (options.topic) {
        params.append('topic', options.topic);
      }
      if (options.subscription) {
        params.append('subscription', options.subscription);
      }
      if (options.maxMessages) {
        params.append('maxMessages', options.maxMessages.toString());
      }

      // Fetch filtered messages from the messages controller (database)
      const url = `${API_BASE_URL}/messages`;
      const response = await fetch(url);
      const result = await response.json();
      console.log('Fetch messages response:', result);

      if (!response.ok) {
        // If service unavailable, it might mean Service Bus is not initialized yet
        throw new Error(result.message || 'Failed to fetch messages');
      }

      const messages: any[] = result;
      const entityPath =
        options.queue ||
        (options.topic && options.subscription
          ? `${options.topic}/${options.subscription}`
          : options.topic || 'unknown');

      return {
        success: true,
        messageCount: messages.length,
        messages: messages,
        entityPath,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    namespaces,
    loading,
    error,
    isInitialized,
    fetchNamespaces,
    sendMessage,
    sendMessageBatch,
    getDeadLetterMessages,
    getMessages,
  };
};

/**
 * Azure Service Bus Message Status
 * Tracks the processing status of a message
 */
export enum MessageStatus {
  ACTIVE = 'active', // Message is available for processing
  DEFERRED = 'deferred', // Message processing postponed
  SCHEDULED = 'scheduled', // Message scheduled for future delivery
  DEAD_LETTERED = 'dead-lettered', // Message moved to Dead Letter Queue
  COMPLETED = 'completed', // Message successfully processed
  ABANDONED = 'abandoned', // Message processing failed, returned to queue
  RECEIVED = 'received', // Message received but not yet completed
}

/**
 * Azure Service Bus Message State
 * The actual state of the message in Service Bus
 */
export enum MessageState {
  ACTIVE = 'active',
  DEFERRED = 'deferred',
  SCHEDULED = 'scheduled',
  DEAD_LETTERED = 'dead-lettered',
}

export interface Message {
  _id?: string;
  body: unknown;

  messageId?: string | number;

  contentType?: string;

  correlationId?: string | number;

  partitionKey?: string;

  sessionId?: string;

  replyToSessionId?: string;

  timeToLive?: number;

  subject?: string;

  to?: string;

  replyTo?: string;

  scheduledEnqueueTimeUtc?: Date;

  applicationProperties?: Map<string, string | number | boolean | Date | null>;

  /**
   * Processing status of the message
   */
  status?:
    | 'active'
    | 'deferred'
    | 'scheduled'
    | 'dead-lettered'
    | 'completed'
    | 'abandoned'
    | 'received';

  /**
   * Azure Service Bus state
   */
  state?: 'active' | 'deferred' | 'scheduled' | 'dead-lettered';

  /**
   * Queue or topic/subscription path
   */
  queue?: string;

  /**
   * Sequence number for deferred messages
   */
  sequenceNumber?: number;

  /**
   * When the message was enqueued in Service Bus
   */
  enqueuedTimeUtc?: Date;

  /**
   * Last updated timestamp
   */
  lastUpdated?: Date;

  rawAmqpMessage?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}
