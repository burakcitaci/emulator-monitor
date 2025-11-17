import React from 'react';
import { Activity } from 'lucide-react';
import { Message } from '@e2e-monitor/entities';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './data-table/DataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { Badge } from '../ui/badge';
import type { Option } from '../../types/data-table';

interface MessageTableProps {
  messages: Message[];
  onMessageSelect: (message: Message) => void;
}

// Helper function to format body content for display
const formatBodyForDisplay = (body: string | Record<string, unknown>): string => {
  if (typeof body === 'string') {
    return body;
  } else if (typeof body === 'object' && body !== null) {
    return JSON.stringify(body);
  }
  return String(body || '');
};

const createColumns = (
  onMessageSelect: (message: Message) => void,
): ColumnDef<Message>[] => [
  {
    accessorKey: 'timestamp',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-sm text-gray-600">
          {new Date(row.original.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      );
    },
  },
  {
    accessorKey: 'queue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Queue/Topic" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-sm font-medium">{row.original.queue}</div>
      );
    },
  },
  {
    accessorKey: 'state',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      return (
        <Badge variant="secondary" className={`text-xs`}>
          {row.original.state}
        </Badge>
      );
    },
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      return value.includes(row.original.state);
    },
    meta: {
      variant: 'multiSelect',
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Deferred', value: 'deferred' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Dead Lettered', value: 'dead-lettered' },
        { label: 'Completed', value: 'completed' },
        { label: 'Expired', value: 'expired' },
        { label: 'Abandoned', value: 'abandoned' },
        { label: 'Received', value: 'received' },
      ] as Option[],
    },
  },
  {
    accessorKey: 'body',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Body Preview" />
    ),
    cell: ({ row }) => {
      const bodyText = formatBodyForDisplay(row.original.body);
      return (
        <div className="max-w-md truncate text-xs">
          {bodyText.length > 80 ? `${bodyText.substring(0, 80)}...` : bodyText}
        </div>
      );
    },
  },
  {
    id: 'actions',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Actions" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMessageSelect(row.original);
            }}
          >
            View
          </Button>
        </div>
      );
    },
  },
];

export const MessageTable: React.FC<MessageTableProps> = ({
  messages,
  onMessageSelect,
}) => {
  // Move useMemo before any conditional returns
  const columns = React.useMemo(
    () => createColumns(onMessageSelect),
    [onMessageSelect],
  );

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No messages found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden">
      <DataTable
        columns={columns}
        data={messages}
        searchKey="body"
        searchPlaceholder="Search message body..."
      />
    </div>
  );
};