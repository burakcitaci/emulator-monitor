export type MessageStatus =
  | 'processing'
  | 'completed'
  | 'sent'
  | 'failed'
  | 'replayed';

export type MessageDirection = 'incoming' | 'outgoing';

export interface Message {
  id: string;
  queueName: string;
  body: string;
  properties: Record<string, unknown>;
  timestamp: string;
  direction: MessageDirection;
  status: MessageStatus;
  isDeadLetter: boolean;
}

export interface ConnectionInfo {
  isConnected: boolean;
  isLocal: boolean;
  endpoint: string;
  connectionString: string;
}

export interface SendForm {
  queueName: string;
  body: string;
  properties: string;
}

export interface ConnectionForm {
  connectionString: string;
  queues: string;
}
