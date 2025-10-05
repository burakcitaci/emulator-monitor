import { ServiceBusMessage } from '@azure/service-bus';

export interface ServiceBusConfig {
  UserConfig: {
    Namespaces: Array<{
      Name: string;
      Topics: Array<{
        Name: string;
        Properties: {
          DefaultMessageTimeToLive: string;
          DuplicateDetectionHistoryTimeWindow: string;
          RequiresDuplicateDetection: boolean;
        };
        Subscriptions: Array<{
          Name: string;
          DeadLetteringOnMessageExpiration: boolean;
          MaxDeliveryCount: number;
        }>;
      }>;
      Queues: Array<{
        Name: string;
        Properties: {
          DefaultMessageTimeToLive: string;
          MaxDeliveryCount: number;
          DeadLetteringOnMessageExpiration: boolean;
        };
      }>;
    }>;
    Logging: {
      Type: string;
    };
  };
}

export interface SendMessageDto {
  namespace: string;
  topic: string;
  message: {
    body: any;
    contentType?: string;
    messageId?: string | number;
    correlationId?: string;
    subject?: string;
    applicationProperties?: Record<string, any>;
  };
}

export interface SendBatchDto {
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

export interface InitializeDto {
  config: ServiceBusConfig;
  connectionString: string;
}

export interface NamespaceInfo {
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

export interface SendMessageResponse {
  success: boolean;
  message: string;
  messageId?: string | number;
  namespace?: string;
  topic?: string;
}

export interface SendBatchResponse {
  success: boolean;
  message: string;
  messageCount?: number;
  namespace?: string;
  topic?: string;
}

export interface InitializeResponse {
  success: boolean;
  message: string;
  namespaces: Array<{
    name: string;
    topics: string[];
  }>;
}

export interface GetNamespacesResponse {
  success: boolean;
  message?: string;
  namespaces: NamespaceInfo[];
}

export interface DeadLetterMessageResponse {
  success: true;
  messageCount: number;
  messages: ServiceBusMessage[];
  entityPath: string;
}
