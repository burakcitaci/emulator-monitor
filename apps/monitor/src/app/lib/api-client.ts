import { config } from './config';
import { z } from 'zod';
import {
  trackingMessagesResponseSchema,
  trackingMessageResponseSchema,
  sendMessageResponseSchema,
  deleteMessageResponseSchema,
  apiResponseSchema,
  TrackingMessage,
  SendServiceBusMessage,
  ReceiveServiceBusMessage,
  ServiceBusConfig,
  serviceBusConfigSchema,
  SendSqsMessage,
  ReceiveSqsMessage,
  AwsSqsConfig,
  awsSqsConfigSchema,
} from './schemas';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = config.api.baseUrl) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    schema?: z.ZodTypeAny
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        credentials: 'include', // Include cookies for CORS requests
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData
        );
      }

      const data = await response.json();

      if (schema) {
        try {
          return schema.parse(data) as T;
        } catch (parseError) {
          // Log the actual data received for debugging
          console.error('Schema validation failed:', {
            endpoint,
            receivedData: data,
            error: parseError,
          });
          throw new ApiError(
            500,
            `Invalid response format: ${parseError instanceof z.ZodError ? parseError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') : 'Unknown error'}`,
            data
          );
        }
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(0, error instanceof Error ? error.message : 'Network error');
    }
  }

  // Tracking Messages API
  async getTrackingMessages(): Promise<TrackingMessage[]> {
    const response = await this.request<
      | { success: boolean; message?: string; data?: TrackingMessage[] }
      | TrackingMessage[]
    >(
      '/tracked-messages/tracking',
      undefined,
      trackingMessagesResponseSchema
    );

    // Handle wrapped response format
    if (typeof response === 'object' && 'success' in response) {
      if (!response.success) {
        throw new ApiError(500, response.message || 'Failed to fetch tracking messages');
      }
      // Return empty array if data is undefined/null
      return response.data || [];
    }

    // Handle unwrapped array format (backwards compatibility)
    if (Array.isArray(response)) {
      return response;
    }

    // Fallback: return empty array instead of throwing
    console.warn('Unexpected response format, returning empty array');
    return [];
  }

  async getTrackingMessage(id: string): Promise<TrackingMessage> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      undefined,
      trackingMessageResponseSchema
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, response.message || 'Failed to fetch tracking message');
    }

    return response.data;
  }

  async createTrackingMessage(message: Partial<TrackingMessage>): Promise<TrackingMessage> {
    const response = await this.request(
      '/tracked-messages/tracking',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      trackingMessageResponseSchema
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, response.message || 'Failed to create tracking message');
    }

    return response.data;
  }

  async updateTrackingMessage(
    id: string,
    message: Partial<TrackingMessage>
  ): Promise<TrackingMessage> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(message),
      },
      trackingMessageResponseSchema
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, response.message || 'Failed to update tracking message');
    }

    return response.data;
  }

  async deleteTrackingMessage(id: string): Promise<{ message: string }> {
    const response = await this.request(
      `/tracked-messages/tracking/${id}`,
      {
        method: 'DELETE',
      },
      deleteMessageResponseSchema
    );

    if (!response.success) {
      throw new ApiError(500, response.message || 'Failed to delete tracking message');
    }

    return { message: response.message || 'Tracking message deleted successfully' };
  }

  // Service Bus API
  async sendMessage(message: SendServiceBusMessage) {
    const response = await this.request(
      '/service-bus/messages',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      sendMessageResponseSchema
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, response.message || 'Failed to send message');
    }

    return response.data;
  }

  async receiveMessage(message: ReceiveServiceBusMessage) {
    const response = await this.request(
      '/service-bus/messages/receive',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      apiResponseSchema(
        z.object({
          queueName: z.string(),
          messageId: z.string(),
          body: z.string(),
        }).nullable()
      )
    );

    return response;
  }

  async getServiceBusConfig(): Promise<ServiceBusConfig> {
    const response = await this.request(
      '/service-bus/config',
      undefined,
      z.object({
        success: z.boolean(),
        data: serviceBusConfigSchema,
      })
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, response.message || 'Failed to fetch Service Bus config');
    }

    return response.data;
  }

  // AWS SQS API
  async sendSqsMessage(message: SendSqsMessage) {
    const response = await this.request(
      '/aws-sqs/messages',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      sendMessageResponseSchema
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, response.message || 'Failed to send SQS message');
    }

    return response.data;
  }

  async receiveSqsMessage(message: ReceiveSqsMessage) {
    const response = await this.request(
      '/aws-sqs/messages/receive',
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
      apiResponseSchema(
        z.object({
          queueName: z.string(),
          queueUrl: z.string(),
          messageId: z.string(),
          receiptHandle: z.string().optional(),
          body: z.string(),
          messageAttributes: z.record(z.any()).optional(),
          md5OfBody: z.string().optional(),
        }).nullable()
      )
    );

    return response;
  }

  async getAwsSqsConfig(): Promise<AwsSqsConfig> {
    const response = await this.request(
      '/aws-sqs/config',
      undefined,
      z.object({
        success: z.boolean(),
        data: awsSqsConfigSchema,
      })
    );

    if (!response.success || !response.data) {
      throw new ApiError(500, response.message || 'Failed to fetch AWS SQS config');
    }

    return response.data;
  }
}

export const apiClient = new ApiClient();
export { ApiError };
export type { ApiClient };