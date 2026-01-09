import { useCallback, useMemo, useState } from 'react';
import { VirtualizedDataTable } from '../../components/data-table/VirtualizedDataTable';
import {
  useDeleteServiceBusMessage,
  useGetServiceBusMessages,
} from './api/service-bus';
import { SendMessageSheet } from './components/SendMessageSheet';
import { Statistics } from './components/StatisticsCards';
import { createColumns } from './components/Columns';
import { Option, ServiceBusMessageRow, TrackingMessage } from './lib/entities';
import { DetailSheet } from './components/DetailSheet';
import { Row } from '@tanstack/react-table';

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
    return messages.data;
  }, [messages]);

  const receivedByOptions = useMemo(() => {
    if (!messages?.data) return [] as Option[];

    return Array.from(
      new Set(messages.data.map((message) => message.receivedBy)),
    ).map((receivedBy) => ({
      label: receivedBy,
      value: receivedBy,
    })) as Option[];
  }, [messages]);

  const receivedByFilterFn = useMemo(() => {
    return (row: Row<ServiceBusMessageRow>, id: string, value: unknown) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.receivedBy);
    };
  }, []);

  const sentByOptions = useMemo(() => {
    if (!messages?.data) return [] as Option[];

    return Array.from(
      new Set(messages.data.map((message) => message.sentBy)),
    ).map((sentBy) => ({
      label: sentBy,
      value: sentBy,
    })) as Option[];
  }, [messages]);

  const sentByFilterFn = useMemo(() => {
    return (row: Row<ServiceBusMessageRow>, id: string, value: unknown) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.sentBy);
    };
  }, []);

  const dispositionFilterFn = useMemo(() => {
    return (row: Row<ServiceBusMessageRow>, id: string, value: unknown) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.disposition);
    };
  }, []);
  const dispositionOptions = useMemo(() => {
    if (!messages?.data) return [] as Option[];

    return Array.from(
      new Set(messages.data.map((message) => message.disposition)),
    ).map((disposition) => ({
      label: disposition,
      value: disposition,
    })) as Option[];
  }, [messages]);
  const columns = useMemo(
    () =>
      createColumns(
        handleMessageSelect,
        handleMessageDelete,
        sentByOptions,
        receivedByOptions,
        dispositionOptions,
        sentByFilterFn,
        receivedByFilterFn,
        dispositionFilterFn,
      ),
    [
      handleMessageSelect,
      handleMessageDelete,
      sentByOptions,
      receivedByOptions,
      dispositionOptions,
      sentByFilterFn,
      receivedByFilterFn,
      dispositionFilterFn,
    ],
  );

  const totalMessages = messages ? messages.data.length : 0;

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
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-1 mb-4">
          <h1 className="text-2xl font-bold">Azure Service Bus</h1>
          <h2 className="text-sm text-muted-foreground">
            Manage your Azure Service Bus messages here.
          </h2>
        </div>

        {/* Summary */}
        <Statistics messages={messages} />

        {/* Table */}
        <div className="w-full min-w-0 flex-1 min-h-0">
          <VirtualizedDataTable
            columns={columns}
            data={allRows as ServiceBusMessageRow[]}
            searchKey="body"
            searchPlaceholder={`Search all messages (${totalMessages} total)...`}
            estimateSize={48}
            overscan={5}
            onAdd={() => setSendModalOpen(true)}
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
