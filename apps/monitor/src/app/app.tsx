import React, { useState } from 'react';
import {
  ContainerSidebar,
  TabNavigation,
  Header,
  MessagesTab,
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
    isLoading,
    error,
  } = useMonitor();

  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    connectionString: '',
    queues: 'test-queue,orders-queue',
  });

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'messages':
        return (
          <MessagesTab
            messages={messages}
            onMessageSelect={setSelectedMessage}
          />
        );
      case 'send':
        return (
          <SendMessageTab
            form={sendForm}
            onFormChange={setSendForm}
            onSend={sendMessage}
          />
        );

      case 'configuration':
        return <ConfigurationTab />;
      case 'connection':
        return (
          <ConnectionTab
            connectionInfo={connectionInfo}
            form={connectionForm}
            onFormChange={setConnectionForm}
            onUpdate={() => alert('Connection updated!')}
            onTest={() => alert('Testing connection...')}
            onReset={() => alert('Reset to local emulator')}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <SidebarProvider>
      <ContainerSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <Header
            connectionInfo={connectionInfo}
            messages={messages}
            dlqMessages={dlqMessages.messages}
          />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="p-8">
          {isLoading && (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="ml-3 text-muted-foreground">Loading...</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <span className="text-destructive">{error}</span>
              </div>
            </div>
          )}

          {renderActiveTab()}
        </main>
      </SidebarInset>
    </SidebarProvider>
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
