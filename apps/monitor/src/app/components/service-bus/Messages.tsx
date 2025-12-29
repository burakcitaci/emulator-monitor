import React, { useState } from 'react';
import { TrackingMessagesDataTable } from './TrackingMessagesDataTable';
import { useTrackingMessages, useDeleteTrackingMessage } from '../../hooks/api';
import { AlertCircle, Send, Download } from 'lucide-react';
import { ToastAction } from '../ui/toast';
import { toast } from 'sonner';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useServiceBusConfig } from '../../hooks/api/service-bus';
import { SendMessageModal } from './SendMessageModal';

function ErrorMessage({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <p className="text-sm font-semibold text-destructive mb-1">{title}</p>
          <p className="text-xs text-destructive/80">{message}</p>
        </div>
      </div>
    </div>
  );
}

export const Messages: React.FC = () => {
  const {
    data: messages = [],
    isLoading,
    error,
  } = useTrackingMessages();

  const deleteMutation = useDeleteTrackingMessage();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);

  const { data: config } = useServiceBusConfig();

  // Transform messages to convert null to undefined for receivedAt, receivedBy, and queue
  const transformedMessages = React.useMemo(() => {
    return messages.map((message) => ({
      ...message,
      receivedAt: message.receivedAt ?? undefined,
      receivedBy: message.receivedBy ?? undefined,
      queue: message.queue ?? undefined,
    }));
  }, [messages]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = messages.length;
    const sent = messages.filter((m) => m.status === 'sent').length;
    const received = messages.filter((m) => m.status === 'received').length;
    const uniqueSenders = new Set(messages.map((m) => m.sentBy)).size;

    return { total, sent, received, uniqueSenders };
  }, [messages]);

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


  const handleMessageDelete = async (messageId: string) => {
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
            onClick={() => handleMessageDelete(messageId)}
          >
            Try again
          </ToastAction>
        ),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="space-y-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-4 w-full flex-1 min-h-0">
          {/* Error Messages */}
          {error && (
            <ErrorMessage
              icon={
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              }
              title="Failed to Load Tracking Messages"
              message={
                (error as Error)?.message?.includes('Failed to fetch')
                  ? 'Backend server is not running on port 3000. Please ensure it is running.'
                  : (error as Error)?.message || 'Failed to load tracking messages'
              }
            />
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={() => setSendModalOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Simulate Message
            </Button>
            <Button variant="outline" onClick={() => setReceiveModalOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Receive Message
            </Button>
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.sent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Received</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.received}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Senders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.uniqueSenders}</div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div className="w-full min-w-0 flex-1 min-h-0">
            <TrackingMessagesDataTable
              messages={transformedMessages}
              onMessageDelete={handleMessageDelete}
              isDeleting={deleteMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <SendMessageModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        destinations={destinations}
      />
    </div>
  );
};