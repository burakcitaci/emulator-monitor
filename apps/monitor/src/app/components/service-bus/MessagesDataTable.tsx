import { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { DeadLetterMessage, Message } from '../../hooks/useServiceBus';

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
      const timestamp = row.original.scheduledEnqueueTimeUtc;
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
      const isDeadLetter = !!row.original.contentType;
      return isDeadLetter ? (
        <Badge variant="destructive">DLQ</Badge>
      ) : (
        <Badge variant="outline">Active</Badge>
      );
    },
    filterFn: (row, id, value) => {
      const isDeadLetter = !!row.original.contentType;
      return value.includes(isDeadLetter);
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
  {
    id: 'status',
    cell: ({ row }) => {
      return row.original ? 'Locked' : 'Available';
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    filterFn: (row, id, value) => {
      const isLocked = !!row.original.state;
      return value;
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
