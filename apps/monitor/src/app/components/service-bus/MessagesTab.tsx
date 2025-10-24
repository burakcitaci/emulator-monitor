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
import { AlertCircle } from 'lucide-react';
import { Sparkles, Loader2 } from 'lucide-react';
import { StatusIndicator } from '../common/StatusIndicator';
import toast from 'react-hot-toast';

interface MessagesTabProps {
  messages: Message[];
  onMessagesUpdate: (messages: Message[]) => void;
  dlqMessages: any[];
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

function PrimarySelector({
  primary,
  queues,
  topics,
  handlePrimaryChange,
  configLoading,
  isTopicSelected,
  subscription,
  setSubscription,
  topicSubscriptions,
}: {
  primary: PrimarySelection;
  queues: string[];
  topics: string[];
  handlePrimaryChange: (value: string) => void;
  configLoading: boolean;
  isTopicSelected: boolean;
  subscription: string;
  setSubscription: (v: string) => void;
  topicSubscriptions: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">
        Filter Messages
      </label>
      <div className="flex flex-col gap-2">
        <Select
          value={primary ? `${primary.kind}::${primary.name}` : 'all'}
          onValueChange={handlePrimaryChange}
          disabled={configLoading}
        >
          <SelectTrigger
            className="h-10 w-full rounded-sm"
            disabled={configLoading}
          >
            <SelectValue placeholder="Show all messages..." />
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

        {isTopicSelected && (
          <Select
            value={subscription}
            onValueChange={setSubscription}
            disabled={configLoading || topicSubscriptions.length === 0}
          >
            <SelectTrigger
              className="h-10 w-full rounded-sm"
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
    </div>
  );
}

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

export const MessagesTab: React.FC<MessagesTabProps> = ({
  messages,
  onMessagesUpdate,
  dlqMessages,
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
  const [backendStatus, setBackendStatus] = useState<
    'checking' | 'running' | 'offline'
  >('checking');
  const [emulatorStatus, setEmulatorStatus] = useState<
    'checking' | 'connected' | 'offline'
  >('checking');
  const [serviceBusInitialized, setServiceBusInitialized] = useState<
    boolean | null
  >(null);
  const [isInitializingServiceBus, setIsInitializingServiceBus] = useState(false);

  // Use ref to store current queuesAndTopics value for loadMessages
  const queuesAndTopicsRef = useRef(queuesAndTopics);
  queuesAndTopicsRef.current = queuesAndTopics;

  // Update version when queuesAndTopics changes
  useEffect(() => {
    setQueuesAndTopicsVersion((v) => v + 1);
  }, [queuesAndTopics]);

  // Status check effect
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const backendResponse = await fetch(
          'http://localhost:3000/api/v1/health',
          {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          },
        );
        setBackendStatus(backendResponse.ok ? 'running' : 'offline');
      } catch {
        setBackendStatus('offline');
      }

      try {
        const emulatorResponse = await fetch(
          'http://localhost:3000/api/v1/servicebus/health',
          {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          },
        );
        setEmulatorStatus(emulatorResponse.ok ? 'connected' : 'offline');
      } catch {
        setEmulatorStatus('offline');
      }

      try {
        const statusResponse = await fetch(
          'http://localhost:3000/api/v1/servicebus/status',
          {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          },
        );
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setServiceBusInitialized(statusData.initialized || false);
        } else {
          setServiceBusInitialized(false);
        }
      } catch {
        setServiceBusInitialized(null);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

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
    // Prevent infinite loops by checking if already fetching or if there is an error
    if (isFetching || fetchError || configError) return;

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
    fetchError,
    configError,
  ]);

  // Auto-refresh messages every 30 seconds
  useEffect(() => {
    // Only start auto-refresh if we have successfully loaded messages and can load, and no error
    if (!hasLoaded || !canLoad || fetchError || configError) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      // If error occurs, stop auto-refresh immediately
      if (fetchError || configError || cancelled) {
        clearInterval(intervalId);
        return;
      }
      try {
        await loadMessages();
      } catch {
        clearInterval(intervalId);
      }
    }, 30000); // 30 seconds

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [hasLoaded, canLoad, loadMessages, fetchError, configError]);

  const handleInitializeServiceBus = async () => {
    setIsInitializingServiceBus(true);
    try {
      const response = await fetch('http://localhost:3000/api/v1/servicebus/debug-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Service Bus initialized successfully!');
        // Refresh the page or reload the configuration
        window.location.reload();
      } else {
        toast.error(result.message || 'Failed to initialize Service Bus');
      }
    } catch (err) {
      console.error('Service Bus initialization failed:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to initialize Service Bus. Please check the backend logs.',
        { duration: 5000 }
      );
    } finally {
      setIsInitializingServiceBus(false);
    }
  };

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
      <div className="flex items-center justify-start gap-2 bg-accent/30 px-4 py-2 rounded-sm border border-border/50 min-h-[60px]">
        <StatusIndicator
          label="Messages"
          status="success"
          count={messageCount}
          animate={true}
        />
        <StatusIndicator
          label={`Backend: ${backendStatus === 'running' ? 'Running' : 'Offline'}`}
          status={
            backendStatus === 'running'
              ? 'success'
              : backendStatus === 'offline'
                ? 'error'
                : 'warning'
          }
          animate={backendStatus === 'checking'}
          showCount={false}
        />

        <StatusIndicator
          label={`Service Bus: ${serviceBusInitialized ? 'Initialized' : 'Not Initialized'}`}
          status={
            serviceBusInitialized === null
              ? 'warning'
              : serviceBusInitialized
                ? 'success'
                : 'error'
          }
          animate={serviceBusInitialized === null}
          showCount={false}
        />
        {!serviceBusInitialized && (
          <Button
            onClick={handleInitializeServiceBus}
            disabled={isInitializingServiceBus}
            size="sm"
            variant="outline"
            className="ml-2"
          >
            {isInitializingServiceBus ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Initialize Service Bus
              </>
            )}
          </Button>
        )}
      </div>
      {/* Filters */}
      <div className="flex flex-col gap-4 w-full">
      
        {/* Error Messages */}
        {configError && (
          <ErrorMessage
            icon={
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            }
            title="Failed to Load Service Bus Configuration"
            message={
              String(configError).includes('Failed to fetch')
                ? 'Backend server is not running on port 3000 or Service Bus Emulator is offline. Please ensure both are running.'
                : String(configError)
            }
          />
        )}
        {fetchError && (
          <ErrorMessage
            icon={
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            }
            title="Failed to Load Messages"
            message={
              fetchError.includes('Failed to fetch')
                ? 'Backend server is not running on port 3000 or Service Bus Emulator is offline. Please ensure both are running.'
                : fetchError.includes('timeout')
                  ? 'Request timed out. The backend or emulator may be unresponsive.'
                  : fetchError
            }
          />
        )}
        {/* Table */}
        <div className="w-full min-w-0">
          <MessagesDataTable
            messages={displayedMessages}
            onMessageReplay={(messageId: string) =>
              console.log('Replay message', messageId)
            }
            onMessageDelete={(messageId: string) =>
              console.log('Delete message', messageId)
            }
            queueOptions={queuesAndTopics
              .filter(item => item.type === 'queue' || item.type === 'topic')
              .map(item => ({
                label: item.name,
                value: item.name,
                icon: item.type === 'queue' ? () => <span>📦</span> : () => <span>📡</span>,
              }))}
          />
        </div>
      </div>
    </div>
  );
};
