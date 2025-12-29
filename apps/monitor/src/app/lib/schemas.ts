import { z } from 'zod';

// Base API response schema
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: dataSchema.optional(),
  });

// Tracking message schema - handle MongoDB ObjectId and date formats
export const trackingMessageSchema = z.preprocess(
  (data: unknown) => {
    // Normalize _id from MongoDB ObjectId buffer format to string
    if (typeof data === 'object' && data !== null && '_id' in data) {
      const id = (data as { _id: unknown })._id;
      if (
        typeof id === 'object' &&
        id !== null &&
        'buffer' in id &&
        typeof (id as { buffer: unknown }).buffer === 'object'
      ) {
        const buffer = (id as { buffer: { data?: number[] } }).buffer;
        if (buffer?.data && Array.isArray(buffer.data)) {
          // Convert buffer to hex string (MongoDB ObjectId format)
          const hex = buffer.data
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return { ...(data as Record<string, unknown>), _id: hex };
        }
      }
    }
    return data;
  },
  z.object({
    _id: z.string(),
    messageId: z.string(),
    body: z.string(),
    sentBy: z.string(),
    sentAt: z.coerce.date(),
    status: z.enum(['sent', 'processing', 'received']),
    queue: z.string().optional().nullable(),
    receivedAt: z.coerce.date().optional().nullable(),
    receivedBy: z.string().optional().nullable(),
    disposition: z.enum(['complete', 'abandon', 'deadletter', 'defer']).optional().nullable(),
    emulatorType: z.enum(['sqs', 'azure-service-bus']).optional().nullable(),
  })
);

// Explicit type definition to ensure emulatorType is included
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
  disposition?: 'complete' | 'abandon' | 'deadletter' | 'defer' | null;
  emulatorType?: 'sqs' | 'azure-service-bus' | null;
};

// Message filters schema
export const messageFiltersSchema = z.object({
  namespace: z.string().optional(),
  queue: z.string().optional(),
  topic: z.string().optional(),
  subscription: z.string().optional(),
  maxMessages: z.number().optional(),
});

export type MessageFilters = z.infer<typeof messageFiltersSchema>;

// Send message request schema
export const sendServiceBusMessageSchema = z.object({
  queue: z.string().optional(),
  body: z.string(),
  contentType: z.string().optional(),
  subject: z.string().optional(),
  messageId: z.string().optional(),
  sentBy: z.string().optional(),
  receivedBy: z.string().optional(),
  messageDisposition: z.enum(['complete', 'abandon', 'deadletter', 'defer']).optional(),
  applicationProperties: z.record(z.string(), z.any()).optional(),
});

export type SendServiceBusMessage = z.infer<typeof sendServiceBusMessageSchema>;

// Receive message request schema
export const receiveServiceBusMessageSchema = z.object({
  queue: z.string().optional(),
  topic: z.string().optional(),
  subscription: z.string().optional(),
  receivedBy: z.string(),
});

export type ReceiveServiceBusMessage = z.infer<typeof receiveServiceBusMessageSchema>;

// API response types - handle both wrapped and unwrapped responses
// Try wrapped format first (what backend returns), then fallback to array
export const trackingMessagesResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.array(trackingMessageSchema), // Required data field for list endpoint
  }),
  z.array(trackingMessageSchema), // Fallback for unwrapped arrays
]);

export const trackingMessageResponseSchema = apiResponseSchema(
  trackingMessageSchema
);

export const sendMessageResponseSchema = apiResponseSchema(
  z.object({
    queueName: z.string(),
    messageId: z.string(),
  })
);

export const deleteMessageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Service Bus config schema
export const serviceBusConfigSchema = z.object({
  UserConfig: z.object({
    Namespaces: z.array(
      z.object({
        Name: z.string(),
        Topics: z.array(
          z.object({
            Name: z.string(),
            Properties: z.object({
              DefaultMessageTimeToLive: z.string(),
              DuplicateDetectionHistoryTimeWindow: z.string(),
              RequiresDuplicateDetection: z.boolean(),
            }),
            Subscriptions: z.array(
              z.object({
                Name: z.string(),
                DeadLetteringOnMessageExpiration: z.boolean(),
                MaxDeliveryCount: z.number(),
              })
            ),
          })
        ).optional(),
        Queues: z.array(
          z.object({
            Name: z.string(),
            Properties: z.object({
              DefaultMessageTimeToLive: z.string(),
              MaxDeliveryCount: z.number(),
              DeadLetteringOnMessageExpiration: z.boolean(),
            }),
          })
        ).optional(),
      })
    ),
    Logging: z.object({
      Type: z.string(),
    }),
  }),
});

export type ServiceBusConfig = z.infer<typeof serviceBusConfigSchema>;

// Send SQS message request schema
export const sendSqsMessageSchema = z.object({
  queueUrl: z.string().optional(),
  body: z.string(),
  messageId: z.string().optional(),
  sentBy: z.string().optional(),
  messageGroupId: z.string().optional(), // For FIFO queues
  messageDeduplicationId: z.string().optional(), // For FIFO queues
  messageAttributes: z.record(z.string(), z.any()).optional(),
  delaySeconds: z.number().optional(),
  messageDisposition: z.enum(['complete', 'abandon', 'deadletter', 'defer']).optional(),
});

export type SendSqsMessage = z.infer<typeof sendSqsMessageSchema>;

// Receive SQS message request schema
export const receiveSqsMessageSchema = z.object({
  queueUrl: z.string().optional(),
  receivedBy: z.string(),
  maxNumberOfMessages: z.number().optional(),
  waitTimeSeconds: z.number().optional(),
});

export type ReceiveSqsMessage = z.infer<typeof receiveSqsMessageSchema>;

// AWS SQS config schema
export const awsSqsConfigSchema = z.object({
  endpoint: z.string(),
  region: z.string(),
  queueName: z.string(),
  accessKeyId: z.string(),
});

export type AwsSqsConfig = z.infer<typeof awsSqsConfigSchema>;