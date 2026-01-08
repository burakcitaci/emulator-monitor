import { useCallback, useMemo, useState } from 'react';
import { VirtualizedDataTable } from '../../components/data-table/VirtualizedDataTable';
import {
  useDeleteServiceBusMessage,
  useGetServiceBusMessages,
} from './api/service-bus';
import { SendMessageSheet } from './components/SendMessageSheet';
import { Statistics } from './components/StatisticsCards';
import { createColumns } from './components/Columns';
import { ServiceBusMessageRow, TrackingMessage } from './lib/entities';
import { DetailSheet } from './components/DetailSheet';

export const AzureSbDetailPage = () => {

  const deleteMutation = useDeleteServiceBusMessage();

  const { data: messages, isLoading, error } = useGetServiceBusMessages();

  const [selectedMessage, setSelectedMessage] =
    useState<ServiceBusMessageRow | null>(null);
  const [selectedOriginalMessage, setSelectedOriginalMessage] =
    useState<TrackingMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);

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

        <SendMessageSheet
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
        />
      </div>

      <DetailSheet
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
