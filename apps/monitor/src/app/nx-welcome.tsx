import { useState } from 'react';
import {
  ConnectionInfo,
  SendForm,
  ConnectionForm,
} from '@emulator-monitor/entities';
import {
  TabNavigation,
  MessagesTab,
  SendMessageTab,
  ConnectionTab,
  ConfigurationTab,
} from './components';
import { DeadLetterMessage, Message } from './hooks/useServiceBus';

type TabId = 'messages' | 'send' | 'dlq' | 'connection' | 'configuration';

export default function ServiceBusMonitor() {
  const [activeTab, setActiveTab] = useState<TabId>('messages');
  const [deadLetterMessages, setDeadLetterMessages] = useState<Message[]>([]);

  const [sendForm, setSendForm] = useState<SendForm>({
    queueName: '',
    body: '',
    properties: '',
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

  // Handle viewing a DeadLetterMessage
  const handleViewMessage = (message: DeadLetterMessage) => {
    console.log('Viewing message:', message);
  };

  const handleSendMessage = () => {
    const newMessage: Message = {
      messageId: `msg-${Date.now()}`,
      body: sendForm.body,
      subject: sendForm.queueName,
      applicationProperties: sendForm.properties
        ? JSON.parse(sendForm.properties)
        : {},
      scheduledEnqueueTimeUtc: new Date(),
    };
    setDeadLetterMessages((prev) => [...prev, newMessage]);
    setSendForm({ ...sendForm, body: '', properties: '' });
  };

  const handleReplayMessage = (messageId: string) => {
    setDeadLetterMessages((prev) =>
      prev.filter((msg) => msg.messageId !== messageId)
    );
  };

  return (
    <div className="min-h-screen ">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow-md">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="p-6">
            {activeTab === 'messages' && (
              <MessagesTab
                messages={deadLetterMessages}
                onMessageSelect={(message) =>
                  console.log('Selected message:', message)
                }
              />
            )}

            {activeTab === 'send' && (
              <SendMessageTab
                form={sendForm}
                onFormChange={setSendForm}
                onSend={handleSendMessage}
              />
            )}

            {activeTab === 'configuration' && <ConfigurationTab />}

            {activeTab === 'connection' && (
              <ConnectionTab
                connectionInfo={connectionInfo}
                form={connectionForm}
                onFormChange={setConnectionForm}
                onUpdate={() => alert('Connection updated!')}
                onTest={() => alert('Testing connection...')}
                onReset={() => alert('Reset to local emulator')}
              />
            )}
          </div>
        </div>
      </div>

      {/* <MessageDetailModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
      /> */}
    </div>
  );
}
