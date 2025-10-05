import { ColumnDef } from '@tanstack/react-table';
import { Eye, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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

export const MessagesDataTable: React.FC<MessagesDataTableProps> = ({
  messages,
  onMessageSelect,
}) => {
  const columns: ColumnDef<DeadLetterMessage>[] = [
    {
      accessorKey: 'direction',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Direction" />
      ),
      cell: ({ row }) => {
        const direction = row.getValue('direction') as string;
        return (
          <div className="flex items-center">
            {direction === 'incoming' ? (
              <ArrowDownLeft className="mr-2 h-4 w-4 text-green-600" />
            ) : (
              <ArrowUpRight className="mr-2 h-4 w-4 text-blue-600" />
            )}
            <span className="capitalize">{direction}</span>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'queueName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Queue/Topic" />
      ),
      cell: ({ row }) => {
        return <div className="font-medium">{row.getValue('queueName')}</div>;
      },
    },
    {
      accessorKey: 'body',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Body" />
      ),
      cell: ({ row }) => {
        const body = row.getValue('body') as string;
        return (
          <div className="max-w-md truncate font-mono text-xs">{body}</div>
        );
      },
    },
    {
      accessorKey: 'timestamp',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Timestamp" />
      ),
      cell: ({ row }) => {
        const timestamp = row.getValue('timestamp') as string;
        return (
          <div className="text-sm text-muted-foreground">
            {new Date(timestamp).toLocaleString()}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
          sent: 'default',
          received: 'secondary',
          processing: 'outline',
          error: 'destructive' as 'default',
        };
        return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'isDeadLetter',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Dead Letter" />
      ),
      cell: ({ row }) => {
        const isDeadLetter = row.getValue('isDeadLetter') as boolean;
        return isDeadLetter ? (
          <Badge variant="destructive">DLQ</Badge>
        ) : (
          <Badge variant="outline">Active</Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const message = row.original;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMessageSelect(message)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={messages}
      searchKey="body"
      searchPlaceholder="Search message body..."
    />
  );
};
