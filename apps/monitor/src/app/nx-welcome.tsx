import { useState } from 'react';
import { ConnectionInfo, SendForm, ConnectionForm } from './types';
import {
  TabNavigation,
  MessagesTab,
  SendMessageTab,
  DeadLetterQueueTab,
  ConnectionTab,
  ConfigurationTab,
} from './components';
import { DeadLetterMessage } from './hooks/useServiceBus';

type TabId = 'messages' | 'send' | 'dlq' | 'connection' | 'configuration';

export default function ServiceBusMonitor() {
  const [activeTab, setActiveTab] = useState<TabId>('messages');
  const [filterQueue, setFilterQueue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deadLetterMessages, setDeadLetterMessages] = useState<
    DeadLetterMessage[]
  >([]);
  // const { allDestinations, getQueueNames } = useServiceBusConfig();

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
    const newMessage: DeadLetterMessage = {
      messageId: `msg-${Date.now()}`,
      body: sendForm.body,
      subject: sendForm.queueName,
      applicationProperties: sendForm.properties
        ? JSON.parse(sendForm.properties)
        : {},
      enqueuedTimeUtc: new Date(),
    };
    setDeadLetterMessages((prev) => [...prev, newMessage]);
    setSendForm({ ...sendForm, body: '', properties: '' });
  };

  const handleReplayMessage = (messageId: string) => {
    setDeadLetterMessages((prev) =>
      prev.filter((msg) => msg.messageId !== messageId)
    );
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterQueue('');
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
                searchTerm={searchTerm}
                filterQueue={filterQueue}
                onSearchChange={setSearchTerm}
                onFilterChange={setFilterQueue}
                onClearFilters={handleClearFilters}
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

            {activeTab === 'dlq' && (
              <DeadLetterQueueTab
                onReplay={handleReplayMessage}
                onView={handleViewMessage}
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
