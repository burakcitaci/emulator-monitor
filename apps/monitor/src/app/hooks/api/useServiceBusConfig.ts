import { useState, useEffect } from 'react';
import { ServiceBusConfig, QueueTopicItem } from '@e2e-monitor/entities';

type BackendSubscriptionDto = {
  name: string;
  deadLetteringOnMessageExpiration?: boolean;
  maxDeliveryCount?: number;
};

type BackendTopicDto = {
  name: string;
  properties?: Record<string, unknown>;
  subscriptions?: BackendSubscriptionDto[];
};

type BackendQueueDto = {
  name: string;
  properties?: Record<string, unknown>;
};

type BackendNamespaceDto = {
  name: string;
  topics?: BackendTopicDto[];
  queues?: BackendQueueDto[];
};

type BackendResponse = {
  success?: boolean;
  namespaces?: BackendNamespaceDto[];
  message?: string;
};

// Helper: convert backend DTO into the internal ServiceBusConfig shape.
// Implemented as top-level helpers to reduce nesting and cognitive complexity.
const makeSubscription = (s: BackendSubscriptionDto) => ({
  Name: s.name,
  DeadLetteringOnMessageExpiration: !!s.deadLetteringOnMessageExpiration,
  MaxDeliveryCount: s.maxDeliveryCount ?? 0,
});

const makeTopic = (t: BackendTopicDto) => {
  // Use a typed local variable for provided properties
  const providedProps = t.properties as TopicProperties | undefined;

  // Provide minimal safe defaults and merge provided properties (no '{}' literal)
  const properties: TopicProperties = {
    DefaultMessageTimeToLive: providedProps?.DefaultMessageTimeToLive ?? 'P14D',
    DuplicateDetectionHistoryTimeWindow:
      providedProps?.DuplicateDetectionHistoryTimeWindow ?? 'PT10M',
    RequiresDuplicateDetection:
      providedProps?.RequiresDuplicateDetection ?? false,
    // keep other unknown properties if present
    ...(providedProps ?? {}),
  };

  return {
    Name: t.name,
    Properties: properties,
    Subscriptions: Array.isArray(t.subscriptions)
      ? t.subscriptions.map(makeSubscription)
      : [],
  };
};

const makeQueue = (q: BackendQueueDto) => ({
  Name: q.name,
  Properties: q.properties ?? {},
});

const transformBackendToServiceBusConfig = (
  data: BackendResponse,
): ServiceBusConfig | null => {
  if (!data.success || !Array.isArray(data.namespaces)) return null;

  const namespaces = data.namespaces.map((ns) => {
    const mapped = {
      Name: ns.name,
      Topics: Array.isArray(ns.topics) ? ns.topics.map(makeTopic) : [],
      Queues: Array.isArray(ns.queues) ? ns.queues.map(makeQueue) : [],
    };

    return mapped;
  });

  const final = {
    UserConfig: {
      Namespaces: namespaces,
      Logging: {
        Type: 'File',
      },
    },
  };

  // cast through unknown to satisfy structural differences between runtime DTO and strict ServiceBusConfig
  return final as unknown as ServiceBusConfig;
};

export const useServiceBusConfig = () => {
  const [config, setConfig] = useState<ServiceBusConfig | null>(null);
  const [queuesAndTopics, setQueuesAndTopics] = useState<QueueTopicItem[]>([]);
  const [allDestinations, setAllDestinations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch helpers moved out of effect to reduce nesting and keep effect simple
  const fetchFromBackend = async (): Promise<ServiceBusConfig | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        'http://localhost:3000/api/v1/servicebus/namespaces',
        {
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        // If it's a 503 error (Service Bus not initialized), don't throw
        // Just return null to fall back to static config
        if (response.status === 503) {
          console.warn('Service Bus not initialized in backend, using static config');
          return null;
        }
        throw new Error(`Backend error: ${response.statusText}`);
      }

      const data = (await response.json()) as BackendResponse;

      const configFromBackend = transformBackendToServiceBusConfig(data);
      if (configFromBackend) return configFromBackend;

      throw new Error(data.message || 'Invalid backend response');
    } catch (err) {
      console.warn('Backend fetch failed, falling back to static file:', err);
      return null;
    }
  };

  const fetchFromStaticFile = async (): Promise<ServiceBusConfig | null> => {
    try {
      const response = await fetch('/servicebus-config.json');
      if (!response.ok) {
        throw new Error(`Static file error: ${response.statusText}`);
      }
      const data = (await response.json()) as ServiceBusConfig;
      if (data.UserConfig?.Namespaces) {
        return data;
      } else {
        throw new Error('Invalid static config format');
      }
    } catch (err) {
      console.error('Error loading static config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load config');
      return null;
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      const backendConfig = await fetchFromBackend();
      const finalConfig = backendConfig ?? (await fetchFromStaticFile());

      if (finalConfig) {
        setConfig(finalConfig);
        setError(null);
      }

      setLoading(false);
    };

    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!config) return;

    const items: QueueTopicItem[] = [];
    const destinations: string[] = [];

    // Use for...of instead of forEach for readability/performance per lint rules
    for (const namespace of config.UserConfig.Namespaces) {
      if (Array.isArray(namespace.Topics)) {
        for (const topic of namespace.Topics) {
          items.push({
            name: topic.Name,
            type: 'topic',
            namespace: namespace.Name,
            properties: topic.Properties,
          });
          destinations.push(topic.Name);
        }
      }

      if (Array.isArray(namespace.Queues)) {
        for (const queue of namespace.Queues) {
          items.push({
            name: queue.Name,
            type: 'queue',
            namespace: namespace.Name,
            properties: queue.Properties,
          });
          destinations.push(queue.Name);
        }
      }
    }

    setQueuesAndTopics(items);
    setAllDestinations(destinations);
  }, [config]);

  const getQueueNames = (): string[] =>
    queuesAndTopics
      .filter((item) => item.type === 'queue')
      .map((item) => item.name);

  const getTopicNames = (): string[] =>
    queuesAndTopics
      .filter((item) => item.type === 'topic')
      .map((item) => item.name);

  const getSubscriptionsByTopic = (topicName: string): string[] =>
    queuesAndTopics
      .filter(
        (item) =>
          item.type === 'subscription' && item.parentTopic === topicName,
      )
      .map((item) => item.name);

  return {
    config,
    loading,
    error,
    queuesAndTopics,
    allDestinations,
    getQueueNames,
    getTopicNames,
    getSubscriptionsByTopic,
  };
};

// Add a typed shape for topic properties to avoid `any`
type TopicProperties = {
  DefaultMessageTimeToLive?: string;
  DuplicateDetectionHistoryTimeWindow?: string;
  RequiresDuplicateDetection?: boolean;
  [key: string]: unknown;
};
