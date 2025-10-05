import { ColumnDef } from '@tanstack/react-table';
import { Eye, RotateCw } from 'lucide-react';
import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import {
  DeadLetterMessage,
  DeadLetterMessageResponse,
} from '../../hooks/useServiceBus';

interface DLQDataTableProps {
  messages: DeadLetterMessageResponse;
  onReplay: (messageId: string) => void;
  onView: (message: DeadLetterMessage) => void;
}

export const DLQDataTable: React.FC<DLQDataTableProps> = ({
  messages,
  onReplay,
  onView,
}) => {
  const columns: ColumnDef<DeadLetterMessage>[] = [
    {
      accessorKey: 'subject',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subject" />
      ),
      cell: ({ row }) => {
        const subject = row.getValue('subject') as string;
        return <div className="font-medium">{subject || 'N/A'}</div>;
      },
    },
    {
      accessorKey: 'body',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Message Body" />
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
      accessorKey: 'deadLetterReason',
      header: 'Failure Reason',
      cell: ({ row }) => {
        const deadLetterReason = row.getValue('deadLetterReason') as string;
        return (
          <Badge variant="destructive" className="font-mono text-xs">
            {deadLetterReason || 'Unknown'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'enqueuedTimeUtc',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Enqueued Time" />
      ),
      cell: ({ row }) => {
        const enqueuedTime = row.getValue('enqueuedTimeUtc') as Date;
        return (
          <div className="text-sm text-muted-foreground">
            {enqueuedTime ? new Date(enqueuedTime).toLocaleString() : 'N/A'}
          </div>
        );
      },
    },
    {
      accessorKey: 'deliveryCount',
      header: 'Delivery Count',
      cell: ({ row }) => {
        const deliveryCount = row.getValue('deliveryCount') as number;
        return <Badge variant="outline">{deliveryCount || 0} attempts</Badge>;
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
              onClick={() => onReplay(message.messageId || '')}
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
      data={messages.messages || []}
      searchKey="body"
      searchPlaceholder="Search dead letter messages..."
    />
  );
};
