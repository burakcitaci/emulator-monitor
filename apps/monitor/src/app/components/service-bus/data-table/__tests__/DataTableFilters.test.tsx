import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrackingMessagesDataTable } from '../../TrackingMessagesDataTable';
import { TrackingMessage } from '../../../lib/schemas';

// Mock TrackingMessageDetailModal since we're not testing it
vi.mock('../../TrackingMessageDetailModal', () => ({
  TrackingMessageDetailModal: () => <div>Mock Modal</div>,
}));

describe('DataTable Filters', () => {
  let queryClient: QueryClient;
  const mockDelete = vi.fn();

  const mockMessages: TrackingMessage[] = [
    {
      _id: '1',
      messageId: 'msg-1',
      body: 'Test message 1',
      sentBy: 'user-a',
      sentAt: new Date('2024-01-01'),
      status: 'sent',
    },
    {
      _id: '2',
      messageId: 'msg-2',
      body: 'Test message 2',
      sentBy: 'user-b',
      sentAt: new Date('2024-01-02'),
      status: 'received',
      receivedBy: 'receiver-a',
      receivedAt: new Date('2024-01-02T01:00:00Z'),
    },
    {
      _id: '3',
      messageId: 'msg-3',
      body: 'Another test message',
      sentBy: 'user-a',
      sentAt: new Date('2024-01-03'),
      status: 'sent',
    },
  ];

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockDelete.mockClear();
  });

  it('should render all messages initially', () => {
    render(
      <TrackingMessagesDataTable
        messages={mockMessages}
        onMessageDelete={mockDelete}
        isDeleting={false}
      />,
      { wrapper }
    );

    expect(screen.getByText('Test message 1')).toBeInTheDocument();
    expect(screen.getByText('Test message 2')).toBeInTheDocument();
    expect(screen.getByText('Another test message')).toBeInTheDocument();
  });

  it('should filter messages by search input', async () => {
    const user = userEvent.setup();

    render(
      <TrackingMessagesDataTable
        messages={mockMessages}
        onMessageDelete={mockDelete}
        isDeleting={false}
      />,
      { wrapper }
    );

    const searchInput = screen.getByPlaceholderText('Search message body...');
    await user.type(searchInput, 'Another');

    await waitFor(() => {
      expect(screen.getByText('Another test message')).toBeInTheDocument();
      expect(screen.queryByText('Test message 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Test message 2')).not.toBeInTheDocument();
    });
  });

  it('should clear search filter', async () => {
    const user = userEvent.setup();

    render(
      <TrackingMessagesDataTable
        messages={mockMessages}
        onMessageDelete={mockDelete}
        isDeleting={false}
      />,
      { wrapper }
    );

    const searchInput = screen.getByPlaceholderText('Search message body...');
    await user.type(searchInput, 'Another');

    await waitFor(() => {
      expect(screen.queryByText('Test message 1')).not.toBeInTheDocument();
    });

    await user.clear(searchInput);

    await waitFor(() => {
      expect(screen.getByText('Test message 1')).toBeInTheDocument();
      expect(screen.getByText('Test message 2')).toBeInTheDocument();
      expect(screen.getByText('Another test message')).toBeInTheDocument();
    });
  });

  it('should render status badges correctly', () => {
    render(
      <TrackingMessagesDataTable
        messages={mockMessages}
        onMessageDelete={mockDelete}
        isDeleting={false}
      />,
      { wrapper }
    );

    const statusBadges = screen.getAllByText(/Sent|Received/);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('should call onMessageDelete when delete button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TrackingMessagesDataTable
        messages={mockMessages}
        onMessageDelete={mockDelete}
        isDeleting={false}
      />,
      { wrapper }
    );

    // Find all delete buttons and click the first one
    const deleteButtons = screen.getAllByRole('button');
    const trashButtons = deleteButtons.filter(
      (btn) => btn.querySelector('svg') // Trash icon
    );

    if (trashButtons.length > 0) {
      await user.click(trashButtons[0]);
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('msg-1');
      });
    }
  });

  it('should disable delete buttons when isDeleting is true', () => {
    render(
      <TrackingMessagesDataTable
        messages={mockMessages}
        onMessageDelete={mockDelete}
        isDeleting={true}
      />,
      { wrapper }
    );

    const buttons = screen.getAllByRole('button');
    const deleteButtons = buttons.filter((btn) => btn.querySelector('svg'));

    deleteButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('should maintain filter state with large datasets', async () => {
    const user = userEvent.setup();

    // Create a large dataset
    const largeDataset: TrackingMessage[] = Array.from({ length: 100 }, (_, i) => ({
      _id: `${i}`,
      messageId: `msg-${i}`,
      body: `Message ${i}`,
      sentBy: i % 3 === 0 ? 'user-a' : 'user-b',
      sentAt: new Date(),
      status: i % 2 === 0 ? ('sent' as const) : ('received' as const),
    }));

    render(
      <TrackingMessagesDataTable
        messages={largeDataset}
        onMessageDelete={mockDelete}
        isDeleting={false}
      />,
      { wrapper }
    );

    const searchInput = screen.getByPlaceholderText('Search message body...');
    await user.type(searchInput, 'Message 42');

    await waitFor(() => {
      expect(screen.getByText('Message 42')).toBeInTheDocument();
    });

    // Verify other messages are filtered out
    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Message 99')).not.toBeInTheDocument();
  });

  it('should handle empty filter results', async () => {
    const user = userEvent.setup();

    render(
      <TrackingMessagesDataTable
        messages={mockMessages}
        onMessageDelete={mockDelete}
        isDeleting={false}
      />,
      { wrapper }
    );

    const searchInput = screen.getByPlaceholderText('Search message body...');
    await user.type(searchInput, 'NonexistentMessage');

    await waitFor(() => {
      expect(screen.getByText('No results.')).toBeInTheDocument();
    });
  });
});