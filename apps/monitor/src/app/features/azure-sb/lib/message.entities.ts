// Message row type for table
export type ServiceBusMessageRow = {
  messageId: string;
  body: string;
  label?: string;
  sessionId?: string;
  enqueuedTime?: Date;
  deliveryCount?: number;
  disposition: 'deadletter' | 'abandon' | 'defer' | 'complete';
};

// Tracking message type
export type TrackingMessage = {
  _id: string;
  messageId: string;
  body: string;
  sentBy: string;
  sentAt: Date;
  status: 'sent' | 'processing' | 'received';
  queue?: string | null;
  receivedAt?: Date | null;
  receivedBy?: string | null;
  disposition?:
    | 'complete'
    | 'abandon'
    | 'deadletter'
    | 'defer'
    | 'undefined'
    | null;
  emulatorType?: 'sqs' | 'azure-service-bus' | null;
};
