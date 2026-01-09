import { MessageResources } from '../../../lib/schemas';

export enum Provider {
  AWS = 'aws',
  AZURE = 'azure',
}

export enum ResourceType {
  QUEUE = 'queue',
  TOPIC = 'topic',
}

export type MessagingResource = MessageResources;