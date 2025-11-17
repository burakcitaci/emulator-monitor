import React, { useCallback, useEffect, useState } from 'react';
import { TrackingMessagesDataTable } from './TrackingMessagesDataTable';
import { useMessages } from '../../hooks/api/useMessages';
import { TrackingMessage, SendForm } from '@e2e-monitor/entities';
import { AlertCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { SendMessageTab } from './SendMessageTab';

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
  const { fetchTrackingMessages, deleteTrackingMessage } = useMessages();
  const [messages, setMessages] = useState<TrackingMessage[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendForm, setSendForm] = useState<SendForm>({
    queueName: '',
    body: '',
    properties: '',
    subject: '',
  });

  const loadMessages = useCallback(async () => {
    setIsFetching(true);
    try {
      const loadedMessages = await fetchTrackingMessages();
      setMessages(loadedMessages);
      setFetchError(null);
      console.log('Tracking messages loaded successfully');
    } catch (error) {
      console.error('Failed to load tracking messages:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load tracking messages';
      setFetchError(errorMessage);
      setMessages([]);
    } finally {
      setHasLoaded(true);
      setIsFetching(false);
    }
  }, [fetchTrackingMessages]);

  // Load messages on mount
  useEffect(() => {
    if (!hasLoaded && !isFetching) {
      void loadMessages();
    }
  }, [hasLoaded, loadMessages, isFetching]);

  // Auto-refresh messages every 30 seconds
/*   useEffect(() => {
    if (!hasLoaded || fetchError) return;

    const intervalId = setInterval(async () => {
      try {
        await loadMessages();
      } catch {
        // Error already handled in loadMessages
      }
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [hasLoaded, loadMessages, fetchError]); */

  const handleMessageDelete = async (messageId: string) => {
    try {
      // Assuming tracking messages are stored as 'received' type for deletion
      await deleteTrackingMessage(messageId);
      // Refresh messages after delete
      await loadMessages();
      toast.success('Message deleted successfully');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  const sendMessage = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/servicebus/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namespace: 'sbemulatorns',
          topic: sendForm.queueName,
          message: {
            body: JSON.parse(sendForm.body),
            subject: sendForm.subject,
            applicationProperties: sendForm.properties ? JSON.parse(sendForm.properties) : {},
            sentBy: 'test-user',
            sentAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success('Message sent successfully!');
        // Reset form
        setSendForm({
          queueName: '',
          body: '',
          properties: '',
          subject: '',
        });
      } else {
        toast.error(result.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.',
        { duration: 5000 }
      );
    }
  };

  return (
    <div className="p-2">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Send Test Message</DialogTitle>
              </DialogHeader>
              <SendMessageTab
                form={sendForm}
                onFormChange={setSendForm}
                onSend={() => {
                  sendMessage();
                  setIsSendDialogOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 w-full">
        {/* Error Messages */}
        {fetchError && (
          <ErrorMessage
            icon={
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            }
            title="Failed to Load Tracking Messages"
            message={
              fetchError.includes('Failed to fetch')
                ? 'Backend server is not running on port 3000. Please ensure it is running.'
                : fetchError
            }
          />
        )}

        {/* Table */}
        <div className="w-full min-w-0">
          <TrackingMessagesDataTable
            messages={messages}
            onMessageDelete={handleMessageDelete}
          />
        </div>
      </div>
    </div>
    </div>
  );
};