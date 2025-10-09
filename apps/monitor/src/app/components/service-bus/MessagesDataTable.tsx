import { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { DeadLetterMessage } from '../../hooks/useServiceBus';

interface MessagesDataTableProps {
  messages: DeadLetterMessage[];
  onMessageSelect: (message: DeadLetterMessage) => void;
}

const createColumns = (
  onMessageSelect: (message: DeadLetterMessage) => void
): ColumnDef<DeadLetterMessage>[] => [
  {
    accessorKey: 'messageId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message ID" />
    ),
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.messageId}</div>;
    },
  },
  {
    accessorKey: 'subject',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subject" />
    ),
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.subject}</div>;
    },
  },
  {
    accessorKey: 'body',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Body" />
    ),
    cell: ({ row }) => {
      return (
        <div className="max-w-md truncate font-mono text-xs">
          {row.original.body}
        </div>
      );
    },
  },
  {
    accessorKey: 'enqueuedTimeUtc',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) => {
      const timestamp = row.original.enqueuedTimeUtc;
      return (
        <div className="text-sm text-muted-foreground">
          {timestamp ? new Date(timestamp).toLocaleString() : 'N/A'}
        </div>
      );
    },
  },
  {
    id: 'deadLetter',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dead Letter" />
    ),
    cell: ({ row }) => {
      // Derive from deadLetterReason since isDeadLetter isn't in the interface
      const isDeadLetter = !!row.original.deadLetterReason;
      return isDeadLetter ? (
        <Badge variant="destructive">DLQ</Badge>
      ) : (
        <Badge variant="outline">Active</Badge>
      );
    },
    filterFn: (row, id, value) => {
      const isDeadLetter = !!row.original.deadLetterReason;
      return value.includes(isDeadLetter);
    },
  },
  {
    accessorKey: 'deliveryCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Delivery Count" />
    ),
    cell: ({ row }) => {
      return <div className="text-sm">{row.original.deliveryCount ?? 0}</div>;
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
