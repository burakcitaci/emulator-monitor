import { MessageResources } from '../../../lib/schemas';

export enum Provider {
  AWS = 'aws',
  AZURE = 'azure',
}

export enum ResourceType {
  QUEUE = 'queue',
  TOPIC = 'topic',
}

// Re-export MessageResources as MessagingResource for consistency
export type MessagingResource = MessageResources;