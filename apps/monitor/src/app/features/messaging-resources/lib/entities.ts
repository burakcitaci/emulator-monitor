export enum Provider {
  AWS = 'AWS',
  AZURE = 'Azure',
}

export enum ResourceType {
  QUEUE = 'Queue',
  TOPIC = 'Topic',
}

export type MessagingResource = {
  id: string;
  name: string;
  provider: Provider;
  type: ResourceType;
  region: string;
  status: 'active' | 'inactive';
}