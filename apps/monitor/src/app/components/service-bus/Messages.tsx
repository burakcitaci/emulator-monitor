import React, { useState } from 'react';
import { TrackingMessagesDataTable } from './TrackingMessagesDataTable';
import { useTrackingMessages, useDeleteTrackingMessage } from '../../hooks/api';
import { AlertCircle, Send } from 'lucide-react';
import { TrackingMessage } from '@e2e-monitor/entities';
import { ToastAction } from '../ui/toast';
import { toast } from 'sonner';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { useServiceBusConfig } from '../../hooks/api/service-bus';
import { SendMessageModal } from './SendMessageModal';
import { useNavigate } from 'react-router';

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

  const navigate = useNavigate();
  const deleteMutation = useDeleteTrackingMessage();
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const { data: config } = useServiceBusConfig();

  // Transform messages to convert null to undefined for receivedAt, receivedBy, queue, disposition, and emulatorType
  const transformedMessages: TrackingMessage[] = React.useMemo(() => {
    return messages.map((message) => ({
      ...message,
      receivedAt: message.receivedAt ?? undefined,
      receivedBy: message.receivedBy ?? undefined,
      queue: message.queue ?? undefined,
      disposition: message.disposition ?? undefined,
      emulatorType: message.emulatorType ?? undefined,
    }));
  }, [messages]);

  // Calculate statistics by disposition and emulator
  const stats = React.useMemo(() => {
    const total = messages.length;
    const complete = messages.filter((m) => m.disposition === 'complete').length;
    const abandon = messages.filter((m) => m.disposition === 'abandon').length;
    const deadletter = messages.filter((m) => m.disposition === 'deadletter').length;
    const defer = messages.filter((m) => m.disposition === 'defer').length;

    // Emulator statistics
    const sqs = messages.filter((m) => m.emulatorType === 'sqs').length;
    const azureServiceBus = messages.filter((m) => m.emulatorType === 'azure-service-bus').length;
    return { total, complete, abandon, deadletter, defer, sqs, azureServiceBus };
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
    <div className="p-6 min-w-0">
      <div className="flex flex-col gap-4 w-full flex-1 min-h-0 min-w-0">
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
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Messages</div>
                <div className="text-xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
             <Card onClick={() => navigate('/sqs')}>
              <CardContent className="p-4 cursor-pointer hover:bg-accent transition-colors">
                <div className="text-xs text-muted-foreground mb-1">SQS</div>
                <div className="text-xl font-bold">{stats.sqs}</div>
              </CardContent>
            </Card>
            <Card onClick={() => navigate('/azure-service-bus')}>
              <CardContent className="p-4 cursor-pointer hover:bg-accent transition-colors">
                <div className="text-xs text-muted-foreground mb-1">Azure SB</div>
                <div className="text-xl font-bold">{stats.azureServiceBus}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Complete</div>
                <div className="text-xl font-bold">{stats.complete}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Abandon</div>
                <div className="text-xl font-bold">{stats.abandon}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Dead Letter</div>
                <div className="text-xl font-bold">{stats.deadletter}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Defer</div>
                <div className="text-xl font-bold">{stats.defer}</div>
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

      {/* Modals */}
      <SendMessageModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        destinations={destinations}
      />
    </div>
  );
};