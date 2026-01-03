import { ColumnDef } from '@tanstack/react-table';
import { Eye, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { VirtualizedDataTable } from '../../messages/data-table/VirtualizedDataTable';
import { DataTableColumnHeader } from '../../messages/data-table/DataTableColumnHeader';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../ui/sheet';
import { Card, CardContent } from '../../ui/card';

// Azure Service Bus Message Type - matches the schema
type AzureServiceBusMessage = {
  messageId?: string;
  body?: string;
  contentType?: string;
  subject?: string;
  sessionId?: string;
  replyTo?: string;
  timeToLive?: number;
  scheduledEnqueueTime?: Date;
  applicationProperties?: Record<string, any>;
  // Additional properties that might come from the API
  correlationId?: string;
  label?: string;
  partitionKey?: string;
  replyToSessionId?: string;
  to?: string;
  enqueuedTime?: Date;
  sequenceNumber?: number;
  deliveryCount?: number;
  lockedUntil?: Date;
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
  properties?: Record<string, any>;
};

// Tracking message type
type TrackingMessage = {
  _id: string;
  messageId: string;
  body: string;
  sentBy: string;
  sentAt: Date;
  status: 'sent' | 'processing' | 'received';
  queue?: string | null;
  receivedAt?: Date | null;
  receivedBy?: string | null;
  disposition?: 'complete' | 'abandon' | 'deadletter' | 'defer' | null;
  emulatorType?: 'sqs' | 'azure-service-bus' | null;
};

// Updated to match ServiceBusMessagesData from schemas
type AzureServiceBusData = {
  namespace: string;
  queueName: string;
  dlqMessages: AzureServiceBusMessage[];
  abandonedMessages: AzureServiceBusMessage[];
  deferredMessages: AzureServiceBusMessage[];
  trackingMessages: {
    deadletter: TrackingMessage[];
    abandon: TrackingMessage[];
    defer: TrackingMessage[];
  };
  summary: {
    dlq: number;
    abandoned: number;
    deferred: number;
    trackingDeadletter: number;
    trackingAbandon: number;
    trackingDefer: number;
  };
};

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

// Helper Components
const InfoBlock: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded break-words">{value}</p>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
    {children}
  </div>
);

// Message row type for table
type ServiceBusMessageRow = {
  messageId: string;
  body: string;
  label?: string;
  sessionId?: string;
  enqueuedTime?: Date;
  deliveryCount?: number;
  disposition: 'deadletter' | 'abandon' | 'defer';
};

// Convert Azure Service Bus Message to row format
const messageToRow = (msg: AzureServiceBusMessage, disposition: 'deadletter' | 'abandon' | 'defer'): ServiceBusMessageRow => ({
  messageId: msg.messageId || '',
  body: msg.body || '',
  label: msg.label || msg.subject,
  sessionId: msg.sessionId,
  enqueuedTime: msg.enqueuedTime,
  deliveryCount: msg.deliveryCount,
  disposition,
});

const createColumns = (
  onMessageSelect: (message: ServiceBusMessageRow, originalMessage: AzureServiceBusMessage) => void,
  allMessages: AzureServiceBusMessage[],
): ColumnDef<ServiceBusMessageRow>[] => [
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
    accessorKey: 'label',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Label" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32">
          {row.original.label || '-'}
        </div>
      );
    },
  },
  {
    accessorKey: 'sessionId',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Session ID" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs truncate max-w-32 font-mono">
          {row.original.sessionId || '-'}
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
      const disposition = row.original.disposition;
      const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        deadletter: 'destructive',
        abandon: 'secondary',
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
    accessorKey: 'deliveryCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Delivery Count" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-xs text-center">
          {row.original.deliveryCount ?? '-'}
        </div>
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
    accessorKey: 'enqueuedTime',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Enqueued At" />
    ),
    cell: ({ row }) => {
      const timestamp = row.original.enqueuedTime;
      return (
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {timestamp ? timestamp.toLocaleString() : 'N/A'}
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
            onClick={() => {
              const originalMessage = allMessages.find(m => m.messageId === row.original.messageId);
              if (originalMessage) {
                onMessageSelect(row.original, originalMessage);
              }
            }}
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      );
    },
  },
];

interface AzureSbDetailProps {
  data: AzureServiceBusData | undefined;
}

export const AzureSbDetail: React.FC<AzureSbDetailProps> = ({ data }) => {
  const [selectedMessage, setSelectedMessage] = useState<ServiceBusMessageRow | null>(null);
  const [selectedOriginalMessage, setSelectedOriginalMessage] = useState<AzureServiceBusMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(false);

  const handleMessageSelect = React.useCallback((message: ServiceBusMessageRow, originalMessage: AzureServiceBusMessage) => {
    setSelectedMessage(message);
    setSelectedOriginalMessage(originalMessage);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = React.useCallback(() => {
    setIsModalOpen(false);
    setSelectedMessage(null);
    setSelectedOriginalMessage(null);
    setIsBodyExpanded(false);
    setIsPropertiesExpanded(false);
  }, []);

  // Combine all messages into a single array - handle undefined data
  const allMessages = React.useMemo(() => {
    if (!data) return [];
    return [
      ...data.dlqMessages,
      ...data.abandonedMessages,
      ...data.deferredMessages,
    ];
  }, [data]);

  const allRows = React.useMemo(() => {
    if (!data) return [];
    const dlqRows = data.dlqMessages.map(msg => messageToRow(msg, 'deadletter'));
    const abandonedRows = data.abandonedMessages.map(msg => messageToRow(msg, 'abandon'));
    const deferredRows = data.deferredMessages.map(msg => messageToRow(msg, 'defer'));
    
    return [...dlqRows, ...abandonedRows, ...deferredRows];
  }, [data]);

  const columns = React.useMemo(
    () => createColumns(handleMessageSelect, allMessages),
    [handleMessageSelect, allMessages],
  );

  const totalMessages = data ? (data.summary.dlq + data.summary.abandoned + data.summary.deferred) : 0;

  // Handle undefined data - moved after all hooks
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Dead Letter Queue</div>
              <div className="text-xl font-bold">{data.summary.dlq}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Abandoned</div>
              <div className="text-xl font-bold">{data.summary.abandoned}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Deferred</div>
              <div className="text-xl font-bold">{data.summary.deferred}</div>
            </CardContent>
          </Card>
        </div>

        {/* Single Combined Table */}
        <Card>
          <CardContent className="p-4">
            <div className="w-full min-w-0 flex-1 min-h-0">
              <VirtualizedDataTable
                columns={columns}
                data={allRows}
                searchKey="body"
                searchPlaceholder={`Search all messages (${totalMessages} total)...`}
                estimateSize={48}
                overscan={5}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Sheet open={isModalOpen} onOpenChange={handleModalClose}>
        <SheetContent className="w-2/6 sm:max-w-4xl overflow-hidden">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold">
              <div className='flex items-center justify-between px-4'>
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-1">Service Bus Message Details</label>
                  <Badge variant="outline" className="text-xs">Azure SB</Badge>
                </div>
                {selectedMessage && (
                  <Badge 
                    variant={
                      selectedMessage.disposition === 'deadletter' ? 'destructive' : 
                      selectedMessage.disposition === 'abandon' ? 'secondary' : 
                      'outline'
                    } 
                    className="text-sm"
                  >
                    {selectedMessage.disposition.charAt(0).toUpperCase() + selectedMessage.disposition.slice(1)}
                  </Badge>
                )}
              </div>
            </SheetTitle>
          </SheetHeader>

          {selectedMessage && selectedOriginalMessage && (
            <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
              {/* Basic Information */}
              <Section title="Basic Information">
                <div className="grid grid-cols-2 gap-4">
                  <InfoBlock label="Message ID" value={<span className="font-mono text-xs">{selectedOriginalMessage.messageId}</span>} />
                  <InfoBlock label="Correlation ID" value={selectedOriginalMessage.correlationId || 'N/A'} />
                  <InfoBlock label="Label" value={selectedOriginalMessage.label || selectedOriginalMessage.subject || 'N/A'} />
                  <InfoBlock label="Content Type" value={selectedOriginalMessage.contentType || 'N/A'} />
                </div>
              </Section>

              {/* Session & Routing */}
              <Section title="Session & Routing">
                <div className="grid grid-cols-2 gap-4">
                  <InfoBlock label="Session ID" value={selectedOriginalMessage.sessionId || 'N/A'} />
                  <InfoBlock label="Partition Key" value={selectedOriginalMessage.partitionKey || 'N/A'} />
                  <InfoBlock label="Reply To" value={selectedOriginalMessage.replyTo || 'N/A'} />
                  <InfoBlock label="Reply To Session" value={selectedOriginalMessage.replyToSessionId || 'N/A'} />
                  <InfoBlock label="To" value={selectedOriginalMessage.to || 'N/A'} />
                </div>
              </Section>

              {/* Delivery Information */}
              <Section title="Delivery Information">
                <div className="grid grid-cols-2 gap-4">
                  <InfoBlock label="Delivery Count" value={selectedOriginalMessage.deliveryCount ?? 'N/A'} />
                  <InfoBlock label="Sequence Number" value={selectedOriginalMessage.sequenceNumber ?? 'N/A'} />
                  <InfoBlock label="Enqueued Time" value={selectedOriginalMessage.enqueuedTime ? selectedOriginalMessage.enqueuedTime.toLocaleString() : 'N/A'} />
                  <InfoBlock label="Locked Until" value={selectedOriginalMessage.lockedUntil ? selectedOriginalMessage.lockedUntil.toLocaleString() : 'N/A'} />
                  {selectedOriginalMessage.scheduledEnqueueTime && (
                    <InfoBlock label="Scheduled Enqueue Time" value={selectedOriginalMessage.scheduledEnqueueTime.toLocaleString()} />
                  )}
                  {selectedOriginalMessage.timeToLive && (
                    <InfoBlock label="Time To Live" value={`${selectedOriginalMessage.timeToLive}ms`} />
                  )}
                </div>
              </Section>

              {/* Dead Letter Information */}
              {(selectedOriginalMessage.deadLetterReason || selectedOriginalMessage.deadLetterErrorDescription) && (
                <Section title="Dead Letter Information">
                  <div className="grid grid-cols-1 gap-4">
                    {selectedOriginalMessage.deadLetterReason && (
                      <InfoBlock label="Dead Letter Reason" value={selectedOriginalMessage.deadLetterReason} />
                    )}
                    {selectedOriginalMessage.deadLetterErrorDescription && (
                      <InfoBlock label="Error Description" value={selectedOriginalMessage.deadLetterErrorDescription} />
                    )}
                  </div>
                </Section>
              )}

              {/* Message Body */}
              <Section title="Message Body">
                {selectedOriginalMessage.body ? (
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
                        {formatBody(selectedOriginalMessage.body)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded">No body content</div>
                )}
              </Section>

              {/* Custom Properties */}
              {((selectedOriginalMessage.properties && Object.keys(selectedOriginalMessage.properties).length > 0) ||
                (selectedOriginalMessage.applicationProperties && Object.keys(selectedOriginalMessage.applicationProperties).length > 0)) && (
                <Section title="Custom Properties">
                  <>
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPropertiesExpanded(!isPropertiesExpanded)}
                        className="h-6 px-2 text-xs"
                      >
                        {isPropertiesExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" /> Hide Properties
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" /> Show Properties
                          </>
                        )}
                      </Button>
                    </div>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        isPropertiesExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(
                          selectedOriginalMessage.properties || selectedOriginalMessage.applicationProperties,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </>
                </Section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};