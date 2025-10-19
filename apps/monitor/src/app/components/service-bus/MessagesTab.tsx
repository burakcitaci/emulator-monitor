import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { MessagesDataTable } from './MessagesDataTable';
import { useServiceBusConfig } from '../../hooks/useServiceBusConfig';
import { useServiceBus } from '../../hooks/useServiceBus';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Message } from '@e2e-monitor/entities';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { RefreshCcw } from 'lucide-react';

interface MessagesTabProps {
  messages: Message[];
  onMessageSelect: (message: Message) => void;
}

type PrimarySelection =
  | { kind: 'queue'; name: string }
  | { kind: 'topic'; name: string }
  | null;

interface GetMessagesParams {
  namespace: string;
  queue: string;
  topic: string;
  subscription: string;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({
  messages,
  onMessageSelect,
}) => {
  const {
    queuesAndTopics,
    getQueueNames,
    getTopicNames,
    getSubscriptionsByTopic,
    loading: configLoading,
    error: configError,
  } = useServiceBusConfig();
  const { getMessages } = useServiceBus();

  const queues = useMemo(() => getQueueNames(), [getQueueNames]);
  const topics = useMemo(() => getTopicNames(), [getTopicNames]);

  const [primary, setPrimary] = useState<PrimarySelection>(null);
  const [namespace, setNamespace] = useState<string>('');
  const [subscription, setSubscription] = useState<string>('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const resolveNamespace = useCallback(() => {
    if (!primary) return '';
    const item = queuesAndTopics.find(
      (i) => i.type === primary.kind && i.name === primary.name,
    );
    return item?.namespace ?? '';
  }, [primary, queuesAndTopics]);

  useEffect(() => {
    setNamespace(resolveNamespace());
  }, [resolveNamespace]);

  const topicSubscriptions = useMemo(() => {
    if (primary?.kind !== 'topic') return [];
    return getSubscriptionsByTopic(primary.name);
  }, [primary, getSubscriptionsByTopic]);

  useEffect(() => {
    if (primary?.kind !== 'topic') {
      setSubscription('');
      return;
    }

    const subs = topicSubscriptions;
    if (!subs?.length) {
      setSubscription('');
      return;
    }

    setSubscription(subs.includes('default') ? 'default' : subs[0]);
  }, [primary, topicSubscriptions]);

  const handlePrimaryChange = useCallback((value: string) => {
    const [kind, name] = value.split('::');

    if (kind === 'queue') {
      setPrimary({ kind: 'queue', name });
    } else if (kind === 'topic') {
      setPrimary({ kind: 'topic', name });
    } else {
      setPrimary(null);
    }

    setLocalMessages([]);
    setFetchError(null);
  }, []);

  const buildMessagesParams = useCallback((): GetMessagesParams | null => {
    if (!primary) return null;

    return {
      namespace,
      queue: primary.kind === 'queue' ? primary.name : '',
      topic: primary.kind === 'topic' ? primary.name : '',
      subscription: primary.kind === 'topic' ? subscription : '',
    };
  }, [primary, namespace, subscription]);

  const loadMessages = useCallback(async () => {
    if (!primary) return;
    if (primary && !namespace) return;
    if (primary.kind === 'topic' && !subscription) return;

    console.log('Loading messages for:', { primary, namespace, subscription });
    setIsFetching(true);

    try {
      const params = buildMessagesParams();
      if (!params) return;
      console.log('Making API call with params:', params);

      const res = await getMessages(params);
      console.log('API response:', res);

      setLocalMessages(res.messages || []);
      setHasLoaded(true);
      setFetchError(null);

      console.log('Messages loaded successfully');
    } catch (error) {
      console.error('Failed to load messages:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load messages';
      setFetchError(errorMessage);
      setLocalMessages([]);
    } finally {
      setIsFetching(false);
    }
  }, [primary, namespace, subscription, getMessages, buildMessagesParams]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const canLoad = useMemo(() => {
    if (!primary) return true;
    if (!namespace) return false;
    if (primary.kind === 'topic' && !subscription) return false;
    return true;
  }, [primary, namespace, subscription]);

  const displayedMessages = hasLoaded ? localMessages : messages;
  const messageCount = displayedMessages?.length || 0;
  const isTopicSelected = primary?.kind === 'topic';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Service Bus Messages</h2>
        <p className="text-muted-foreground">
          Monitor and inspect messages flowing through your Service Bus
          emulator.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between p-6 bg-card border rounded-lg">
        <div className="space-y-3">
          <Label className="text-base font-medium">Select Queue or Topic</Label>

          <div className="flex items-center gap-3">
            <Select
              value={primary ? `${primary.kind}::${primary.name}` : ''}
              onValueChange={handlePrimaryChange}
              disabled={configLoading}
            >
              <SelectTrigger
                className="w-[340px] rounded-sm"
                disabled={configLoading}
              >
                <SelectValue placeholder="Select queue or topic..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Queues
                </div>
                {queues.map((q) => (
                  <SelectItem key={`queue::${q}`} value={`queue::${q}`}>
                    <div className="flex items-center space-x-2">
                      <span aria-hidden="true">📦</span>
                      <span>{q}</span>
                    </div>
                  </SelectItem>
                ))}

                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                  Topics
                </div>
                {topics.map((t) => (
                  <SelectItem key={`topic::${t}`} value={`topic::${t}`}>
                    <div className="flex items-center space-x-2">
                      <span aria-hidden="true">📡</span>
                      <span>{t}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subscription selector only for topics */}
            {isTopicSelected && (
              <>
                <Label className="text-sm text-muted-foreground">
                  Subscription
                </Label>
                <Select
                  value={subscription}
                  onValueChange={setSubscription}
                  disabled={configLoading || topicSubscriptions.length === 0}
                >
                  <SelectTrigger
                    className="w-[240px] rounded-sm"
                    disabled={configLoading || topicSubscriptions.length === 0}
                  >
                    <SelectValue placeholder="Select subscription..." />
                  </SelectTrigger>
                  <SelectContent>
                    {topicSubscriptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No subscriptions
                      </div>
                    ) : (
                      topicSubscriptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              disabled={!canLoad || isFetching}
              onClick={loadMessages}
              className="rounded-sm"
            >
              <RefreshCcw
                className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
              />
              Load Messages
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-accent/30 px-4 py-3 rounded-sm border border-border/50">
          <span className="text-sm font-medium">
            <Badge variant="outline" className="mr-2 rounded-sm">
              {messageCount}
            </Badge>
            messages
          </span>
        </div>
      </div>

      {/* Error Messages */}
      {configError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
          <p className="text-sm text-destructive">{String(configError)}</p>
        </div>
      )}

      {fetchError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
          <p className="text-sm text-destructive">{fetchError}</p>
        </div>
      )}

      {/* Table */}
      <div className="w-full">
        <MessagesDataTable
          messages={displayedMessages}
          onMessageSelect={onMessageSelect}
          onMessageReplay={(messageId: string) =>
            console.log('Replay message', messageId)
          }
          onMessageDelete={(messageId: string) =>
            console.log('Delete message', messageId)
          }
        />
      </div>
    </div>
  );
};
