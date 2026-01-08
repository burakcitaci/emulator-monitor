import React from 'react';
import { useTrackingMessages } from '../../hooks/api';
import { AlertCircle } from 'lucide-react';
import { TrackingMessage } from '@e2e-monitor/entities';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { MessagesTable } from './components/MessagesTable';
import { ErrorMessage } from './components/ErrorMessage';
import { StatisticsCards } from './components/StatisticsCards';

export const MessagesPage = () => {
  const { data: messages = [], isLoading, error } = useTrackingMessages();

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

    // Emulator statistics
    const sqs = messages.filter((m) => m.emulatorType === 'sqs').length;
    const azureServiceBus = messages.filter(
      (m) => m.emulatorType === 'azure-service-bus',
    ).length;
    return { total, sqs, azureServiceBus };
  }, [messages]);

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
                : (error as Error)?.message ||
                  'Failed to load tracking messages'
            }
          />
        )}

        {/* Statistics Cards */}
        <StatisticsCards stats={stats} />

        {/* Table */}
        <div className="w-full min-w-0 flex-1 min-h-0">
          <MessagesTable messages={transformedMessages} />
        </div>
      </div>
    </div>
  );
};
