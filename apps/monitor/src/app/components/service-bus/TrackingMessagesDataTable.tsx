import { ColumnDef } from '@tanstack/react-table';
import { Eye, Trash } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { TrackingMessage } from '@e2e-monitor/entities';
import { TrackingMessageDetailModal } from './TrackingMessageDetailModal';
import { Option } from '../../types/data-table';

interface TrackingMessagesDataTableProps {
  messages: TrackingMessage[];
  onMessageDelete: (messageId: string) => void;
}

const createColumns = (
  onMessageDelete: (messageId: string) => void,
  onMessageSelect: (message: TrackingMessage) => void,
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
    filterFn: (row, id, value) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.sentBy);
    },
    meta: {
      variant: 'multiSelect',
      label: 'Sent By',
      options: [] as Option[], // Will be populated dynamically
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
    filterFn: (row, id, value) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.receivedBy);
    },
    meta: {
      variant: 'multiSelect',
      label: 'Received By',
      options: [] as Option[], // Will be populated dynamically
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
    filterFn: (row, id, value) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.status);
    },
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
}) => {
  const [selectedMessage, setSelectedMessage] = useState<TrackingMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMessageSelect = (message: TrackingMessage) => {
    setSelectedMessage(message);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedMessage(null);
  };

  const columns = React.useMemo(
    () =>
      createColumns(
        onMessageDelete,
        handleMessageSelect,
      ),
    [onMessageDelete],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={messages}
        searchKey="body"
        searchPlaceholder="Search message body..."
      />
      <TrackingMessageDetailModal
        message={selectedMessage}
        open={isModalOpen}
        onOpenChange={handleModalClose}
      />
    </>
  );
};
