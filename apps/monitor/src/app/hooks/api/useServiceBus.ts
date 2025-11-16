/* eslint-disable @typescript-eslint/no-explicit-any */
import { Message } from '@e2e-monitor/entities';
import { useCallback, useState } from 'react';
import { useServiceBusConfig } from './useServiceBusConfig';


// Type for sent messages
export interface SentMessage {
  messageId?: string;
  queue?: string;
  topic?: string;
  subscription?: string;
  body?: any;
  applicationProperties?: Record<string, any>;
  contentType?: string;
  subject?: string;
  correlationId?: string;
  state?: 'sent' | 'delivered' | 'failed';
  timeToLive?: number;
  sentViaUI?: boolean;
  sentBy?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  sequenceNumber?: number;
  enqueuedTimeUtc?: Date;
  createdAt?: Date;
  lastUpdated?: Date;
}

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
    messageId?: string | number;
    correlationId?: string;
    subject?: string;
    timeToLive?: number;
    applicationProperties?: Record<string, any>;
    sentBy?: string;
    recievedBy?: string;
    sentAt?: Date;
    recievedAt?: Date;
  };
}

interface SendBatchOptions {
  namespace: string;
  topic: string;
  messages: Array<{
    body: any;
    contentType?: string;
    messageId?: string | number;
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

interface SentMessageFetchOptions {
  namespace?: string;
  queue?: string;
  topic?: string;
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

export interface SentMessageResponse {
  success: boolean;
  messageCount: number;
  messages: SentMessage[];
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
  getMessages: (options: MessageFetchOptions) => Promise<MessageResponse>; // Gets received messages from Service Bus monitoring
  getSentMessages: (options?: SentMessageFetchOptions) => Promise<SentMessageResponse>; // Gets messages sent via UI
}

const API_BASE_URL = 'http://localhost:3000/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) throw new Error((await res.text()) || 'Request failed');
  return (await res.json()) as T;
}

export const useServiceBus = (): UseServiceBusReturn => {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { queuesAndTopics}  = useServiceBusConfig();
  const fetchNamespaces = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<{ success: boolean; namespaces: Namespace[] }>(
        `/servicebus/namespaces`
      );
      if (data.success) {
        setNamespaces(data.namespaces || []);
        setIsInitialized(true);
        setError(null);
      } else {
        setNamespaces([]);
        setIsInitialized(false);
      }
    } catch (err) {
      setNamespaces([]);
      setIsInitialized(false);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  function iso8601DurationToSeconds(duration: any) {
  // Remove 'P' prefix and split by 'T' to separate date and time parts
  const matches = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  
  if (!matches) {
    throw new Error('Invalid ISO 8601 duration format');
  }

  const days = parseInt(matches[1] || 0);
  const hours = parseInt(matches[2] || 0);
  const minutes = parseInt(matches[3] || 0);
  const seconds = parseFloat(matches[4] || 0);

  return (days * 86400) + (hours * 3600) + (minutes * 60) + seconds;
}
  const sendMessage = useCallback(async (options: SendMessageOptions) => {
    setLoading(true);
    try {

      console.log('Available queues/topics:', queuesAndTopics.find(qt => qt.name === options.topic));
      const config = queuesAndTopics.find(qt => qt.name === options.topic);
      options.message.timeToLive = config ? iso8601DurationToSeconds(config.properties.DefaultMessageTimeToLive) : undefined;
      console.log('Sending message with options:', options);
      const data = await request(`/servicebus/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      setError(null);
      return data as {
        success: boolean;
        messageId?: string;
        namespace?: string;
        topic?: string;
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessageBatch = useCallback(async (options: SendBatchOptions) => {
    setLoading(true);
    setError(null);
    try {
      const data = await request(`/servicebus/send-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      setError(null);
      return data as {
        success: boolean;
        messageCount?: number;
        namespace?: string;
        topic?: string;
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
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

        return await request<DeadLetterMessageResponse>(
          `${`/servicebus/dead-letter-messages`}?${params}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
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
      const params = new URLSearchParams();
      if (options.queue) params.append('queue', options.queue);
      if (options.topic) params.append('topic', options.topic);
      if (options.subscription)
        params.append('subscription', options.subscription);
      if (options.maxMessages)
        params.append('maxMessages', options.maxMessages.toString());

      const result = await request<any[]>(
        `/messages/received${params.toString() ? `?${params.toString()}` : ''}`
      );

      console.log('Fetched received messages:', result);
      const entityPath =
        options.queue ||
        (options.topic && options.subscription
          ? `${options.topic}/${options.subscription}`
          : options.topic || 'unknown');

      return {
        success: true,
        messageCount: result.length,
        messages: result,
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

  const getSentMessages = useCallback(async (options?: SentMessageFetchOptions) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options?.namespace) params.append('namespace', options.namespace);
      if (options?.queue) params.append('queue', options.queue);
      if (options?.topic) params.append('topic', options.topic);
      if (options?.maxMessages)
        params.append('maxMessages', options.maxMessages.toString());

      const result = await request<SentMessageResponse>(
        `/servicebus/sent-messages${params.toString() ? `?${params.toString()}` : ''}`
      );

      console.log('Fetched sent messages:', result);
      return result;
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
    getSentMessages,
  };
};
