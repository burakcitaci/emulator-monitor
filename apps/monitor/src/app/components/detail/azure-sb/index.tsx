// -----------------------------
// External imports
// -----------------------------
import { useCallback, useMemo, useState } from 'react';

// -----------------------------
// UI components
// -----------------------------
import { VirtualizedDataTable } from '../../messages/data-table/VirtualizedDataTable';

// -----------------------------
// API hooks
// -----------------------------
import {
  useDeleteServiceBusMessage,
  useGetServiceBusMessages,
} from '../../../hooks/api/service-bus';

// -----------------------------
// Local components
// -----------------------------
import { AzureSbSendMessageModal } from './components/SendMessageModal';
import { Statistics } from './components/StatisticsCards';
import { createColumns } from './components/MessageTableColumns';

// -----------------------------
// Types
// -----------------------------
import { ServiceBusMessageRow, TrackingMessage } from './lib/message.entities';
import MessageDetailModal from './components/MessageDetailModal';

export const AzureSbDetail = () => {
  // -----------------------------
  // Hooks
  // -----------------------------
  const deleteMutation = useDeleteServiceBusMessage();

  const { data: messages, isLoading, error } = useGetServiceBusMessages();

  // -----------------------------
  // State
  // -----------------------------
  const [selectedMessage, setSelectedMessage] =
    useState<ServiceBusMessageRow | null>(null);
  const [selectedOriginalMessage, setSelectedOriginalMessage] =
    useState<TrackingMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  // -----------------------------
  // Callbacks
  // -----------------------------
  const handleMessageSelect = useCallback(
    (originalMessage: TrackingMessage) => {
      setSelectedOriginalMessage(originalMessage);
      setIsModalOpen(true);
    },
    [],
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedMessage(null);
    setSelectedOriginalMessage(null);
    setIsBodyExpanded(false);
  }, []);

  const handleMessageDelete = useCallback(
    async (messageId: string) => {
      try {
        await deleteMutation.mutateAsync(messageId);
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    },
    [deleteMutation],
  );

  // -----------------------------
  // Derived data
  // -----------------------------
  const allRows = useMemo(() => {
    if (!messages) return [];

    const { complete, deadletter, abandon, defer } = messages.trackingMessages;

    return [...complete, ...deadletter, ...abandon, ...defer];
  }, [messages]);

  const columns = useMemo(
    () => createColumns(handleMessageSelect, handleMessageDelete),
    [handleMessageSelect, handleMessageDelete],
  );

  const totalMessages = messages
    ? messages.summary.trackingComplete +
      messages.summary.trackingDeadletter +
      messages.summary.trackingAbandon +
      messages.summary.trackingDefer
    : 0;

  // -----------------------------
  // Render guards
  // -----------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Error: {error.message}</p>
      </div>
    );
  }

  if (!messages) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <>
      <div className="space-y-4">
       
        {/* Summary */}
        <Statistics messages={messages} />

        {/* Table */}
        <div className="w-full min-w-0 flex-1 min-h-0">
          <VirtualizedDataTable
            columns={columns}
            data={allRows}
            searchKey="body"
            searchPlaceholder={`Search all messages (${totalMessages} total)...`}
            estimateSize={48}
            overscan={5}
            onAdd={() => console.log('add')}
          />
        </div>

        {/* Modals */}
        <AzureSbSendMessageModal
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
        />
      </div>

      <MessageDetailModal
        isModalOpen={isModalOpen}
        handleModalClose={handleModalClose}
        selectedMessage={selectedMessage as ServiceBusMessageRow}
        selectedOriginalMessage={selectedOriginalMessage as TrackingMessage}
        isBodyExpanded={isBodyExpanded}
        setIsBodyExpanded={setIsBodyExpanded}
      />
    </>
  );
};
