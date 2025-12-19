import React from 'react';
import { TrackingMessagesDataTable } from './TrackingMessagesDataTable';
import { useTrackingMessages, useDeleteTrackingMessage } from '../../hooks/api';
import { AlertCircle } from 'lucide-react';
import { ToastAction } from '../ui/toast';
import { toast } from 'sonner';
import { LoadingSpinner } from '../ui/loading-spinner';

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
    <div className="p-2 h-full flex flex-col">
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

          {/* Table */}
          <div className="w-full min-w-0 flex-1 min-h-0">
            <TrackingMessagesDataTable
              messages={messages}
              onMessageDelete={handleMessageDelete}
              isDeleting={deleteMutation.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
};