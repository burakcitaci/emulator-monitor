import { ColumnDef } from '@tanstack/react-table';
import { Eye, RotateCw } from 'lucide-react';
import React from 'react';
import { Message } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';

interface DLQDataTableProps {
  messages: Message[];
  onReplay: (messageId: string) => void;
  onView: (message: Message) => void;
}

export const DLQDataTable: React.FC<DLQDataTableProps> = ({
  messages,
  onReplay,
  onView,
}) => {
  const columns: ColumnDef<Message>[] = [
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
        <DataTableColumnHeader column={column} title="Message Body" />
      ),
      cell: ({ row }) => {
        const body = row.getValue('body') as string;
        return (
          <div className="max-w-md truncate font-mono text-xs">{body}</div>
        );
      },
    },
    {
      accessorKey: 'properties',
      header: 'Failure Reason',
      cell: ({ row }) => {
        const properties = row.getValue('properties') as any;
        const failureReason = properties?.failureReason || 'Unknown';
        return (
          <Badge variant="destructive" className="font-mono text-xs">
            {failureReason}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'timestamp',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Dead Letter Time" />
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
      id: 'retryCount',
      header: 'Retry Count',
      cell: ({ row }) => {
        const properties = row.original.properties as any;
        const retryCount = properties?.retryCount || 0;
        return <Badge variant="outline">{retryCount} attempts</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const message = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReplay(message.id)}
            >
              <RotateCw className="h-4 w-4 mr-1" />
              Replay
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onView(message)}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={messages}
      searchKey="body"
      searchPlaceholder="Search dead letter messages..."
    />
  );
};
