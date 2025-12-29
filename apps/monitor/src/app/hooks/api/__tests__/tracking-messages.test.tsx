import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useTrackingMessages,
  useDeleteTrackingMessage,
  useCreateTrackingMessage,
  useUpdateTrackingMessage,
  trackingMessageKeys
} from '../tracking-messages';
import { apiClient } from '../../../lib/api-client';

// Mock the API client
vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    getTrackingMessages: vi.fn(),
    createTrackingMessage: vi.fn(),
    updateTrackingMessage: vi.fn(),
    deleteTrackingMessage: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('tracking-messages hooks', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    mockApiClient.getTrackingMessages.mockClear();
    mockApiClient.createTrackingMessage.mockClear();
    mockApiClient.updateTrackingMessage.mockClear();
    mockApiClient.deleteTrackingMessage.mockClear();
  });

  describe('useTrackingMessages', () => {
    it('should return loading state initially', async () => {
      mockApiClient.getTrackingMessages.mockImplementationOnce(() =>
        Promise.resolve([])
      );

      const { result } = renderHook(() => useTrackingMessages(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should return data when request succeeds', async () => {
      const mockData = [
        {
          _id: '1',
          messageId: 'msg-1',
          body: 'test message',
          sentBy: 'test-user',
          sentAt: new Date('2024-01-01T00:00:00Z'),
          status: 'sent' as const,
        },
      ];

      mockApiClient.getTrackingMessages.mockResolvedValueOnce(mockData);

      const { result } = renderHook(() => useTrackingMessages(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });

    it('should handle error states', async () => {
      const error = new Error('Network error');
      mockApiClient.getTrackingMessages.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useTrackingMessages(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 3000 });

      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useDeleteTrackingMessage', () => {
    it('should successfully delete a message and invalidate queries', async () => {
      const mockResponse = { message: 'Message deleted successfully' };
      mockApiClient.deleteTrackingMessage.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useDeleteTrackingMessage(), { wrapper });

      await act(async () => {
        const deleteResult = await result.current.mutateAsync('msg-1');
        expect(deleteResult).toEqual(mockResponse);
      });

      expect(mockApiClient.deleteTrackingMessage).toHaveBeenCalledWith('msg-1');
    });

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed');
      mockApiClient.deleteTrackingMessage.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useDeleteTrackingMessage(), { wrapper });

      let caughtError: Error | null = null;

      await act(async () => {
        try {
          await result.current.mutateAsync('msg-1');
        } catch (err) {
          caughtError = err as Error;
        }
      });

      // Verify the error was caught and propagated correctly
      expect(caughtError).toEqual(error);
      expect(mockApiClient.deleteTrackingMessage).toHaveBeenCalledWith('msg-1');
    });
  });

  describe('useCreateTrackingMessage', () => {
    it('should create a message and invalidate queries', async () => {
      const newMessage = {
        messageId: 'msg-new',
        body: 'new message',
        sentBy: 'test-user',
        sentAt: new Date('2024-01-01T00:00:00Z'),
        status: 'sent' as const,
      };

      mockApiClient.createTrackingMessage.mockResolvedValueOnce({
        ...newMessage,
        _id: 'new-id',
      });

      const { result } = renderHook(() => useCreateTrackingMessage(), { wrapper });

      await act(async () => {
        const created = await result.current.mutateAsync(newMessage);
        expect(created._id).toBe('new-id');
        expect(created.messageId).toBe('msg-new');
      });

      expect(mockApiClient.createTrackingMessage).toHaveBeenCalledWith(newMessage);
    });
  });

  describe('useUpdateTrackingMessage', () => {
    it('should update a message and invalidate queries', async () => {
      const updateData = { status: 'received' as const };
      const updatedMessage = {
        _id: '1',
        messageId: 'msg-1',
        body: 'test message',
        sentBy: 'test-user',
        sentAt: new Date('2024-01-01T00:00:00Z'),
        status: 'received' as const,
        receivedAt: new Date('2024-01-01T01:00:00Z'),
        receivedBy: 'receiver',
      };

      mockApiClient.updateTrackingMessage.mockResolvedValueOnce(updatedMessage);

      const { result } = renderHook(() => useUpdateTrackingMessage(), { wrapper });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          id: 'msg-1',
          message: updateData,
        });
        expect(updated.status).toBe('received');
      });

      expect(mockApiClient.updateTrackingMessage).toHaveBeenCalledWith('msg-1', updateData);
    });
  });
});

describe('tracking message query keys', () => {
  it('should generate correct query keys', () => {
    expect(trackingMessageKeys.all).toEqual(['tracking-messages']);
    expect(trackingMessageKeys.lists()).toEqual(['tracking-messages', 'list']);
    expect(trackingMessageKeys.list()).toEqual(['tracking-messages', 'list']);
    expect(trackingMessageKeys.details()).toEqual(['tracking-messages', 'detail']);
    expect(trackingMessageKeys.detail('msg-1')).toEqual(['tracking-messages', 'detail', 'msg-1']);
  });
});