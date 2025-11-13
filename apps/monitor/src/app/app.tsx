import React from 'react';
import {
  ContainerSidebar,
  Header,
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
import { Messages } from './components/service-bus/Messages';

const ServiceBusMonitorView: React.FC = () => {
  const {
    messages,
    dlqMessages,
  } = useMonitor();

  const { config: serviceBusConfig } = useServiceBusConfig();

  const {
    connectionInfo,
    setConnectionInfo,
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
            <Messages />    
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
