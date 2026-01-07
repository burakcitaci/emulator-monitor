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
import { useDeleteSqsMessage, useGetSqsMessages } from '../../../hooks/api/aws-sqs';

// -----------------------------
// Local components
// -----------------------------
import { AwsSqsSendMessageModal } from './components/SendMessageModal';

// -----------------------------
// Types
// -----------------------------
import { Option, SqsMessageRow, TrackingMessage } from './lib/message.entities';
import { Statistics } from './components/StatisticsCards';
import { createColumns } from './components/MessageTableColumns';
import MessageDetailModal from './components/MessageDetailModal';
import { Row } from '@tanstack/react-table';
import { toast } from 'sonner';


export const SqsMessagesDataTable = () => {
  // -----------------------------
  // Hooks
  // -----------------------------
  const { data: messages, isLoading, error } = useGetSqsMessages();

  // -----------------------------
  // State
  // -----------------------------
    const deleteMutation = useDeleteSqsMessage();

const handleMessageDelete = useCallback(async (messageId: string) => {
  try {
    await deleteMutation.mutateAsync(messageId);
    toast.success('Message deleted successfully', {
      description: 'The tracking message has been removed.',
    });
  } catch (error) {
    console.error('Failed to delete message:', error);
    toast.error('Failed to delete message', {
      description: 'Please try again.',
    });
  }
}, [deleteMutation]); 

  const [selectedMessage, setSelectedMessage] = useState<SqsMessageRow | null>(
    null,
  );
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
    return (row: Row<SqsMessageRow>, id: string, value: unknown) => {
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
    return (row: Row<SqsMessageRow>, id: string, value: unknown) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.sentBy);
    };
  }, []);

  const dispositionFilterFn = useMemo(() => {
    return (row: Row<SqsMessageRow>, id: string, value: unknown) => {
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
      sentByFilterFn,
      receivedByFilterFn,
      dispositionFilterFn,
      dispositionOptions,
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
      <div className="space-y-4">

        {/* Summary */}
        <Statistics messages={messages} />

        {/* Table */}
        <div className="w-full min-w-0 flex-1 min-h-0">
          <VirtualizedDataTable
            columns={columns}
            data={allRows as SqsMessageRow[]}
            searchKey="body"
            searchPlaceholder={`Search all messages (${totalMessages} total)...`}
            estimateSize={48}
            overscan={5}
            onAdd={() => setSendModalOpen(true)}
          />
        </div>

        {/* Modals */}
        <AwsSqsSendMessageModal
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
        />
      </div>

      <MessageDetailModal
        isModalOpen={isModalOpen}
        handleModalClose={handleModalClose}
        selectedMessage={selectedMessage as SqsMessageRow}
        selectedOriginalMessage={selectedOriginalMessage as TrackingMessage}
        isBodyExpanded={isBodyExpanded}
        setIsBodyExpanded={setIsBodyExpanded}
      />
    </>
  );
};
