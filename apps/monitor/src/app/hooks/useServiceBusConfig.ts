import { useState, useEffect } from 'react';
import { ServiceBusConfig, QueueTopicItem } from '@emulator-monitor/entities';

export const useServiceBusConfig = () => {
  const [config, setConfig] = useState<ServiceBusConfig | null>(null);
  const [queuesAndTopics, setQueuesAndTopics] = useState<QueueTopicItem[]>([]);
  const [allDestinations, setAllDestinations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFromBackend = async (): Promise<ServiceBusConfig | null> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          'http://localhost:3000/api/v1/servicebus/namespaces',
          {
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Backend error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.namespaces) {
          return {
            UserConfig: {
              Namespaces: data.namespaces.map((ns: any) => ({
                Name: ns.name,
                Topics:
                  ns.topics?.map((topic: any) => ({
                    Name: topic.name,
                    Properties: topic.properties,
                    Subscriptions:
                      topic.subscriptions?.map((sub: any) => ({
                        Name: sub.name,
                        DeadLetteringOnMessageExpiration:
                          sub.deadLetteringOnMessageExpiration,
                        MaxDeliveryCount: sub.maxDeliveryCount,
                      })) || [],
                  })) || [],
                Queues:
                  ns.queues?.map((queue: any) => ({
                    Name: queue.name,
                    Properties: queue.properties,
                  })) || [],
              })),
              Logging: {
                Type: 'File',
              },
            },
          };
        } else {
          throw new Error(data.message || 'Invalid backend response');
        }
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

        const data = await response.json();
        if (data.UserConfig?.Namespaces) {
          return data as ServiceBusConfig;
        } else {
          throw new Error('Invalid static config format');
        }
      } catch (err) {
        console.error('Error loading static config:', err);
        setError(err instanceof Error ? err.message : 'Failed to load config');
        return null;
      }
    };

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

    loadConfig();
  }, []);

  useEffect(() => {
    if (!config) return;

    const items: QueueTopicItem[] = [];
    const destinations: string[] = [];

    config.UserConfig.Namespaces.forEach((namespace) => {
      namespace.Queues?.forEach((queue) => {
        items.push({
          name: queue.Name,
          type: 'queue',
          namespace: namespace.Name,
          properties: queue.Properties,
        });
        destinations.push(queue.Name);
      });

      namespace.Topics?.forEach((topic) => {
        items.push({
          name: topic.Name,
          type: 'topic',
          namespace: namespace.Name,
          properties: topic.Properties,
        });
        destinations.push(topic.Name);

        topic.Subscriptions.forEach((subscription) => {
          items.push({
            name: subscription.Name,
            type: 'subscription',
            namespace: namespace.Name,
            parentTopic: topic.Name,
            properties: {
              DefaultMessageTimeToLive:
                topic.Properties.DefaultMessageTimeToLive,
              MaxDeliveryCount: subscription.MaxDeliveryCount,
              DeadLetteringOnMessageExpiration:
                subscription.DeadLetteringOnMessageExpiration,
            },
          });
          destinations.push(`${topic.Name}/${subscription.Name}`);
        });
      });
    });

    setQueuesAndTopics(items);
    setAllDestinations(destinations);
  }, [config]);

  const getQueueNames = () =>
    queuesAndTopics
      .filter((item) => item.type === 'queue')
      .map((item) => item.name);

  const getTopicNames = () =>
    queuesAndTopics
      .filter((item) => item.type === 'topic')
      .map((item) => item.name);

  const getSubscriptionsByTopic = (topicName: string) =>
    queuesAndTopics
      .filter(
        (item) => item.type === 'subscription' && item.parentTopic === topicName
      )
      .map((item) => item.name);

  return {
    config,
    queuesAndTopics,
    allDestinations,
    getQueueNames,
    getTopicNames,
    getSubscriptionsByTopic,
    loading,
    error,
  };
};
