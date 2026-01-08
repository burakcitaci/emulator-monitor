import { ColumnDef } from "@tanstack/react-table";
import { TrackingMessage } from "../../../lib/schemas";
import { DataTableColumnHeader } from "../../../components/data-table/DataTableColumnHeader";
import { Button } from "../../../components/ui/button";
import { Eye, Trash } from "lucide-react";
import { Badge } from "../../../components/ui/badge";

export const createColumns = (
  onMessageSelect: (originalMessage: TrackingMessage) => void,
  onMessageDelete: (messageId: string) => void,
): ColumnDef<TrackingMessage>[] => [
  {
    accessorKey: 'messageId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message ID" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-48 font-mono">
          {row.original.messageId || '-'}
        </div>
      );
    },
  },
  {
    accessorKey: 'queue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Queue" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32">
          {row.original.queue || '-'}
        </div>
      );
    },
  },
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
  },
  {
    id: 'disposition',
    accessorKey: 'disposition',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Disposition" />
    ),
    cell: ({ row }) => {
      const disposition = row.original.disposition ?? 'undefined';
      const variantMap: Record<
        string,
        'default' | 'secondary' | 'destructive' | 'outline'
      > = {
        complete: 'default',
        deadletter: 'destructive',
        abandon: 'secondary',
        defer: 'outline',
      };

      return (
        <Badge
          variant={
            variantMap[disposition as keyof typeof variantMap] || 'secondary'
          }
          className="text-xs px-2 py-0.5 h-5"
        >
          {disposition?.charAt(0).toUpperCase() + disposition?.slice(1)}
        </Badge>
      );
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
            onClick={() => onMessageDelete(row.original.messageId)}
          >
            <Trash className="h-3 w-3" />
          </Button>
        </div>
      );
    },
  },
];
