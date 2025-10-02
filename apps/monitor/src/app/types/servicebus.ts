export interface ServiceBusSubscription {
  Name: string;
  DeadLetteringOnMessageExpiration: boolean;
  MaxDeliveryCount: number;
}

export interface TopicProperties {
  DefaultMessageTimeToLive: string;
  DuplicateDetectionHistoryTimeWindow: string;
  RequiresDuplicateDetection: boolean;
}

export interface ServiceBusTopic {
  Name: string;
  Properties: TopicProperties;
  Subscriptions: ServiceBusSubscription[];
}

export interface QueueProperties {
  DefaultMessageTimeToLive: string;
  MaxDeliveryCount: number;
  DeadLetteringOnMessageExpiration: boolean;
}

export interface ServiceBusQueue {
  Name: string;
  Properties: QueueProperties;
}

export interface ServiceBusNamespace {
  Name: string;
  Topics?: ServiceBusTopic[];
  Queues?: ServiceBusQueue[];
}

export interface ServiceBusConfig {
  UserConfig: {
    Namespaces: ServiceBusNamespace[];
    Logging: {
      Type: string;
    };
  };
}

export interface QueueTopicItem {
  name: string;
  type: 'queue' | 'topic' | 'subscription';
  namespace: string;
  parentTopic?: string;
  properties: QueueProperties | TopicProperties;
}
