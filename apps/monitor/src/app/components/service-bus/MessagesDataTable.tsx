import { ColumnDef } from '@tanstack/react-table';
import { Eye, Send, Trash } from 'lucide-react';
import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { Message } from '@e2e-monitor/entities';

export enum MessageState {
  ACTIVE = 'active', // Message is available for processing
  DEFERRED = 'deferred', // Message processing postponed
  SCHEDULED = 'scheduled', // Message scheduled for future delivery
  DEAD_LETTERED = 'dead-lettered', // Message moved to Dead Letter Queue
  COMPLETED = 'completed', // Message successfully processed
  ABANDONED = 'abandoned', // Message processing failed, returned to queue
  RECEIVED = 'received', // Message received but not yet completed
}

// Helper function to get badge variant based on status
const getStatusBadgeVariant = (
  status?: string,
):
  | 'default'
  | 'active'
  | 'deferred'
  | 'scheduled'
  | 'dead-lettered'
  | 'secondary' => {
  switch (status) {
    case MessageState.ACTIVE:
      return 'active';

    case MessageState.DEAD_LETTERED:
      return 'dead-lettered'; // Red - failed, in DLQ

    case MessageState.DEFERRED:
      return 'deferred'; // Gray - processing postponed
    case MessageState.SCHEDULED:
      return 'scheduled'; // Green - scheduled for future

    default:
      return 'secondary';
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
  onMessageReplay: (messageId: string) => void;
  onMessageDelete: (messageId: string) => void;
}

const createColumns = (
  onMessageSelect: (message: Message) => void,
  onMessageReplay: (messageId: string) => void,
  onMessageDelete: (messageId: string) => void,
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
      const queue = row.original.subject;
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
      const status = row.original.state || MessageState.ACTIVE;
      return (
        <Badge variant={getStatusBadgeVariant(status)}>
          {formatStatus(status)}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.original.state);
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
      const timestamp = row.original.timestamp;
      return (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {timestamp ? timestamp.toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const state = row.original.state || MessageState.ACTIVE;
      return (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMessageSelect(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {state === MessageState.DEAD_LETTERED && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onMessageReplay(row.original.messageId?.toString() || '')
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onMessageDelete(row.original.messageId?.toString() || '')
            }
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];

export const MessagesDataTable: React.FC<MessagesDataTableProps> = ({
  messages,
  onMessageSelect,
  onMessageReplay,
  onMessageDelete,
}) => {
  const columns = React.useMemo(
    () => createColumns(onMessageSelect, onMessageReplay, onMessageDelete),
    [onMessageSelect, onMessageReplay, onMessageDelete],
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
