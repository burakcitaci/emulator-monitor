import { useState, useEffect } from 'react';
import serviceBusConfigJson from '../config/servicebus-config.json';
import { ServiceBusConfig, QueueTopicItem } from '../types/servicebus';

export const useServiceBusConfig = () => {
  const [config, setConfig] = useState<ServiceBusConfig | null>(null);
  const [queuesAndTopics, setQueuesAndTopics] = useState<QueueTopicItem[]>([]);
  const [allDestinations, setAllDestinations] = useState<string[]>([]);

  useEffect(() => {
    // Load config from JSON
    const loadedConfig = serviceBusConfigJson as ServiceBusConfig;
    setConfig(loadedConfig);

    // Extract all queues, topics, and subscriptions
    const items: QueueTopicItem[] = [];
    const destinations: string[] = [];

    loadedConfig.UserConfig.Namespaces.forEach((namespace) => {
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
  }, []);

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
  };
};
