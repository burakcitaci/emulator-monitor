import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SendForm, ConnectionInfo } from '@emulator-monitor/entities';
import {
  useServiceBus,
  DeadLetterMessage,
  DeadLetterMessageResponse,
  Message,
} from './useServiceBus';
import { useServiceBusConfig } from './useServiceBusConfig';
import toast from 'react-hot-toast';

interface MonitorState {
  // Tab management
  activeTab: 'messages' | 'send' | 'dlq' | 'connection' | 'configuration';

  // Form states
  sendForm: SendForm;
  dlqQueue: string;

  // Data states
  messages: Message[];
  dlqMessages: DeadLetterMessageResponse;
  connectionInfo: ConnectionInfo;

  // UI states
  selectedMessage: Message | null;
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
  setSelectedMessage: (message: Message | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Service actions
  sendMessage: () => Promise<void>;
  loadDlqMessages: (queueName: string) => Promise<void>;
  replayMessage: (messageId: string) => Promise<void>;
}

type MonitorContextType = MonitorState & MonitorActions;

const MonitorContext = createContext<MonitorContextType | undefined>(undefined);

const initialState: MonitorState = {
  activeTab: 'messages',
  sendForm: {
    queueName: '',
    body: '',
    properties: '',
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
  selectedMessage: null,
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

  const setMessages = (messages: Message[]) => {
    setState((prev) => ({ ...prev, messages }));
  };

  const setDlqMessages = (messages: DeadLetterMessageResponse) => {
    setState((prev) => ({ ...prev, dlqMessages: messages }));
  };

  const setConnectionInfo = (info: ConnectionInfo) => {
    setState((prev) => ({ ...prev, connectionInfo: info }));
  };

  const setSelectedMessage = (message: Message | null) => {
    setState((prev) => ({ ...prev, selectedMessage: message }));
  };

  const setLoading = (loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  };

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  };

  const sendMessage = async () => {
    if (!state.sendForm.queueName || !state.sendForm.body) {
      const errorMessage = 'Queue name and message body are required';
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    setState((prev) => ({ ...prev, isSendingMessage: true }));
    setError(null);

    try {
      const messageBody = state.sendForm.body
        ? JSON.parse(state.sendForm.body)
        : {};
      const messageProperties = state.sendForm.properties
        ? JSON.parse(state.sendForm.properties)
        : undefined;

      // Resolve namespace
      const destination = state.sendForm.queueName;
      const nsFromQueue = queuesAndTopics.find(
        (i) => i.type === 'queue' && i.name === destination
      )?.namespace;
      const nsFromTopic = queuesAndTopics.find(
        (i) => i.type === 'topic' && i.name === destination
      )?.namespace;
      const resolvedNamespace =
        nsFromQueue ||
        nsFromTopic ||
        config?.UserConfig.Namespaces[0]?.Name ||
        'sbemulatorns';

      await serviceBusSendMessage({
        namespace: resolvedNamespace,
        topic: state.sendForm.queueName,
        message: {
          body: messageBody,
          contentType: 'application/json',
          messageId: `msg-${Date.now()}`,
          timeToLive: 500,
          subject: state.sendForm.queueName,
          applicationProperties: messageProperties,
        },
      });

      toast.success(
        `Message sent successfully to ${state.sendForm.queueName}!`,
        {
          duration: 3000,
          icon: '🚀',
        }
      );

      // Refresh messages after send
      try {
        const queues = getQueueNames();
        if (queues.includes(destination)) {
          const fetched = await getMessages({
            namespace: resolvedNamespace,
            queue: destination,
            maxMessages: 20,
          });
          setMessages(fetched.messages || []);
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
            setMessages(fetched.messages || []);
          }
        }
      } catch (e) {
        console.warn('Failed to refresh messages after send', e);
      }

      setSendForm({ queueName: '', body: '', properties: '' });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setState((prev) => ({ ...prev, isSendingMessage: false }));
    }
  };

  const loadDlqMessages = async (queueName: string) => {
    setLoading(true);
    setError(null);

    try {
      const topicName = queueName.includes('/')
        ? queueName.split('/')[0]
        : queueName;
      const subName = queueName.includes('/')
        ? queueName.split('/')[1]
        : 'default';

      const nsFromQueue = queuesAndTopics.find(
        (i) => i.type === 'queue' && i.name === topicName
      )?.namespace;
      const nsFromTopic = queuesAndTopics.find(
        (i) => i.type === 'topic' && i.name === topicName
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

      setDlqMessages(dlqMessages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load DLQ messages'
      );
    } finally {
      setLoading(false);
    }
  };

  const replayMessage = async (messageId: string) => {
    setLoading(true);
    setError(null);

    try {
      const messageToReplay = state.dlqMessages.messages.find(
        (msg: DeadLetterMessage) => msg.messageId === messageId
      );
      if (!messageToReplay) {
        throw new Error('Message not found');
      }

      console.log('Replaying message:', messageId);
      await loadDlqMessages(state.dlqQueue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replay message');
    } finally {
      setLoading(false);
    }
  };

  const contextValue: MonitorContextType = {
    ...state,
    setActiveTab,
    setSendForm,
    setDlqQueue,
    setMessages,
    setDlqMessages,
    setConnectionInfo,
    setSelectedMessage,
    setLoading,
    setError,
    sendMessage,
    loadDlqMessages,
    replayMessage,
  };

  return (
    <MonitorContext.Provider value={contextValue}>
      {children}
    </MonitorContext.Provider>
  );
};

export const useMonitor = (): MonitorContextType => {
  const context = useContext(MonitorContext);
  if (context === undefined) {
    throw new Error('useMonitor must be used within a MonitorProvider');
  }
  return context;
};
