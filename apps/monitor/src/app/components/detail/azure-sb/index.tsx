import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { VirtualizedDataTable } from '../../messages/data-table/VirtualizedDataTable';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../ui/sheet';
import { ToastAction } from '../../ui/toast';
import { toast } from 'sonner';

import {
  useDeleteServiceBusMessage,
  useGetServiceBusMessages,
  useServiceBusConfig,
} from '../../../hooks/api/service-bus';

import { AzureSbSendMessageModal } from './components/SendMessageModal';
import { createColumns } from './lib/column';
import { ServiceBusMessageRow, TrackingMessage } from './lib/entities';
import { formatBody, InfoBlock, Section } from './components/helpers';
import { Statistics } from './components/Statistics';

export const AzureSbDetail = () => {
  const {
    data: messages,
    isLoading: azureSbMessagesLoading,
    error: azureSbMessagesError,
  } = useGetServiceBusMessages();

  const [selectedMessage, setSelectedMessage] =
    useState<ServiceBusMessageRow | null>(null);
  const [selectedOriginalMessage, setSelectedOriginalMessage] =
    useState<TrackingMessage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const deleteMutation = useDeleteServiceBusMessage();
  const handleMessageSelect = React.useCallback(
    (originalMessage: TrackingMessage) => {
      setSelectedOriginalMessage(originalMessage);
      setIsModalOpen(true);
    },
    [],
  );

  const handleModalClose = React.useCallback(() => {
    setIsModalOpen(false);
    setSelectedMessage(null);
    setSelectedOriginalMessage(null);
    setIsBodyExpanded(false);
  }, []);

  const allRows = React.useMemo(() => {
    if (!messages) return [];
    const completeRows = messages.trackingMessages.complete;
    const dlqRows = messages.trackingMessages.deadletter;
    const abandonedRows = messages.trackingMessages.abandon;
    const deferredRows = messages.trackingMessages.defer;

    return [...completeRows, ...dlqRows, ...abandonedRows, ...deferredRows];
  }, [messages]);

  const handleMessageDelete = React.useCallback(
    async (messageId: string) => {
      try {
        await deleteMutation.mutateAsync(messageId);

        toast.success('Message deleted successfully', {
          description: 'The tracking message has been removed.',
        });
      } catch (error) {
        console.error('Failed to delete message:', error);

        toast.error('Failed to delete message', {
          description: 'Please try again.',
          action: (
            <ToastAction
              altText="Try again"
              onClick={() => {
                deleteMutation.mutate(messageId, {
                  onSuccess: () => {
                    toast.success('Message deleted successfully', {
                      description: 'The tracking message has been removed.',
                    });
                  },
                  onError: (error) => {
                    console.error('Failed to delete message:', error);
                    toast.error('Failed to delete message again', {
                      description: 'Please check the console for details.',
                    });
                  },
                });
              }}
            >
              Try again
            </ToastAction>
          ),
        });
      }
    },
    [deleteMutation],
  );

  const columns = React.useMemo(
    () => createColumns(handleMessageSelect, handleMessageDelete),
    [handleMessageSelect, handleMessageDelete],
  );

  const { data: config } = useServiceBusConfig();
  // Extract queues and topics from config
  const destinations = React.useMemo(() => {
    if (!config?.UserConfig?.Namespaces) return [];
    const allDestinations: string[] = [];
    config.UserConfig.Namespaces.forEach((namespace) => {
      if (namespace.Queues) {
        namespace.Queues.forEach((q) => {
          allDestinations.push(q.Name);
        });
      }
      if (namespace.Topics) {
        namespace.Topics.forEach((t) => {
          allDestinations.push(t.Name);
        });
      }
    });
    return allDestinations.sort();
  }, [config]);
  const totalMessages = messages
    ? messages.summary.trackingComplete +
      messages.summary.trackingDeadletter +
      messages.summary.trackingAbandon +
      messages.summary.trackingDefer
    : 0;

  const [sendModalOpen, setSendModalOpen] = useState(false);
  if (azureSbMessagesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (azureSbMessagesError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Error: {azureSbMessagesError.message}
        </p>
      </div>
    );
  }
  // Handle undefined data - moved after all hooks
  if (!messages) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
         {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={() => setSendModalOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Simulate Message
            </Button>
          </div>
        {/* Summary Cards */}
        <Statistics messages={messages} />

        {/* Single Combined Table */}
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
        {/* Modals */}
        <AzureSbSendMessageModal
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
          destinations={destinations}
        />
      </div>

      {/* Detail Modal */}
      <Sheet open={isModalOpen} onOpenChange={handleModalClose}>
        <SheetContent className="w-2/6 sm:max-w-4xl overflow-hidden">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-1">
                    Service Bus Message Details
                  </label>
                  <Badge variant="outline" className="text-xs">
                    Azure SB
                  </Badge>
                </div>
                {selectedMessage && (
                  <Badge
                    variant={
                      selectedMessage.disposition === 'complete'
                        ? 'default'
                        : selectedMessage.disposition === 'deadletter'
                          ? 'destructive'
                          : selectedMessage.disposition === 'abandon'
                            ? 'secondary'
                            : 'outline'
                    }
                    className="text-sm"
                  >
                    {selectedMessage.disposition.charAt(0).toUpperCase() +
                      selectedMessage.disposition.slice(1)}
                  </Badge>
                )}
              </div>
            </SheetTitle>
          </SheetHeader>

          {selectedOriginalMessage && (
            <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
              {/* Basic Information */}
              <Section title="Basic Information">
                <div className="grid grid-cols-2 gap-4">
                  <InfoBlock
                    label="Message ID"
                    value={
                      <span className="font-mono text-xs">
                        {selectedOriginalMessage.messageId}
                      </span>
                    }
                  />
                  <InfoBlock
                    label="Queue"
                    value={selectedOriginalMessage.queue || 'N/A'}
                  />
                  <InfoBlock
                    label="Status"
                    value={selectedOriginalMessage.status || 'N/A'}
                  />
                  <InfoBlock
                    label="Disposition"
                    value={selectedOriginalMessage.disposition || 'N/A'}
                  />
                </div>
              </Section>

              {/* Sender & Receiver Information */}
              <Section title="Sender & Receiver">
                <div className="grid grid-cols-2 gap-4">
                  <InfoBlock
                    label="Sent By"
                    value={selectedOriginalMessage.sentBy || 'N/A'}
                  />
                  <InfoBlock
                    label="Sent At"
                    value={
                      selectedOriginalMessage.sentAt
                        ? new Date(
                            selectedOriginalMessage.sentAt,
                          ).toLocaleString()
                        : 'N/A'
                    }
                  />
                  <InfoBlock
                    label="Received By"
                    value={selectedOriginalMessage.receivedBy || 'N/A'}
                  />
                  <InfoBlock
                    label="Received At"
                    value={
                      selectedOriginalMessage.receivedAt
                        ? new Date(
                            selectedOriginalMessage.receivedAt,
                          ).toLocaleString()
                        : 'N/A'
                    }
                  />
                </div>
              </Section>

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
                        isBodyExpanded
                          ? 'max-h-[500px] opacity-100'
                          : 'max-h-0 opacity-0'
                      }`}
                    >
                      <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                        {formatBody(selectedOriginalMessage.body)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded">
                    No body content
                  </div>
                )}
              </Section>

              {/* Emulator Type */}
              {selectedOriginalMessage.emulatorType && (
                <Section title="Additional Information">
                  <InfoBlock
                    label="Emulator Type"
                    value={selectedOriginalMessage.emulatorType}
                  />
                </Section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
