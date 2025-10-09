import React, { useState } from 'react';
import {
  ContainerSidebar,
  TabNavigation,
  Header,
  MessagesTab,
  DeadLetterQueueTab,
  SendMessageTab,
  ConfigurationTab,
  ConnectionTab,
} from './components';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from './components/ui/sidebar';
import { Separator } from './components/ui/separator';
import { MonitorProvider, useMonitor } from './hooks';
import { Providers } from './providers';
import { ThemeToggle } from './components/common/ThemeToggle';
import { AlertCircle } from 'lucide-react';

import { DeadLetterMessage } from './hooks/useServiceBus';
import { ConnectionForm } from '@emulator-monitor/entities';

const MonitorContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sendForm,
    setSendForm,
    messages,
    dlqMessages,
    connectionInfo,
    setSelectedMessage,
    sendMessage,
    replayMessage,
    isLoading,
    error,
  } = useMonitor();

  // Connection form state
  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    connectionString: '',
    queues: 'test-queue,orders-queue',
  });

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
  };

  const handleSendFormChange = (form: typeof sendForm) => {
    setSendForm(form);
  };

  const handleMessageSelect = (message: DeadLetterMessage | null) => {
    setSelectedMessage(message);
  };

  const handleReplay = (messageId: string) => {
    replayMessage(messageId);
  };

  const handleView = (message: DeadLetterMessage | null) => {
    setSelectedMessage(message);
  };

  const handleSend = () => {
    sendMessage();
  };

  // Connection tab handlers
  const handleUpdate = () => {
    alert('Connection updated!');
  };

  const handleTest = () => {
    alert('Testing connection...');
  };

  const handleReset = () => {
    alert('Reset to local emulator');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'messages':
        return (
          <MessagesTab
            messages={messages}
            onMessageSelect={handleMessageSelect}
          />
        );
      case 'send':
        return (
          <SendMessageTab
            form={sendForm}
            onFormChange={handleSendFormChange}
            onSend={handleSend}
          />
        );
      case 'dlq':
        return (
          <DeadLetterQueueTab onReplay={handleReplay} onView={handleView} />
        );
      case 'configuration':
        return <ConfigurationTab />;
      case 'connection':
        return (
          <ConnectionTab
            connectionInfo={connectionInfo}
            form={connectionForm}
            onFormChange={setConnectionForm}
            onUpdate={handleUpdate}
            onTest={handleTest}
            onReset={handleReset}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <div>
      <SidebarProvider>
        <ContainerSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b">
            <div className="flex items-center gap-2 px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Header
                connectionInfo={connectionInfo}
                messages={messages}
                dlqMessages={dlqMessages.messages}
              />
            </div>
            <div className="ml-auto px-3">
              <ThemeToggle />
            </div>
          </header>

          <div className="flex flex-1 flex-col">
            <TabNavigation
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />

            <div className="flex-1 p-8">
              {isLoading && (
                <div className="flex items-center justify-center p-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-6 max-w-2xl mx-auto">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <div>
                      <h3 className="font-medium text-destructive">Error</h3>
                      <p className="text-sm text-destructive/80 mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {renderActiveTab()}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export function App() {
  return (
    <Providers>
      <MonitorProvider>
        <MonitorContent />
      </MonitorProvider>
    </Providers>
  );
}

export default App;
