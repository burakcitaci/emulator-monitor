import { ColumnDef } from '@tanstack/react-table';
import { Eye, Trash } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { VirtualizedDataTable } from './data-table/VirtualizedDataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { TrackingMessage } from '@e2e-monitor/entities';
import { TrackingMessageDetailModal } from './TrackingMessageDetailModal';
import { Option } from '../../types/data-table';

interface TrackingMessagesDataTableProps {
  messages: TrackingMessage[] | undefined;
  onMessageDelete: (messageId: string) => void;
  isDeleting?: boolean;
}

const createColumns = (
  onMessageDelete: (messageId: string) => void,
  onMessageSelect: (message: TrackingMessage) => void,
  sentByOptions: Option[],
  receivedByOptions: Option[],
  sentByFilterFn: (row: TrackingMessage, id: string, value: unknown) => boolean,
  receivedByFilterFn: (row: TrackingMessage, id: string, value: unknown) => boolean,
  statusFilterFn: (row: TrackingMessage, id: string, value: unknown) => boolean,
  isDeleting: boolean,
): ColumnDef<TrackingMessage>[] => [
  {
    accessorKey: 'sentBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sent By" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32">
          {row.original.sentBy || '-'}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: sentByFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Sent By',
      options: sentByOptions,
    },
  },
  {
    accessorKey: 'receivedBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received By" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32">
          {row.original.receivedBy || '-'}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: receivedByFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Received By',
      options: receivedByOptions,
    },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge
          variant={status === 'received' ? 'default' : 'secondary'}
          className="text-xs px-2 py-0.5 h-5"
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
    enableColumnFilter: true,
    filterFn: statusFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Status',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Received', value: 'received' },
      ] as Option[],
    },
  },
  {
    accessorKey: 'body',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Body" />
    ),
    cell: ({ row }) => {
      const body = row.original.body;

      let bodyText = 'N/A';

      if (typeof body === 'string') {
        bodyText = body;
      } else if (typeof body === 'object' && body !== null) {
        const isEmpty = Object.keys(body).length === 0;
        bodyText = isEmpty ? '{}' : JSON.stringify(body, null, 2);
      }

      return (
        <div className="max-w-48 truncate text-xs leading-tight">
          {bodyText}
        </div>
      );
    },
  },
  {
    accessorKey: 'sentAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sent At" />
    ),
    cell: ({ row }) => {
      const timestamp = row.original.sentAt;
      return (
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
  {
    accessorKey: 'receivedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received At" />
    ),
    cell: ({ row }) => {
      const timestamp = row.original.receivedAt;
      return (
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onMessageSelect(row.original)}
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={isDeleting}
            onClick={() =>
              onMessageDelete(row.original.messageId)
            }
          >
            <Trash className="h-3 w-3" />
          </Button>
        </div>
      );
    },
  },
];

export const TrackingMessagesDataTable: React.FC<TrackingMessagesDataTableProps> = ({
  messages,
  onMessageDelete,
  isDeleting = false,
}) => {
  // Ensure messages is always an array
  const safeMessages = messages || [];
  const [selectedMessage, setSelectedMessage] = useState<TrackingMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMessageSelect = React.useCallback((message: TrackingMessage) => {
    setSelectedMessage(message);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = React.useCallback(() => {
    setIsModalOpen(false);
    setSelectedMessage(null);
  }, []);

  // Memoize filter options to avoid recalculation on every render
  const filterOptions = React.useMemo(() => {
    const sentByOptions = Array.from(
      new Set(safeMessages.map(m => m.sentBy).filter(Boolean))
    ).map(value => ({ label: value, value }));

    const receivedByOptions = Array.from(
      new Set(safeMessages.map(m => m.receivedBy).filter(Boolean))
    ).map(value => ({ label: value, value }));

    return { sentByOptions, receivedByOptions };
  }, [safeMessages]);

  // Memoize filter functions to prevent unnecessary re-renders
  const sentByFilterFn = React.useCallback((row: TrackingMessage, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.sentBy);
  }, []);

  const receivedByFilterFn = React.useCallback((row: TrackingMessage, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.receivedBy);
  }, []);

  const statusFilterFn = React.useCallback((row: TrackingMessage, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.status);
  }, []);

  const columns = React.useMemo(
    () =>
      createColumns(
        onMessageDelete,
        handleMessageSelect,
        filterOptions.sentByOptions,
        filterOptions.receivedByOptions,
        sentByFilterFn,
        receivedByFilterFn,
        statusFilterFn,
        isDeleting,
      ),
    [
      onMessageDelete,
      handleMessageSelect,
      filterOptions.sentByOptions,
      filterOptions.receivedByOptions,
      sentByFilterFn,
      receivedByFilterFn,
      statusFilterFn,
      isDeleting,
    ],
  );

  return (
    <>
      <VirtualizedDataTable
        columns={columns}
        data={safeMessages}
        searchKey="body"
        searchPlaceholder="Search message body..."
        estimateSize={48}
        overscan={5}
      />
      <TrackingMessageDetailModal
        message={selectedMessage}
        open={isModalOpen}
        onOpenChange={handleModalClose}
      />
    </>
  );
};
