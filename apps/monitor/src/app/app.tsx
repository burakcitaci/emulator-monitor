import React, { useState } from 'react';
import {
  ContainerSidebar,
  TabNavigation,
  Header,
  MessagesTab,
  SendMessageTab,
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

import { ConnectionForm } from '@e2e-monitor/entities';
import { useServiceBusConfig } from './hooks/api/useServiceBusConfig';

const ServiceBusMonitorView: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sendForm,
    setSendForm,
    messages,
    setMessages,
    dlqMessages,
    connectionInfo,
    setConnectionInfo,
    sendMessage,
    isLoading,
    error,
  } = useMonitor();

  const { config: serviceBusConfig } = useServiceBusConfig();

  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    connectionString: '',
    queues: 'test-queue,orders-queue',
  });

  const handleConnectionFormChange = (form: ConnectionForm) => {
    setConnectionForm(form);
    // Update connection info based on form
    const endpoint = form.connectionString.trim() === ''
      ? 'http://localhost:3000'
      : form.connectionString.match(/Endpoint=([^;]+)/)?.[1] || 'Azure Service Bus';

    setConnectionInfo({
      isConnected: form.connectionString.trim() !== '' || serviceBusConfig !== null,
      isLocal: form.connectionString.trim() === '',
      endpoint: endpoint,
      connectionString: form.connectionString,
    });
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'messages':
        return (
          <MessagesTab
            messages={messages}
            onMessagesUpdate={setMessages}
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

      case 'connection':
        return (
          <ConnectionTab
            connectionInfo={connectionInfo}
            form={connectionForm}
            onFormChange={handleConnectionFormChange}
            onUpdate={() => {
              // Update connection info when connection is updated
              const endpoint = connectionForm.connectionString.trim() === ''
                ? 'http://localhost:3000'
                : connectionForm.connectionString.match(/Endpoint=([^;]+)/)?.[1] || 'Azure Service Bus';

              setConnectionInfo({
                isConnected: connectionForm.connectionString.trim() !== '' || serviceBusConfig !== null,
                isLocal: connectionForm.connectionString.trim() === '',
                endpoint: endpoint,
                connectionString: connectionForm.connectionString,
              });
              console.log('Connection updated successfully');
            }}
            onTest={() => {
              // Simulate connection test
              return new Promise((resolve, reject) => {
                setTimeout(() => {
                  // Simulate success/failure (80% success rate)
                  if (Math.random() > 0.2) {
                    resolve('Connection successful');
                  } else {
                    reject(new Error('Connection failed'));
                  }
                }, 2000);
              });
            }}
            onReset={() => {
              setConnectionInfo({
                isConnected: false,
                isLocal: true,
                endpoint: '',
                connectionString: '',
              });
              setConnectionForm({
                connectionString: '',
                queues: 'test-queue,orders-queue',
              });
              console.log('Reset to local emulator defaults');
            }}
          />
        );
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <ContainerSidebar />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-16 items-center gap-2 border-b px-2 sm:px-3 shrink-0">
          <SidebarTrigger className="flex-shrink-0" />
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <div className="flex-1 min-w-0">
            <Header
              connectionInfo={connectionInfo}
              messages={messages}
              dlqMessages={dlqMessages.messages}
              serviceBusConfig={serviceBusConfig}
              onServiceBusInitialized={() => {
                // Update connection info when Service Bus is initialized
                console.log('Service Bus initialized successfully');
                setConnectionInfo({
                  isConnected: true,
                  isLocal: true,
                  endpoint: 'http://localhost:3000',
                  connectionString: '',
                });
              }}
            />
          </div>
          <div className="flex-shrink-0">
            <ThemeToggle />
          </div>
        </header>

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-full">
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
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export function App() {
  return (
    <Providers>
      <MonitorProvider>
        <ServiceBusMonitorView />
      </MonitorProvider>
    </Providers>
  );
}

export default App;
