import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import { MessagesDataTable } from './MessagesDataTable';
import { SendMessageTab } from './SendMessageTab';
import { Configuration } from '../Configuration';
import { useServiceBusConfig } from '../../hooks/api/useServiceBusConfig';
import { useMessages } from '../../hooks/api/useMessages';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Message,
  SendForm,
  ConnectionInfo,
  ConnectionForm,
} from '@e2e-monitor/entities';
import { Button } from '../ui/button';
import { Send, Settings } from 'lucide-react';
import { AlertCircle } from 'lucide-react';

import { StatusIndicator } from '../common/StatusIndicator';
import toast from 'react-hot-toast';

interface MessagesTabProps {
  messages: Message[];
  onMessagesUpdate: (messages: Message[]) => void;
  dlqMessages: Message[];
  sendForm: SendForm;
  onSendFormChange: (form: SendForm) => void;
  onSendMessage: () => void;
  connectionInfo: ConnectionInfo;
  connectionForm: ConnectionForm;
  onConnectionFormChange: (form: ConnectionForm) => void;
  onUpdateConnection: () => void;
  onTestConnection: () => Promise<void>;
  onResetConnection: () => void;
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
  sendForm,
  onSendFormChange,
  onSendMessage,
  connectionInfo,
  connectionForm,
  onConnectionFormChange,
  onUpdateConnection,
  onTestConnection,
  onResetConnection,
}) => {
  const { queuesAndTopics, error: configError } = useServiceBusConfig();
  const { deleteMessage, fetchMessages } = useMessages();

  const [primary] = useState<PrimarySelection>(null);
  const [namespace] = useState<string>('');
  const [subscription] = useState<string>('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const backendStatus = 'running';
  const [serviceBusInitialized, setServiceBusInitialized] = useState<boolean | null>(null);
  const [isInitializingServiceBus, setIsInitializingServiceBus] = useState(false);

  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // Use ref to store current queuesAndTopics value for loadMessages
  const queuesAndTopicsRef = useRef(queuesAndTopics);
  queuesAndTopicsRef.current = queuesAndTopics;

  // Status check effect
  React.useEffect(() => {
    const checkStatus = async () => {
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
  }, [namespace, primary, subscription]);

  const loadMessages = useCallback(async () => {
    setIsFetching(true);

    try {
      const params = buildMessagesParams();
      if (!params) {
        console.log('Failed to build message params');
        return;
      }

      const res = await fetchMessages('received', params);
      const loadedMessages = res || [];
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
  }, [fetchMessages, buildMessagesParams, onMessagesUpdate]);

  const canLoad = useMemo(() => {
    // If no primary selection, we need at least a namespace
    if (!primary) {
      const defaultNamespace =
        namespace ||
        (queuesAndTopics.length > 0 ? queuesAndTopics[0]?.namespace : '');
      return !!defaultNamespace;
    }

    if (!namespace) return false; // We need namespace for both queues and topics
    if (primary.kind === 'topic' && !subscription) return false; // Topics need subscription
    return true;
  }, [primary, namespace, subscription, queuesAndTopics]);

  // Load messages when parameters become available
  useEffect(() => {
    // Prevent infinite loops by checking if already fetching or if there is an error
    if (isFetching || fetchError || configError) return;

    if (canLoad && !hasLoaded) {
      void loadMessages();
    }
  }, [hasLoaded, loadMessages, isFetching, canLoad, fetchError, configError]);

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

  const displayedMessages = localMessages;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center justify-start gap-2 bg-accent/30 px-4 py-2 rounded-sm border border-border/50">
              <StatusIndicator
                label={`Backend: ${backendStatus === 'running' ? 'Running' : 'Offline'}`}
                status={
                  backendStatus === 'running'
                    ? 'success'
                    : backendStatus === 'offline'
                      ? 'error'
                      : 'warning'
                }
                animate={false}
                showCount={false}
              />

              <StatusIndicator
                label={`Service Bus: ${serviceBusInitialized === null ? 'Checking...' : serviceBusInitialized ? 'Initialized' : 'Not Initialized'}`}
                status={
                  serviceBusInitialized === null
                    ? 'checking'
                    : serviceBusInitialized
                      ? 'success'
                      : 'error'
                }
                animate={serviceBusInitialized === null}
                showCount={false}
              />
              {serviceBusInitialized === false && (
                <Button
                  onClick={handleInitializeServiceBus}
                  disabled={isInitializingServiceBus}
                  variant="outline"
                  size="sm"
                >
                  {isInitializingServiceBus ? 'Initializing...' : 'Initialize Service Bus'}
                </Button>
              )}
            </div>
            <div className='space-x-4'>
              <Dialog
                open={isSendDialogOpen}
                onOpenChange={setIsSendDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={serviceBusInitialized === false || (configError !== null)}>
                    <Send className="mr-2" />
                    Send Message
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Send Test Message</DialogTitle>
                  </DialogHeader>
                  <SendMessageTab
                    form={sendForm}
                    onFormChange={onSendFormChange}
                    onSend={() => {
                      onSendMessage();
                      setIsSendDialogOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>

              <Dialog
                open={isConfigDialogOpen}
                onOpenChange={setIsConfigDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Configuration
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Service Bus Configuration</DialogTitle>
                  </DialogHeader>
                  <Configuration
                    connectionInfo={connectionInfo}
                    form={connectionForm}
                    onFormChange={onConnectionFormChange}
                    onUpdate={() => {
                      onUpdateConnection();
                      setIsConfigDialogOpen(false);
                    }}
                    onTest={onTestConnection}
                    onReset={() => {
                      onResetConnection();
                      setIsConfigDialogOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
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
            onMessageDelete={async (messageId: string) => {
              try {
                // Assuming messages are received, but could be sent; for now, use 'received'
                await deleteMessage('received', messageId);
                // Refresh messages after delete
                if (canLoad) {
                  await loadMessages();
                }
                toast.success('Message deleted successfully');
              } catch (error) {
                console.error('Failed to delete message:', error);
                toast.error('Failed to delete message');
              }
            }}
            queueOptions={queuesAndTopics
              .filter((item) => item.type === 'queue' || item.type === 'topic')
              .map((item) => ({
                label: item.name,
                value: item.name,
                icon:
                  item.type === 'queue'
                    ? () => (
                        <span role="img" aria-label="queue">
                          📦
                        </span>
                      )
                    : () => (
                        <span role="img" aria-label="topic">
                          📡
                        </span>
                      ),
              }))}
          />
        </div>
      </div>
    </div>
  );
};
