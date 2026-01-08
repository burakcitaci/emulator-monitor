import { ColumnDef, Row } from '@tanstack/react-table';
import { ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { VirtualizedDataTable } from './data-table/VirtualizedDataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { TrackingMessage } from '@e2e-monitor/entities';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Option } from '../../types/data-table';

// Helper function to format body content
const formatBody = (body: unknown): string => {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  } else if (typeof body === 'object' && body !== null) {
    return JSON.stringify(body, null, 2);
  }
  return String(body || 'No body content');
};

// Helper function to calculate processing duration
const calculateProcessingDuration = (sentAt: string | Date, receivedAt?: string | Date): string => {
  if (!receivedAt) return 'N/A';

  const sent = new Date(sentAt).getTime();
  const received = new Date(receivedAt).getTime();
  const durationMs = received - sent;

  if (durationMs < 0) return 'Invalid';

  // Convert to appropriate units
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(2)}s`;
  } else if (durationMs < 3600000) {
    return `${(durationMs / 60000).toFixed(2)}m`;
  } else {
    return `${(durationMs / 3600000).toFixed(2)}h`;
  }
};

// Helper Components
const InfoBlock: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{value}</p>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
    {children}
  </div>
);

interface TrackingMessagesDataTableProps {
  messages: TrackingMessage[] | undefined;
}

const createColumns = (
  sentByOptions: Option[],
  receivedByOptions: Option[],
  emulatorTypeOptions: Option[],
  sentByFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
  receivedByFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
  emulatorTypeFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
  statusFilterFn: (row: Row<TrackingMessage>, id: string, value: unknown) => boolean,
): ColumnDef<TrackingMessage>[] => [
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
    accessorKey: 'emulatorType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Emulator" />
    ),
    cell: ({ row }) => {
      const emulatorType = row.original.emulatorType;
      const displayText = emulatorType === 'azure-service-bus' ? 'Azure SB' :
                         emulatorType === 'sqs' ? 'SQS' :
                         emulatorType || '-';

      return (
        <div className="text-xs">
          {displayText}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: emulatorTypeFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Emulator',
      options: emulatorTypeOptions,
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
    enableColumnFilter: true,
    filterFn: sentByFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Sent By',
      options: sentByOptions,
    },
  },
  {
    accessorKey: 'receivedBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received By" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const receivedBy = row.original.receivedBy;
      
      if (status === 'processing') {
        return (
          <Badge variant="outline" className="text-xs px-2 py-0.5 h-5">
            Processing
          </Badge>
        );
      }
      
      return (
        <div className="text-xs truncate max-w-32">
          {receivedBy || '-'}
        </div>
      );
    },
    enableColumnFilter: true,
    filterFn: receivedByFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Received By',
      options: receivedByOptions,
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
      const variantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
        received: 'default',
        processing: 'outline',
        sent: 'secondary',
      };
      return (
        <Badge
          variant={variantMap[status] || 'secondary'}
          className="text-xs px-2 py-0.5 h-5"
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
    enableColumnFilter: true,
    filterFn: statusFilterFn,
    meta: {
      variant: 'multiSelect',
      label: 'Status',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Processing', value: 'processing' },
        { label: 'Received', value: 'received' },
      ] as Option[],
    },
  },
  {
    id: 'disposition',
    accessorKey: 'disposition',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Disposition" />
    ),
    cell: ({ row }) => {
      const disposition = row.original.disposition;
      const status = row.original.status;
      
      // Show "Processing" badge when message is being processed
      if (status === 'processing') {
        return (
          <Badge variant="outline" className="text-xs px-2 py-0.5 h-5">
            Processing
          </Badge>
        );
      }
      
      // Only show disposition when message has been received/processed
      if (status !== 'received' || !disposition) {
        return <div className="text-xs text-muted-foreground">-</div>;
      }
      
      const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        complete: 'default',
        abandon: 'secondary',
        deadletter: 'destructive',
        defer: 'outline',
      };
      
      return (
        <Badge
          variant={variantMap[disposition] || 'secondary'}
          className="text-xs px-2 py-0.5 h-5"
        >
          {disposition.charAt(0).toUpperCase() + disposition.slice(1)}
        </Badge>
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
];

export const TrackingMessagesDataTable: React.FC<TrackingMessagesDataTableProps> = ({
  messages,
}) => {
  // Ensure messages is always an array - wrapped in useMemo to fix ESLint warning
  const safeMessages = React.useMemo(() => messages || [], [messages]);
  const [selectedMessage, setSelectedMessage] = useState<TrackingMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);

  const handleModalClose = React.useCallback(() => {
    setIsModalOpen(false);
    setSelectedMessage(null);
    setIsBodyExpanded(false);
  }, []);

  // Memoize filter options to avoid recalculation on every render
  const filterOptions = React.useMemo(() => {
    const sentByOptions = Array.from(
      new Set(safeMessages.map(m => m.sentBy).filter((v): v is string => Boolean(v)))
    ).map(value => ({ label: value, value }));

    const receivedByOptions = Array.from(
      new Set(safeMessages.map(m => m.receivedBy).filter((v): v is string => Boolean(v)))
    ).map(value => ({ label: value, value }));

    const emulatorTypeOptions = Array.from(
      new Set(safeMessages.map(m => m.emulatorType).filter((v): v is 'sqs' | 'azure-service-bus' => Boolean(v)))
    ).map((value: 'sqs' | 'azure-service-bus') => ({
      label: value === 'azure-service-bus' ? 'Azure Service Bus' :
             value === 'sqs' ? 'SQS' : value,
      value
    }));

    return { sentByOptions, receivedByOptions, emulatorTypeOptions };
  }, [safeMessages]);

  // Memoize filter functions to prevent unnecessary re-renders
  const sentByFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.original.sentBy);
  }, []);

  const receivedByFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.original.receivedBy);
  }, []);

  const emulatorTypeFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.original.emulatorType);
  }, []);

  const statusFilterFn = React.useCallback((row: Row<TrackingMessage>, id: string, value: unknown) => {
    if (!value || !Array.isArray(value)) return true;
    return value.includes(row.original.status);
  }, []);

  const columns = React.useMemo(
    () =>
      createColumns(

        filterOptions.sentByOptions,
        filterOptions.receivedByOptions,
        filterOptions.emulatorTypeOptions,
        sentByFilterFn,
        receivedByFilterFn,
        emulatorTypeFilterFn,
        statusFilterFn,
       
      ),
    [
      filterOptions.sentByOptions,
      filterOptions.receivedByOptions,
      filterOptions.emulatorTypeOptions,
      sentByFilterFn,
      receivedByFilterFn,
      emulatorTypeFilterFn,
      statusFilterFn,
    ],
  );

  return (
    <>
      <VirtualizedDataTable
        columns={columns}
        data={safeMessages}
        searchKey="body"
        searchPlaceholder="Search message body..."
        estimateSize={48}
        overscan={5}
        
      />
      <Sheet open={isModalOpen} onOpenChange={handleModalClose}>
        <SheetContent className="w-2/6 sm:max-w-4xl overflow-hidden">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold">
              <div className='flex items-center justify-between px-4'>
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-1">Tracking Message Details</label>
                  <Badge variant="outline" className="text-xs">
                    {selectedMessage?.emulatorType === 'azure-service-bus' ? 'Azure SB' :
                     selectedMessage?.emulatorType === 'sqs' ? 'SQS' :
                     selectedMessage?.emulatorType || 'Unknown'}
                  </Badge>
                </div>
                <Badge variant={selectedMessage?.status === 'received' ? 'default' : 'secondary'} className="text-sm">
                  {selectedMessage?.status === 'received' ? 'Completed' : 'Sent'}
                </Badge>
              </div>
            </SheetTitle>
          </SheetHeader>

          {selectedMessage && (
            <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
              {/* Top Section: ID, Sent By, Received By */}
            
              <div className="grid grid-cols-2 gap-4">
                 <InfoBlock label="Sent By" value={selectedMessage.sentBy} />
                <InfoBlock label="Received By" value={selectedMessage.receivedBy || 'N/A'} />
             
              </div>
              {/* Timestamps */}
              <Section title="Timestamps">
                <div className="grid grid-cols-3 gap-4">
                  <InfoBlock label="Sent At" value={new Date(selectedMessage.sentAt).toLocaleString()} />
                  <InfoBlock label="Received At" value={selectedMessage.receivedAt ? new Date(selectedMessage.receivedAt).toLocaleString() : 'N/A'} />
                  <InfoBlock label="Processing Duration" value={calculateProcessingDuration(selectedMessage.sentAt, selectedMessage.receivedAt)} />
                </div>
              </Section>

              {/* Message Body */}
              <Section title="Message Body">
                {selectedMessage.body ? (
                  <>
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsBodyExpanded(!isBodyExpanded)}
                        className="h-6 px-2 text-xs"
                      >
                        {isBodyExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" /> Hide Body
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" /> Show Body
                          </>
                        )}
                      </Button>
                    </div>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        isBodyExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                        {formatBody(selectedMessage.body)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded">No body content</div>
                )}
              </Section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
