import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import { MessagesDataTable } from './MessagesDataTable';
import { useServiceBusConfig } from '../../hooks/api/useServiceBusConfig';
import { useServiceBus } from '../../hooks/api/useServiceBus';
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
  onMessagesUpdate: (messages: Message[]) => void;
}

type PrimarySelection =
  | { kind: 'queue'; name: string }
  | { kind: 'topic'; name: string }
  | null;

interface GetMessagesParams {
  namespace: string;
  queue?: string;
  topic?: string;
  subscription?: string;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({
  messages,
  onMessageSelect,
  onMessagesUpdate,
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
  const [queuesAndTopicsVersion, setQueuesAndTopicsVersion] = useState(0);

  // Use ref to store current queuesAndTopics value for loadMessages
  const queuesAndTopicsRef = useRef(queuesAndTopics);
  queuesAndTopicsRef.current = queuesAndTopics;

  // Update version when queuesAndTopics changes
  useEffect(() => {
    setQueuesAndTopicsVersion((v) => v + 1);
  }, [queuesAndTopics]);

  const resolveNamespace = useCallback(() => {
    const currentQueuesAndTopics = queuesAndTopicsRef.current;

    if (!primary) {
      // For no selection, use the first available namespace
      const defaultNamespace =
        currentQueuesAndTopics.length > 0
          ? currentQueuesAndTopics[0]?.namespace
          : '';
      console.log('Resolving default namespace:', {
        defaultNamespace,
        queuesAndTopicsLength: currentQueuesAndTopics.length,
      });
      return defaultNamespace;
    }

    const item = currentQueuesAndTopics.find(
      (i) => i.type === primary.kind && i.name === primary.name,
    );
    const namespace = item?.namespace ?? '';
    console.log('Resolving namespace for:', {
      primary,
      item,
      namespace,
      queuesAndTopicsLength: currentQueuesAndTopics.length,
    });
    return namespace;
  }, [primary, queuesAndTopicsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const newNamespace = resolveNamespace();
    console.log('Setting namespace:', newNamespace, 'current:', namespace);
    if (newNamespace !== namespace) {
      setNamespace(newNamespace);
    }
  }, [resolveNamespace, namespace]);

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
    if (value === 'all' || value === '') {
      setPrimary(null);
    } else {
      const [kind, name] = value.split('::');

      if (kind === 'queue') {
        setPrimary({ kind: 'queue', name });
      } else if (kind === 'topic') {
        setPrimary({ kind: 'topic', name });
      } else {
        setPrimary(null);
      }
    }

    // Reset loading state when selection changes
    setLocalMessages([]);
    setHasLoaded(false);
    setFetchError(null);
  }, []);

  const buildMessagesParams = useCallback((): GetMessagesParams | null => {
    // If no primary selection, use default namespace to fetch all messages
    if (!primary) {
      const currentQueuesAndTopics = queuesAndTopicsRef.current;
      const defaultNamespace =
        namespace ||
        (currentQueuesAndTopics.length > 0
          ? currentQueuesAndTopics[0]?.namespace
          : '');
      if (!defaultNamespace) return null;

      return {
        namespace: defaultNamespace,
        queue: undefined,
        topic: undefined,
        subscription: undefined,
      };
    }

    return {
      namespace,
      queue: primary.kind === 'queue' ? primary.name : undefined,
      topic: primary.kind === 'topic' ? primary.name : undefined,
      subscription: primary.kind === 'topic' ? subscription : undefined,
    };
  }, [primary, namespace, subscription]);

  const loadMessages = useCallback(async () => {
    console.log('loadMessages called with:', {
      primary,
      namespace,
      subscription,
    });

    // For topics, we need namespace and subscription
    if (primary?.kind === 'topic') {
      if (!namespace || !subscription) {
        console.log('Missing required parameters for topic:', {
          namespace,
          subscription,
        });
        return;
      }
    } else if (primary?.kind === 'queue') {
      // For queues, we only need namespace
      if (!namespace) {
        console.log('Missing namespace for queue');
        return;
      }
    } else if (!primary) {
      // For no selection, we need at least a default namespace
      const currentQueuesAndTopics = queuesAndTopicsRef.current;
      const defaultNamespace =
        namespace ||
        (currentQueuesAndTopics.length > 0
          ? currentQueuesAndTopics[0]?.namespace
          : '');
      if (!defaultNamespace) {
        console.log('No namespace available for loading all messages');
        return;
      }
    }

    console.log('Loading messages for:', { primary, namespace, subscription });
    setIsFetching(true);

    try {
      const params = buildMessagesParams();
      if (!params) {
        console.log('Failed to build message params');
        return;
      }

      console.log('Making API call with params:', params);
      const res = await getMessages(params);
      console.log('API response:', res);

      const loadedMessages = res.messages || [];
      setLocalMessages(loadedMessages);
      setHasLoaded(true);
      setFetchError(null);

      // Update parent component with loaded messages
      onMessagesUpdate(loadedMessages);

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
  }, [
    primary,
    namespace,
    subscription,
    getMessages,
    buildMessagesParams,
    onMessagesUpdate,
  ]);

  const canLoad = useMemo(() => {
    // If no primary selection, we need at least a namespace
    if (!primary) {
      const currentQueuesAndTopics = queuesAndTopicsRef.current;
      const defaultNamespace =
        namespace ||
        (currentQueuesAndTopics.length > 0
          ? currentQueuesAndTopics[0]?.namespace
          : '');
      return !!defaultNamespace;
    }

    if (!namespace) return false; // We need namespace for both queues and topics
    if (primary.kind === 'topic' && !subscription) return false; // Topics need subscription
    return true;
  }, [primary, namespace, subscription]);

  // Load messages when parameters become available
  useEffect(() => {
    // Prevent infinite loops by checking if already fetching
    if (isFetching) return;

    console.log('Auto-load effect triggered:', {
      primary,
      namespace,
      subscription,
      hasLoaded,
      canLoad: canLoad,
    });

    if (canLoad && !hasLoaded) {
      console.log('Loading messages for:', {
        primary,
        namespace,
        subscription,
      });
      void loadMessages();
    } else if (primary && !namespace && queuesAndTopicsRef.current.length > 0) {
      // If we have primary but no namespace yet, try to resolve namespace
      console.log(
        'Primary set but namespace not resolved yet, trying again...',
      );
      const newNamespace = resolveNamespace();
      if (newNamespace) {
        console.log('Namespace resolved:', newNamespace);
        setNamespace(newNamespace);
      }
    }
  }, [
    primary,
    namespace,
    subscription,
    hasLoaded,
    loadMessages,
    resolveNamespace,
    isFetching,
    canLoad,
  ]);

  // Auto-refresh messages every 30 seconds
  useEffect(() => {
    // Only start auto-refresh if we have successfully loaded messages and can load
    if (!hasLoaded || !canLoad) return;

    const intervalId = setInterval(() => {
      console.log('Auto-refreshing messages...');
      void loadMessages();
    }, 30000); // 30 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [hasLoaded, canLoad, loadMessages]);

  const displayedMessages = hasLoaded ? localMessages : messages;
  const messageCount = displayedMessages?.length || 0;
  const isTopicSelected = primary?.kind === 'topic';

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Service Bus Messages</h2>
        <p className="text-muted-foreground">
          Monitor and inspect messages flowing through your Service Bus
          emulator.
        </p>
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 min-w-0">
          {/* Queue/Topic Selector */}
          <Select
            value={primary ? `${primary.kind}::${primary.name}` : 'all'}
            onValueChange={handlePrimaryChange}
            disabled={configLoading}
          >
            <SelectTrigger
              className="h-10 w-full sm:w-[220px] md:w-[280px] rounded-sm"
              disabled={configLoading}
            >
              <SelectValue placeholder="Select queue or topic (optional)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center space-x-2">
                  <span aria-hidden="true">🔄</span>
                  <span>Show All Messages</span>
                </div>
              </SelectItem>

              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
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
          {/* Load Button */}
          <Button
            size="sm"
            variant="outline"
            disabled={!canLoad || isFetching}
            onClick={loadMessages}
            className="h-10 rounded-sm whitespace-nowrap"
          >
            <RefreshCcw
              className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
            />
            {primary ? 'Load Messages' : 'Load All Messages'}
          </Button>
          {/* Subscription selector only for topics */}
          {isTopicSelected && (
            <Select
              value={subscription}
              onValueChange={setSubscription}
              disabled={configLoading || topicSubscriptions.length === 0}
            >
              <SelectTrigger
                className="h-10 w-full sm:w-[180px] rounded-sm"
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
          )}
        </div>

        {/* Message Counter */}
        <div className="flex items-center justify-center bg-accent/30 px-4 py-2 rounded-sm border border-border/50 shrink-0">
          <Badge variant="outline" className="mr-2 rounded-sm">
            {messageCount}
          </Badge>
          <span className="text-sm font-medium">messages</span>
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
      <div className="w-full min-w-0">
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
