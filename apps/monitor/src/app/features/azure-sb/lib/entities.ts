// Message row type for table
export type ServiceBusMessageRow = {
  messageId: string;
  body: string;
  sentBy?: string;
  receivedBy?: string;
  sentAt?: Date;
  disposition: string;
  receiptHandle?: string;
  source: 'queue' | 'tracking';
};

// Tracking message type
export type TrackingMessage = {
  _id?: string;
  messageId: string;
  body?: string | null;
  sentBy?: string | null;
  sentAt?: Date | string | null;
  receivedAt?: Date | string | null;
  receivedBy?: string | null;
  disposition?: string | null;
  queue?: string | null;
  status?: string;
  emulatorType?: string | null;
};


export type Option = {
  label: string;
  value: string;
};