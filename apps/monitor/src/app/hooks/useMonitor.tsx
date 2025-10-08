import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { SendForm, ConnectionInfo } from '../types';
import {
  useServiceBus,
  DeadLetterMessage,
  DeadLetterMessageResponse,
} from './useServiceBus';
import toast from 'react-hot-toast';

interface MonitorState {
  // Tab management
  activeTab: 'messages' | 'send' | 'dlq' | 'connection' | 'configuration';

  // Form states
  sendForm: SendForm;
  dlqQueue: string;

  // Data states
  messages: DeadLetterMessage[];
  dlqMessages: DeadLetterMessageResponse;
  connectionInfo: ConnectionInfo;

  // UI states
  selectedMessage: DeadLetterMessage | null;
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
  setMessages: (messages: DeadLetterMessage[]) => void;
  setDlqMessages: (messages: DeadLetterMessageResponse) => void;
  setConnectionInfo: (info: ConnectionInfo) => void;

  // UI actions
  setSelectedMessage: (message: DeadLetterMessage | null) => void;
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
  const { sendMessage: serviceBusSendMessage, getDeadLetterMessages } =
    useServiceBus();

  const setActiveTab = useCallback((tab: MonitorState['activeTab']) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const setSendForm = useCallback((form: SendForm) => {
    setState((prev) => ({ ...prev, sendForm: form }));
  }, []);

  const setDlqQueue = useCallback((queue: string) => {
    setState((prev) => ({ ...prev, dlqQueue: queue }));
  }, []);

  const setMessages = useCallback((messages: DeadLetterMessage[]) => {
    setState((prev) => ({ ...prev, messages }));
  }, []);

  const setDlqMessages = useCallback((messages: DeadLetterMessageResponse) => {
    setState((prev) => ({ ...prev, dlqMessages: messages }));
  }, []);

  const setConnectionInfo = useCallback((info: ConnectionInfo) => {
    setState((prev) => ({ ...prev, connectionInfo: info }));
  }, []);

  const setSelectedMessage = useCallback(
    (message: DeadLetterMessage | null) => {
      setState((prev) => ({ ...prev, selectedMessage: message }));
    },
    []
  );

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const sendMessage = useCallback(async () => {
    if (!state.sendForm.queueName || !state.sendForm.body) {
      const errorMessage = 'Queue name and message body are required';
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    setState((prev) => ({ ...prev, isSendingMessage: true }));
    setError(null);

    try {
      // Parse form data
      const messageBody = state.sendForm.body
        ? JSON.parse(state.sendForm.body)
        : {};
      const messageProperties = state.sendForm.properties
        ? JSON.parse(state.sendForm.properties)
        : undefined;

      await serviceBusSendMessage({
        namespace: 'sbemulatorns',
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

      // Reset form after successful send
      setSendForm({ queueName: '', body: '', properties: '' });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setState((prev) => ({ ...prev, isSendingMessage: false }));
    }
  }, [state.sendForm, serviceBusSendMessage, setError, setSendForm]);

  const loadDlqMessages = useCallback(
    async (queueName: string) => {
      setLoading(true);
      setError(null);

      try {
        const dlqMessages = await getDeadLetterMessages({
          namespace: 'solution-monitor-ns',
          topic: queueName.includes('/') ? queueName.split('/')[0] : queueName,
          subscription: queueName.includes('/')
            ? queueName.split('/')[1]
            : 'default',
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
    },
    [getDeadLetterMessages, setLoading, setError, setDlqMessages]
  );

  const replayMessage = useCallback(
    async (messageId: string) => {
      setLoading(true);
      setError(null);

      try {
        // Find the message to replay
        const messageToReplay = state.dlqMessages.messages.find(
          (msg: DeadLetterMessage) => msg.messageId === messageId
        );
        if (!messageToReplay) {
          throw new Error('Message not found');
        }

        // Replay the message (this would need to be implemented in the service)
        console.log('Replaying message:', messageId);

        // Reload DLQ messages after replay
        await loadDlqMessages(state.dlqQueue);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to replay message'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      state.dlqMessages.messages,
      state.dlqQueue,
      loadDlqMessages,
      setLoading,
      setError,
    ]
  );

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
