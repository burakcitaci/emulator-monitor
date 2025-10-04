import React, { useState } from 'react';
import { Message, ConnectionInfo, SendForm, ConnectionForm } from './types';
import { useMessages, useServiceBusConfig } from './hooks';
import {
  Header,
  TabNavigation,
  MessagesTab,
  SendMessageTab,
  DeadLetterQueueTab,
  ConnectionTab,
  ConfigurationTab,
  MessageDetailModal,
} from './components';

type TabId = 'messages' | 'send' | 'dlq' | 'connection' | 'configuration';

export default function ServiceBusMonitor() {
  const [activeTab, setActiveTab] = useState<TabId>('messages');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filterQueue, setFilterQueue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { messages, dlqMessages, addMessage, replayMessage } = useMessages();
  const { allDestinations, getQueueNames } = useServiceBusConfig();

  const [sendForm, setSendForm] = useState<SendForm>({
    queueName: '',
    body: '',
    properties: '',
  });

  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    connectionString: '',
    queues: 'test-queue,orders-queue',
  });

  const [dlqQueue, setDlqQueue] = useState('');

  const [connectionInfo] = useState<ConnectionInfo>({
    isConnected: true,
    isLocal: true,
    endpoint: 'localhost',
    connectionString: '',
  });

  const handleSendMessage = () => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      queueName: sendForm.queueName,
      body: sendForm.body,
      properties: sendForm.properties ? JSON.parse(sendForm.properties) : {},
      timestamp: new Date().toISOString(),
      direction: 'outgoing',
      status: 'sent',
      isDeadLetter: false,
    };
    addMessage(newMessage);
    setSendForm({ ...sendForm, body: '', properties: '' });
  };

  const handleReplayMessage = (messageId: string) => {
    replayMessage(messageId);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterQueue('');
  };

  // Use configured destinations instead of extracting from messages
  const uniqueQueues =
    allDestinations.length > 0
      ? allDestinations
      : [...new Set(messages.map((m) => m.queueName))];

  return (
    <div className="min-h-screen ">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow-md">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="p-6">
            {activeTab === 'messages' && (
              <MessagesTab
                messages={messages}
                searchTerm={searchTerm}
                filterQueue={filterQueue}
                onSearchChange={setSearchTerm}
                onFilterChange={setFilterQueue}
                onClearFilters={handleClearFilters}
                onMessageSelect={setSelectedMessage}
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
                dlqMessages={dlqMessages}
                dlqQueue={dlqQueue}
                uniqueQueues={uniqueQueues}
                onQueueChange={setDlqQueue}
                onReplay={handleReplayMessage}
                onView={setSelectedMessage}
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

      <MessageDetailModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
      />
    </div>
  );
}
