import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Messages } from '../Messages';
import { apiClient } from '../../../lib/api-client';

// Mock dependencies
vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    getTrackingMessages: vi.fn(),
    deleteTrackingMessage: vi.fn(),
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('Messages component', () => {
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
    mockApiClient.deleteTrackingMessage.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('should show loading state initially', () => {
    mockApiClient.getTrackingMessages.mockImplementationOnce(() =>
      new Promise(() => undefined) // Never resolves
    );

    render(<Messages />, { wrapper });

    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should display messages when data loads', async () => {
    const mockMessages = [
      {
        _id: '1',
        messageId: 'msg-1',
        body: 'Test message 1',
        sentBy: 'user1',
        sentAt: new Date('2024-01-01T00:00:00Z'),
        status: 'sent' as const,
      },
      {
        _id: '2',
        messageId: 'msg-2',
        body: 'Test message 2',
        sentBy: 'user2',
        sentAt: new Date('2024-01-01T01:00:00Z'),
        status: 'received' as const,
        receivedBy: 'receiver',
        receivedAt: new Date('2024-01-01T01:30:00Z'),
      },
    ];

    mockApiClient.getTrackingMessages.mockResolvedValueOnce(mockMessages);

    render(<Messages />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test message 1')).toBeInTheDocument();
      expect(screen.getByText('Test message 2')).toBeInTheDocument();
    });

    // Check that status badges are displayed
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
  });

  it('should show error message when loading fails', async () => {
    const error = new Error('Failed to load messages');
    mockApiClient.getTrackingMessages.mockRejectedValueOnce(error);

    render(<Messages />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Tracking Messages')).toBeInTheDocument();
      expect(screen.getByText('Failed to load messages')).toBeInTheDocument();
    });
  });

  it('should handle message deletion successfully', async () => {
    const mockMessages = [
      {
        _id: '1',
        messageId: 'msg-1',
        body: 'Test message',
        sentBy: 'user1',
        sentAt: new Date('2024-01-01T00:00:00Z'),
        status: 'sent' as const,
      },
    ];

    const deleteResponse = { message: 'Message deleted successfully' };

    mockApiClient.getTrackingMessages.mockResolvedValueOnce(mockMessages);
    mockApiClient.deleteTrackingMessage.mockResolvedValueOnce(deleteResponse);

    render(<Messages />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    // Find and click the delete button (trash icon)
    const deleteButton = screen.getByRole('button', { hidden: true });
    fireEvent.click(deleteButton);

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Message deleted successfully',
        expect.objectContaining({
          description: 'The tracking message has been removed.',
        })
      );
    });

    expect(mockApiClient.deleteTrackingMessage).toHaveBeenCalledWith('msg-1');
  });

  it('should handle message deletion errors', async () => {
    const mockMessages = [
      {
        _id: '1',
        messageId: 'msg-1',
        body: 'Test message',
        sentBy: 'user1',
        sentAt: new Date('2024-01-01T00:00:00Z'),
        status: 'sent' as const,
      },
    ];

    const error = new Error('Delete failed');
    mockApiClient.getTrackingMessages.mockResolvedValueOnce(mockMessages);
    mockApiClient.deleteTrackingMessage.mockRejectedValueOnce(error);

    render(<Messages />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    // Find and click the delete button
    const deleteButton = screen.getByRole('button', { hidden: true });
    fireEvent.click(deleteButton);

    // Wait for the error toast
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to delete message',
        expect.objectContaining({
          description: 'Please try again.',
        })
      );
    });
  });

  it('should display empty state when no messages', async () => {
    mockApiClient.getTrackingMessages.mockResolvedValueOnce([]);

    render(<Messages />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('No results.')).toBeInTheDocument();
    });
  });
});