import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { DLQDataTable } from './DLQDataTable';
import { Badge } from '../ui/badge';
import {
  DeadLetterMessage,
  DeadLetterMessageResponse,
  useServiceBus,
} from '../../hooks/useServiceBus';
import { Button } from '../ui/button';
import EntitySelector, { EntitySelection } from './EntitySelector';

interface DeadLetterQueueTabProps {
  onReplay: (messageId: string) => void;
  onView: (message: DeadLetterMessage) => void;
}

export const DeadLetterQueueTab: React.FC<DeadLetterQueueTabProps> = ({
  onReplay,
  onView,
}) => {
  const { getDeadLetterMessages } = useServiceBus();
  const [selection, setSelection] = useState<EntitySelection | null>(null);

  const [messages, setMessages] = useState<DeadLetterMessageResponse>();
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    if (!selection || selection.kind !== 'topic' || !selection.subscription)
      return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const res = await getDeadLetterMessages({
        namespace: selection.namespace,
        topic: selection.name,
        subscription: selection.subscription,
        maxMessages: 50,
        maxWaitTimeInSeconds: 10,
      });
      setMessages(res);
    } catch (e) {
      setFetchError(
        e instanceof Error ? e.message : 'Failed to load DLQ messages'
      );
      setMessages({
        success: false,
        messageCount: 0,
        messages: [],
        entityPath: '',
      });
    } finally {
      setIsFetching(false);
    }
  }, [selection, getDeadLetterMessages]);

  // Auto-load when selection is sufficient
  useEffect(() => {
    if (selection && selection.kind === 'topic' && selection.subscription) {
      void handleLoad();
    }
  }, [selection, handleLoad]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Dead Letter Queue</h2>
          <p className="text-muted-foreground">
            Monitor and manage messages that failed processing in your Service
            Bus emulator.
          </p>
        </div>

        <div className="flex items-center justify-between p-6 bg-card border rounded-sm">
          <div className="space-y-3">
            <EntitySelector
              value={selection}
              onChange={setSelection}
              includeQueues={true}
              includeTopics={true}
              requireSubscriptionForTopic={true}
              autoSelectPreferredSubscription={true}
              label="Select Queue or Topic/Subscription"
            />
            <div>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !selection ||
                  selection.kind === 'queue' ||
                  (selection.kind === 'topic' && !selection.subscription) ||
                  isFetching
                }
                onClick={handleLoad}
                className="rounded-sm"
              >
                Load DLQ
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-3 bg-destructive/10 px-4 py-3 rounded-sm border border-destructive/20">
            <Trash2 className="w-5 h-5 text-destructive" />
            <span className="text-sm font-medium">
              <Badge variant="destructive" className="mr-2 rounded-sm">
                {messages?.messages?.length || 0}
              </Badge>
              messages in DLQ
            </span>
          </div>
        </div>
      </div>
      {fetchError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
          <p className="text-sm text-destructive">{fetchError}</p>
        </div>
      )}

      {/* Data Table - Full width */}
      <div className="w-full">
        <DLQDataTable
          messages={messages || ({} as DeadLetterMessageResponse)}
          onReplay={onReplay}
          onView={onView}
        />
      </div>
    </div>
  );
};
