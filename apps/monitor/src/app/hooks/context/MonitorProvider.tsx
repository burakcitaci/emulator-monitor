import React, {
  createContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import { SendForm, ConnectionInfo, Message } from '@e2e-monitor/entities';
import {
  useServiceBus,
  DeadLetterMessage,
  DeadLetterMessageResponse,
} from '../api/useServiceBus';
import { useServiceBusConfig } from '../api/useServiceBusConfig';
import toast from 'react-hot-toast';

interface MonitorState {
  // Tab management
  activeTab: 'messages' | 'send' | 'dlq' | 'connection';

  // Form states
  sendForm: SendForm;
  dlqQueue: string;

  // Data states
  messages: Message[];
  dlqMessages: DeadLetterMessageResponse;
  connectionInfo: ConnectionInfo;

  // UI states
  isLoading: boolean;
  isSendingMessage: boolean;
  error: string | null;
}

interface MonitorActions {
  // Tab actions
  setActiveTab: (tab: MonitorState['activeTab']) => void;

  // Form actions
  setSendForm: (form: SendForm) => void;
  setDlqQueue: (queue: string) => void;

  // Data actions
  setMessages: (messages: Message[]) => void;
  setDlqMessages: (messages: DeadLetterMessageResponse) => void;
  setConnectionInfo: (info: ConnectionInfo) => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Service actions
  sendMessage: () => Promise<void>;
  loadDlqMessages: (queueName: string) => Promise<void>;
  replayMessage: (messageId: string) => Promise<void>;
}

export type MonitorContextType = MonitorState & MonitorActions;

export const MonitorContext = createContext<MonitorContextType | undefined>(
  undefined,
);

const initialState: MonitorState = {
  activeTab: 'messages',
  sendForm: {
    queueName: '',
    body: '',
    properties: '',
    subject: '',
  },
  dlqQueue: '',
  messages: [],
  dlqMessages: {
    success: false,
    messageCount: 0,
    messages: [],
    entityPath: '',
  },
  connectionInfo: {
    connectionString: '',
    endpoint: '',
    isLocal: true,
    isConnected: false,
  },
  isLoading: false,
  isSendingMessage: false,
  error: null,
};

interface MonitorProviderProps {
  children: ReactNode;
}

export const MonitorProvider: React.FC<MonitorProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<MonitorState>(initialState);

  const {
    sendMessage: serviceBusSendMessage,
    getDeadLetterMessages,
    getMessages,
  } = useServiceBus();

  const { getQueueNames, getSubscriptionsByTopic, queuesAndTopics, config } =
    useServiceBusConfig();

  const setActiveTab = (tab: MonitorState['activeTab']) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  };

  const setSendForm = (form: SendForm) => {
    setState((prev) => ({ ...prev, sendForm: form }));
  };

  const setDlqQueue = (queue: string) => {
    setState((prev) => ({ ...prev, dlqQueue: queue }));
  };

  const setMessages = useCallback((messages: Message[]) => {
    setState((prev) => ({ ...prev, messages }));
  }, []);

  const setDlqMessages = (messages: DeadLetterMessageResponse) => {
    setState((prev) => ({ ...prev, dlqMessages: messages }));
  };

  const setConnectionInfo = (info: ConnectionInfo) => {
    setState((prev) => ({ ...prev, connectionInfo: info }));
  };

  const setLoading = (loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  };

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  };

  const sendMessage = useCallback(async () => {
    if (
      !state.sendForm.queueName ||
      !state.sendForm.body ||
      !state.sendForm.subject
    ) {
      const errorMessage = 'Queue name, subject, and message body are required';
      setState((prev) => ({ ...prev, error: errorMessage }));
      toast.error(errorMessage);
      return;
    }

    setState((prev) => ({ ...prev, isSendingMessage: true, error: null }));

    try {
      const messageBody = state.sendForm.body
        ? JSON.parse(state.sendForm.body)
        : {};
      const messageProperties = state.sendForm.properties
        ? JSON.parse(state.sendForm.properties)
        : undefined;

      const destination = state.sendForm.queueName;
      const nsFromQueue = queuesAndTopics.find(
        (i) => i.type === 'queue' && i.name === destination,
      )?.namespace;
      const nsFromTopic = queuesAndTopics.find(
        (i) => i.type === 'topic' && i.name === destination,
      )?.namespace;
      const resolvedNamespace =
        nsFromQueue ||
        nsFromTopic ||
        config?.UserConfig.Namespaces[0]?.Name ||
        'sbemulatorns';

      // Determine destination type (queue or topic) and enrich application properties
      const isQueue = !!queuesAndTopics.find(
        (i) => i.type === 'queue' && i.name === destination,
      );
      const isTopic = !!queuesAndTopics.find(
        (i) => i.type === 'topic' && i.name === destination,
      );
      const subs = isTopic ? getSubscriptionsByTopic(destination) : undefined;
      const preferredSub =
        subs && subs.length > 0
          ? subs.includes('default')
            ? 'default'
            : subs[0]
          : undefined;

      const computedAppProps = {
        ...(messageProperties || {}),
        ...(isQueue ? { queue: destination } : {}),
        ...(isTopic
          ? {
              topic: destination,
              subscription: preferredSub, // Always set subscription for topics
            }
          : {}),
      } as Record<string, unknown>;

      await serviceBusSendMessage({
        namespace: resolvedNamespace,
        topic: state.sendForm.queueName,
        message: {
          body: messageBody,
          contentType: 'application/json',
          messageId: `msg-${Date.now()}`,
          timeToLive: 500,
          subject: state.sendForm.subject || state.sendForm.queueName,
          applicationProperties: computedAppProps,
        },
      });

      toast.success(
        `Message sent successfully to ${state.sendForm.queueName}!`,
        {
          duration: 3000,
          icon: '🚀',
        },
      );

      // Refresh messages
      try {
        const queues = getQueueNames();
        if (queues.includes(destination)) {
          const fetched = await getMessages({
            namespace: resolvedNamespace,
            queue: destination,
            maxMessages: 20,
          });
          setState((prev) => ({ ...prev, messages: fetched.messages || [] }));
        } else {
          const subs = getSubscriptionsByTopic(destination);
          if (subs?.length > 0) {
            const preferred = subs.includes('default') ? 'default' : subs[0];
            const fetched = await getMessages({
              namespace: resolvedNamespace,
              topic: destination,
              subscription: preferred,
              maxMessages: 20,
            });
            setState((prev) => ({ ...prev, messages: fetched.messages || [] }));
          }
        }
      } catch (e) {
        console.warn('Failed to refresh messages after send', e);
      }

      setState((prev) => ({
        ...prev,
        sendForm: { queueName: '', body: '', properties: '', subject: '' },
      }));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
      setState((prev) => ({ ...prev, error: errorMessage }));
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setState((prev) => ({ ...prev, isSendingMessage: false }));
    }
  }, [
    state.sendForm,
    queuesAndTopics,
    config,
    serviceBusSendMessage,
    getMessages,
    getQueueNames,
    getSubscriptionsByTopic,
  ]);

  /**
   * Load DLQ messages
   */
  const loadDlqMessages = useCallback(
    async (queueName: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const topicName = queueName.includes('/')
          ? queueName.split('/')[0]
          : queueName;
        const subName = queueName.includes('/')
          ? queueName.split('/')[1]
          : 'default';

        const nsFromQueue = queuesAndTopics.find(
          (i) => i.type === 'queue' && i.name === topicName,
        )?.namespace;
        const nsFromTopic = queuesAndTopics.find(
          (i) => i.type === 'topic' && i.name === topicName,
        )?.namespace;
        const dlqNamespace =
          nsFromQueue ||
          nsFromTopic ||
          config?.UserConfig.Namespaces[0]?.Name ||
          'sbemulatorns';

        const dlqMessages = await getDeadLetterMessages({
          namespace: dlqNamespace,
          topic: topicName,
          subscription: subName,
          maxMessages: 20,
          maxWaitTimeInSeconds: 10,
        });

        setState((prev) => ({ ...prev, dlqMessages }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error:
            err instanceof Error ? err.message : 'Failed to load DLQ messages',
        }));
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [queuesAndTopics, config, getDeadLetterMessages],
  );

  /**
   * Replay DLQ message
   */
  const replayMessage = useCallback(
    async (messageId: string) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const messageToReplay = state.dlqMessages.messages.find(
          (msg: DeadLetterMessage) => msg.messageId === messageId,
        );
        if (!messageToReplay) throw new Error('Message not found');

        console.log('Replaying message:', messageId);
        await loadDlqMessages(state.dlqQueue);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error:
            err instanceof Error ? err.message : 'Failed to replay message',
        }));
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [state.dlqMessages.messages, state.dlqQueue, loadDlqMessages],
  );
  const contextValue = useMemo<MonitorContextType>(
    () => ({
      ...state,
      setActiveTab,
      setSendForm,
      setDlqQueue,
      setMessages,
      setDlqMessages,
      setConnectionInfo,
      setLoading,
      setError,
      sendMessage,
      loadDlqMessages,
      replayMessage,
    }),
    [
      state, // the full state object
      sendMessage,
      loadDlqMessages,
      replayMessage,
    ],
  );

  return (
    <MonitorContext.Provider value={contextValue}>
      {children}
    </MonitorContext.Provider>
  );
};
