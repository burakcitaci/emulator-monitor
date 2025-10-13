import { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { Message, MessageStatus } from '../../hooks/useServiceBus';

// Helper function to get badge variant based on status
const getStatusBadgeVariant = (
  status?: string
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case MessageStatus.ACTIVE:
      return 'default'; // Blue - message is in queue
    case MessageStatus.COMPLETED:
      return 'secondary'; // Green - successfully processed
    case MessageStatus.DEAD_LETTERED:
      return 'destructive'; // Red - failed, in DLQ
    case MessageStatus.RECEIVED:
      return 'outline'; // Gray - being processed
    case MessageStatus.DEFERRED:
      return 'outline'; // Gray - processing postponed
    case MessageStatus.SCHEDULED:
      return 'secondary'; // Green - scheduled for future
    case MessageStatus.ABANDONED:
      return 'destructive'; // Red - processing failed
    default:
      return 'default';
  }
};

// Helper function to format status display text
const formatStatus = (status?: string): string => {
  if (!status) return 'Active';
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface MessagesDataTableProps {
  messages: Message[];
  onMessageSelect: (message: Message) => void;
}

const createColumns = (
  onMessageSelect: (message: Message) => void
): ColumnDef<Message>[] => [
  {
    accessorKey: 'messageId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message ID" />
    ),
    cell: ({ row }) => {
      return (
        <div className="font-medium font-mono text-xs">
          {row.original.messageId || '-'}
        </div>
      );
    },
  },
  {
    id: 'queue',
    accessorKey: 'queue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Queue/Topic" />
    ),
    cell: ({ row }) => {
      const queue = row.original.queue;
      if (!queue) return <span className="text-muted-foreground">-</span>;
      return <div className="text-sm font-mono max-w-xs truncate">{queue}</div>;
    },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status || MessageStatus.ACTIVE;
      return (
        <Badge variant={getStatusBadgeVariant(status)}>
          {formatStatus(status)}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.original.status);
    },
  },
  {
    accessorKey: 'body',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Body" />
    ),
    cell: ({ row }) => {
      const body = row.getValue('body') as unknown;
      const bodyText =
        typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      return (
        <div className="max-w-md truncate font-mono text-xs">{bodyText}</div>
      );
    },
  },
  {
    accessorKey: 'enqueuedTimeUtc',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) => {
      const timestamp = row.original.createdAt || row.original.enqueuedTimeUtc;
      return (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMessageSelect(row.original)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      );
    },
  },
];

export const MessagesDataTable: React.FC<MessagesDataTableProps> = ({
  messages,
  onMessageSelect,
}) => {
  const columns = React.useMemo(
    () => createColumns(onMessageSelect),
    [onMessageSelect]
  );

  return (
    <DataTable
      columns={columns}
      data={messages}
      searchKey="body"
      searchPlaceholder="Search message body..."
    />
  );
};
