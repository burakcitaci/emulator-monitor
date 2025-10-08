import { useState, useEffect } from 'react';
import { ServiceBusConfig, QueueTopicItem } from '../types/servicebus';

export const useServiceBusConfig = () => {
  const [config, setConfig] = useState<ServiceBusConfig | null>(null);
  const [queuesAndTopics, setQueuesAndTopics] = useState<QueueTopicItem[]>([]);
  const [allDestinations, setAllDestinations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          'http://localhost:3000/api/v1/servicebus/namespaces'
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Service Bus config data:', data);
        if (data.success && data.namespaces) {
          // Transform the backend response to match ServiceBusConfig format
          const serviceBusConfig: ServiceBusConfig = {
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

          setConfig(serviceBusConfig);
          setError(null);
        } else {
          throw new Error(data.message || 'Failed to load configuration');
        }
      } catch (err) {
        console.error('Error loading Service Bus config:', err);
        setError(err instanceof Error ? err.message : 'Failed to load config');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    if (!config) return;

    // Extract all queues, topics, and subscriptions
    const items: QueueTopicItem[] = [];
    const destinations: string[] = [];

    config.UserConfig.Namespaces.forEach((namespace) => {
      // Add Queues
      namespace.Queues?.forEach((queue) => {
        items.push({
          name: queue.Name,
          type: 'queue',
          namespace: namespace.Name,
          properties: queue.Properties,
        });
        destinations.push(queue.Name);
      });

      // Add Topics and their Subscriptions
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

  const getQueueNames = () => {
    return queuesAndTopics
      .filter((item) => item.type === 'queue')
      .map((item) => item.name);
  };

  const getTopicNames = () => {
    return queuesAndTopics
      .filter((item) => item.type === 'topic')
      .map((item) => item.name);
  };

  const getSubscriptionsByTopic = (topicName: string) => {
    return queuesAndTopics
      .filter(
        (item) => item.type === 'subscription' && item.parentTopic === topicName
      )
      .map((item) => item.name);
  };

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
