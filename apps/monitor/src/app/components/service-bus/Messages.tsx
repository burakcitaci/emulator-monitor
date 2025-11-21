import React, { useCallback, useEffect, useState } from 'react';
import { TrackingMessagesDataTable } from './TrackingMessagesDataTable';
import { useMessages } from '../../hooks/api/useMessages';
import { TrackingMessage, SendForm } from '@e2e-monitor/entities';
import { AlertCircle, Send } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { SendMessageTab } from './SendMessageTab';

import { ToastAction } from '../ui/toast';
import { toast } from 'sonner';

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


  const handleMessageDelete = async (messageId: string) => {
    try {
      // Assuming tracking messages are stored as 'received' type for deletion
      await deleteTrackingMessage(messageId);
      // Refresh messages after delete
      await loadMessages();
      toast.success("Your message has been sent.", {
          description: "Your message has been sent.",
        })
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error("Failed to delete message", {
          description: "Your message has been sent.",
        })
      toast.error("Failed to delete message", {
          description: "Failed to delete message",
          action: <ToastAction altText="Try again">Try again</ToastAction>,
        })
    }
  };

  const sendMessage = async () => {
    try {
      console.log('Sending message with form data:', sendForm);
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
        toast.success('Message sent successfully!', {
          description: 'Message sent successfully!',
          action: <ToastAction variant={"destructive"} altText="View message">View message</ToastAction>,
        });
        // Reset form
        setSendForm({
          queueName: '',
          body: '',
          properties: '',
          subject: '',
        });
      } else {
        toast(result.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error("Failed to send message", {
         
          
          description: err instanceof Error
          ? err.message
          : 'Failed to send message. Please try again.',
          action: <ToastAction altText="Try again">Try again</ToastAction>,
        })
    }
  };

  return (
    <div className="p-2">
      {/* Header */}
      <div className="space-y-6">
        <div className="flex items-center justify-start mt-4 gap-2">
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