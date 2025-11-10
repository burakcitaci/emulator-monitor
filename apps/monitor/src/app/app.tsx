import React from 'react';
import {
  ContainerSidebar,
  Header,
  MessagesTab,
} from './components';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from './components/ui/sidebar';
import { Separator } from './components/ui/separator';
import { MonitorProvider, useMonitor } from './hooks';
import { useConnection } from './hooks/useConnection';
import { Providers } from './providers';
import { ThemeToggle } from './components/common/ThemeToggle';

import { useServiceBusConfig } from './hooks/api/useServiceBusConfig';

const ServiceBusMonitorView: React.FC = () => {
  const {
    sendForm,
    setSendForm,
    messages,
    setMessages,
    dlqMessages,
    sendMessage,
    isLoading,
    error,
  } = useMonitor();

  const { config: serviceBusConfig } = useServiceBusConfig();

  const {
    connectionForm,
    connectionInfo,
    setConnectionInfo,
    handleConnectionFormChange,
    updateConnectionInfo,
    resetConnection,
  } = useConnection(serviceBusConfig);

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

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-full">
            <MessagesTab
              messages={messages}
              onMessagesUpdate={setMessages}
              dlqMessages={dlqMessages.messages}
              sendForm={sendForm}
              onSendFormChange={setSendForm}
              onSendMessage={sendMessage}
              connectionInfo={connectionInfo}
              connectionForm={connectionForm}
              onConnectionFormChange={handleConnectionFormChange}
              onUpdateConnection={() => {
                updateConnectionInfo(connectionForm);
                console.log('Configuration updated successfully');
              }}
              onTestConnection={() => {
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
              onResetConnection={() => {
                resetConnection();
                console.log('Reset to local emulator defaults');
              }}
            />
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
