import { useState } from 'react';
import {
  ConnectionInfo,
  SendForm,
  ConnectionForm,
  MessageState,
} from '@e2e-monitor/entities';
import {
  TabNavigation,
  MessagesTab,
  SendMessageTab,
  Configuration,
} from './components';
import { Message } from '@e2e-monitor/entities';

type TabId = 'messages' | 'send' | 'dlq' | 'configuration';

/**
 * StandaloneServiceBusMonitor
 * 
 * A standalone demo version of the Service Bus Monitor without providers or context.
 * Useful for testing individual components or as a fallback view.
 * 
 * Not used in production - see app.tsx for the main application.
 */
export default function StandaloneServiceBusMonitor() {
  const [activeTab, setActiveTab] = useState<TabId>('messages');
  const [deadLetterMessages, setDeadLetterMessages] = useState<Message[]>([]);

  const [sendForm, setSendForm] = useState<SendForm>({
    queueName: '',
    body: '',
    properties: '',
    subject: '',
  });

  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    connectionString: '',
    queues: 'test-queue,orders-queue',
  });

  const [connectionInfo] = useState<ConnectionInfo>({
    isConnected: true,
    isLocal: true,
    endpoint: 'localhost',
    connectionString: '',
  });

  const handleConnectionFormChange = (form: ConnectionForm) => {
    setConnectionForm(form);
  };

  const handleSendMessage = () => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      messageId: `msg-${Date.now()}`,
      body: sendForm.body,
      subject: sendForm.queueName,
      createdAt: new Date(),
      timestamp: new Date(),
      state: MessageState.ACTIVE,
      properties: {},
    };
    setDeadLetterMessages((prev) => [...prev, newMessage]);
    setSendForm({ ...sendForm, body: '', properties: '' });
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white dark:bg-slate-950 rounded-lg shadow-md">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="p-6">
            {activeTab === 'messages' && (
              <MessagesTab
                messages={deadLetterMessages}
                onMessagesUpdate={() => {console.log('Messages updated');}}
              />
            )}

            {activeTab === 'send' && (
              <SendMessageTab
                form={sendForm}
                onFormChange={setSendForm}
                onSend={handleSendMessage}
              />
            )}

            {activeTab === 'configuration' && (
              <Configuration
                connectionInfo={connectionInfo}
                form={connectionForm}
                onFormChange={handleConnectionFormChange}
                onUpdate={() => {
                  console.log('Configuration updated successfully');
                }}
                onTest={() => {
                  return new Promise((resolve, reject) => {
                    setTimeout(() => {
                      if (Math.random() > 0.2) {
                        resolve('Connection successful');
                      } else {
                        reject(new Error('Connection failed'));
                      }
                    }, 2000);
                  });
                }}
                onReset={() => {
                  console.log('Reset to local emulator defaults');
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
