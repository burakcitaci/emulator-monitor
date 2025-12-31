import { ColumnDef } from '@tanstack/react-table';
import { Eye, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { VirtualizedDataTable } from './data-table/VirtualizedDataTable';
import { DataTableColumnHeader } from './data-table/DataTableColumnHeader';
import { AwsSqsMessage, AwsSqsMessagesData } from '../../lib/schemas';
import { TrackingMessage } from '@e2e-monitor/entities';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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

// Convert AwsSqsMessage to a format suitable for the table
type SqsMessageRow = {
  messageId: string;
  body: string;
  sentBy?: string;
  sentAt?: Date;
  disposition: string;
  receiptHandle?: string;
  source: 'queue' | 'tracking';
};

// Convert TrackingMessage to SqsMessageRow
// Handle the case where API returns null values that need to be converted to undefined
const trackingToRow = (msg: {
  messageId: string;
  body?: string | null;
  sentBy?: string | null;
  sentAt?: Date | string | null;
  disposition?: string | null;
}): SqsMessageRow => ({
  messageId: msg.messageId,
  body: msg.body || '',
  sentBy: msg.sentBy ?? undefined,
  sentAt: msg.sentAt ? new Date(msg.sentAt) : undefined,
  disposition: msg.disposition || 'unknown',
  source: 'tracking',
});

// Convert AwsSqsMessage to SqsMessageRow
const sqsMessageToRow = (msg: AwsSqsMessage): SqsMessageRow => {
  const sentBy = msg.MessageAttributes?.sentBy?.StringValue;
  const disposition = msg.MessageAttributes?.messageDisposition?.StringValue || 'unknown';
  const sentTimestamp = msg.Attributes?.SentTimestamp;
  const sentAt = sentTimestamp ? new Date(parseInt(sentTimestamp)) : undefined;

  return {
    messageId: msg.MessageId || '',
    body: msg.Body || '',
    sentBy,
    sentAt,
    disposition,
    receiptHandle: msg.ReceiptHandle,
    source: 'queue',
  };
};

const createColumns = (
  onMessageSelect: (message: SqsMessageRow, originalMessage: AwsSqsMessage | TrackingMessage) => void,
  data: AwsSqsMessagesData,
): ColumnDef<SqsMessageRow>[] => [
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
    id: 'source',
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => {
      const source = row.original.source;
      return (
        <Badge
          variant={source === 'queue' ? 'default' : 'secondary'}
          className="text-xs px-2 py-0.5 h-5"
        >
          {source === 'queue' ? 'Queue' : 'Tracking'}
        </Badge>
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
              // Find the original message from the data
              const sqsMessage = data.dlqMessages.find(m => m.MessageId === row.original.messageId) ||
                                data.abandonedMessages.find(m => m.MessageId === row.original.messageId) ||
                                data.deferredMessages.find(m => m.MessageId === row.original.messageId);
              
              if (sqsMessage) {
                onMessageSelect(row.original, sqsMessage);
                return;
              }

              // Find tracking message and normalize null values
              const trackingMsg = data.trackingMessages.deadletter.find(m => m.messageId === row.original.messageId) ||
                                 data.trackingMessages.abandon.find(m => m.messageId === row.original.messageId) ||
                                 data.trackingMessages.defer.find(m => m.messageId === row.original.messageId);
              
              if (trackingMsg) {
                // Normalize null values to undefined for TrackingMessage type
                const normalizedTrackingMsg: TrackingMessage = {
                  ...trackingMsg,
                  queue: trackingMsg.queue ?? undefined,
                  receivedAt: trackingMsg.receivedAt ?? undefined,
                  receivedBy: trackingMsg.receivedBy ?? undefined,
                  disposition: trackingMsg.disposition ?? undefined,
                  emulatorType: trackingMsg.emulatorType ?? undefined,
                };
                onMessageSelect(row.original, normalizedTrackingMsg);
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

interface SqsMessagesDataTableProps {
  data: AwsSqsMessagesData;
}

export const SqsMessagesDataTable: React.FC<SqsMessagesDataTableProps> = ({
  data,
}) => {
  const [selectedMessage, setSelectedMessage] = useState<SqsMessageRow | null>(null);
  const [selectedOriginalMessage, setSelectedOriginalMessage] = useState<AwsSqsMessage | TrackingMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);

  const handleMessageSelect = React.useCallback((message: SqsMessageRow, originalMessage: AwsSqsMessage | TrackingMessage) => {
    setSelectedMessage(message);
    setSelectedOriginalMessage(originalMessage);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = React.useCallback(() => {
    setIsModalOpen(false);
    setSelectedMessage(null);
    setSelectedOriginalMessage(null);
    setIsBodyExpanded(false);
  }, []);

  // Convert messages to rows and merge tracking messages with queue messages
  const dlqRows = React.useMemo(() => {
    const queueRows = data.dlqMessages.map(sqsMessageToRow);
    const trackingRows = data.trackingMessages.deadletter.map(trackingToRow);
    return [...queueRows, ...trackingRows];
  }, [data.dlqMessages, data.trackingMessages.deadletter]);

  const abandonedRows = React.useMemo(() => {
    const queueRows = data.abandonedMessages.map(sqsMessageToRow);
    const trackingRows = data.trackingMessages.abandon.map(trackingToRow);
    return [...queueRows, ...trackingRows];
  }, [data.abandonedMessages, data.trackingMessages.abandon]);

  const deferredRows = React.useMemo(() => {
    const queueRows = data.deferredMessages.map(sqsMessageToRow);
    const trackingRows = data.trackingMessages.defer.map(trackingToRow);
    return [...queueRows, ...trackingRows];
  }, [data.deferredMessages, data.trackingMessages.defer]);

  const columns = React.useMemo(
    () => createColumns(handleMessageSelect, data),
    [handleMessageSelect, data],
  );

  return (
    <>
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">DLQ Messages</div>
              <div className="text-xl font-bold">{data.summary.dlq + data.summary.trackingDeadletter}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.summary.dlq} from queue, {data.summary.trackingDeadletter} from tracking
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Abandoned</div>
              <div className="text-xl font-bold">{data.summary.abandoned + data.summary.trackingAbandon}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.summary.abandoned} from queue, {data.summary.trackingAbandon} from tracking
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Deferred</div>
              <div className="text-xl font-bold">{data.summary.deferred + data.summary.trackingDefer}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.summary.deferred} from queue, {data.summary.trackingDefer} from tracking
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message Sections */}
        <div className="space-y-6">
          {/* DLQ Messages */}
          {dlqRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>DLQ Messages ({data.summary.dlq + data.summary.trackingDeadletter})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 flex-1 min-h-0">
                  <VirtualizedDataTable
                    columns={columns}
                    data={dlqRows}
                    searchKey="body"
                    searchPlaceholder="Search DLQ messages..."
                    estimateSize={48}
                    overscan={5}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Abandoned Messages */}
          {abandonedRows.length > 0 && (
            <div className="w-full min-w-0 flex-1 min-h-0">
                  <VirtualizedDataTable
                    columns={columns}
                    data={abandonedRows}
                    searchKey="body"
                    searchPlaceholder="Search abandoned messages..."
                    estimateSize={48}
                    overscan={5}
                  />
                </div>
          )}

          {/* Deferred Messages */}
          {deferredRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Deferred Messages ({data.summary.deferred + data.summary.trackingDefer})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full min-w-0 flex-1 min-h-0">
                  <VirtualizedDataTable
                    columns={columns}
                    data={deferredRows}
                    searchKey="body"
                    searchPlaceholder="Search deferred messages..."
                    estimateSize={48}
                    overscan={5}
                  />
                </div>
              </CardContent>
            </Card>
          )}

      
        </div>
      </div>

      {/* Detail Modal */}
      <Sheet open={isModalOpen} onOpenChange={handleModalClose}>
        <SheetContent className="w-2/6 sm:max-w-4xl overflow-hidden">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold">
              <div className='flex items-center justify-between px-4'>
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-1">SQS Message Details</label>
                  <Badge variant="outline" className="text-xs">SQS</Badge>
                </div>
                {selectedMessage && (
                  <Badge variant={selectedMessage.disposition === 'abandon' ? 'secondary' : 'default'} className="text-sm">
                    {selectedMessage.disposition.charAt(0).toUpperCase() + selectedMessage.disposition.slice(1)}
                  </Badge>
                )}
              </div>
            </SheetTitle>
          </SheetHeader>

          {selectedMessage && (
            <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
              {/* Top Section */}
              <div className="grid grid-cols-2 gap-4">
                <InfoBlock label="Message ID" value={<span className="font-mono text-xs">{selectedMessage.messageId}</span>} />
                <InfoBlock label="Sent By" value={selectedMessage.sentBy || 'N/A'} />
              </div>

              {/* Timestamps */}
              <Section title="Timestamps">
                <div className="grid grid-cols-1 gap-4">
                  <InfoBlock label="Sent At" value={selectedMessage.sentAt ? selectedMessage.sentAt.toLocaleString() : 'N/A'} />
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

              {/* Additional Info for Tracking Messages */}
              {selectedOriginalMessage && '_id' in selectedOriginalMessage && (
                <Section title="Tracking Information">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBlock label="Status" value={selectedOriginalMessage.status || 'N/A'} />
                    <InfoBlock label="Received By" value={selectedOriginalMessage.receivedBy || 'N/A'} />
                    {selectedOriginalMessage.receivedAt && (
                      <InfoBlock label="Received At" value={new Date(selectedOriginalMessage.receivedAt).toLocaleString()} />
                    )}
                  </div>
                </Section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

