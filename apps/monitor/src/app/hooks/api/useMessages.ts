/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { TrackingMessage } from '@e2e-monitor/entities';

interface MessageFilters {
  namespace?: string;
  queue?: string;
  topic?: string;
  subscription?: string;
  maxMessages?: number;
}

interface CreateMessageData {
  body?: any;
  applicationProperties?: Record<string, any>;
  contentType?: string;
  subject?: string;
  correlationId?: string;
  timeToLive?: number;
  sentViaUI?: boolean;
  sentBy?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  sequenceNumber?: number;
  enqueuedTimeUtc?: Date;
  createdAt?: Date;
  lastUpdated?: Date;
  to?: string;
  from?: string;
  state?: string;
}

export const useMessages = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const API_BASE_URL = 'http://localhost:3000/api/v1';

  const fetchMessages = useCallback(async (
    type: 'sent' | 'received',
    filters?: MessageFilters
  ): Promise<any[]> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.namespace) params.append('namespace', filters.namespace);
      if (filters?.queue) params.append('queue', filters.queue);
      if (filters?.topic) params.append('topic', filters.topic);
      if (filters?.subscription) params.append('subscription', filters.subscription);
      if (filters?.maxMessages) params.append('maxMessages', filters.maxMessages.toString());

      const response = await fetch(`${API_BASE_URL}/messages/${type}?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} messages: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`Fetched ${data} ${type} messages with filters:`, filters);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createMessage = useCallback(async (
    type: 'sent' | 'received',
    message: CreateMessageData
  ): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/messages/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        throw new Error(`Failed to create ${type} message: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateMessage = useCallback(async (
    type: 'sent' | 'received',
    id: string,
    message: Partial<CreateMessageData>
  ): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/messages/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        throw new Error(`Failed to update ${type} message: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMessage = useCallback(async (
    type: 'sent' | 'received',
    id: string
  ): Promise<{ message: string }> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/messages/${type}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete ${type} message: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMessage = useCallback(async (
    type: 'sent' | 'received',
    id: string
  ): Promise<any> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/messages/${type}/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to get ${type} message: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrackingMessages = useCallback(async (): Promise<TrackingMessage[]> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tracked-messages/tracking`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tracking messages: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Fetched tracking messages:', data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTrackingMessage = useCallback(async (id: string): Promise<TrackingMessage> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tracked-messages/tracking/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to get tracking message: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Fetched tracking message:', data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTrackingMessage = useCallback(async (message: Partial<TrackingMessage>): Promise<TrackingMessage> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tracked-messages/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        throw new Error(`Failed to create tracking message: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Created tracking message:', data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTrackingMessage = useCallback(async (id: string, message: Partial<TrackingMessage>): Promise<TrackingMessage> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tracked-messages/tracking/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        throw new Error(`Failed to update tracking message: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Updated tracking message:', data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTrackingMessage = useCallback(async (id: string): Promise<{ message: string }> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tracked-messages/tracking/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete tracking message: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Deleted tracking message:', data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchMessages,
    createMessage,
    updateMessage,
    deleteMessage,
    getMessage,
    fetchTrackingMessages,
    getTrackingMessage,
    createTrackingMessage,
    updateTrackingMessage,
    deleteTrackingMessage,
  };
};
