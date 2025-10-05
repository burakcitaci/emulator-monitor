import React from 'react';
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

const MonitorContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sendForm,
    setSendForm,
    dlqQueue,
    setDlqQueue,
    messages,
    dlqMessages,
    connectionInfo,
    sendMessage,
    loadDlqMessages,
    replayMessage,
    isLoading,
    error,
  } = useMonitor();

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
  };

  const handleSendFormChange = (form: typeof sendForm) => {
    setSendForm(form);
  };

  const handleMessageSelect = (message: typeof selectedMessage) => {
    setSelectedMessage(message);
  };

  const handleQueueChange = (queue: string) => {
    setDlqQueue(queue);
    if (queue) {
      loadDlqMessages(queue);
    }
  };

  const handleReplay = (messageId: string) => {
    replayMessage(messageId);
  };

  const handleView = (message: typeof selectedMessage) => {
    setSelectedMessage(message);
  };

  const handleSend = () => {
    sendMessage();
  };

  // Get unique queues for DLQ tab
  const uniqueQueues = React.useMemo(() => {
    const queues = new Set<string>();
    dlqMessages.messages.forEach((msg) => {
      if (msg.deadLetterSource) {
        queues.add(msg.deadLetterSource);
      }
    });
    return Array.from(queues);
  }, [dlqMessages]);

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
          <DeadLetterQueueTab
            dlqMessages={dlqMessages}
            dlqQueue={dlqQueue}
            uniqueQueues={uniqueQueues}
            onQueueChange={handleQueueChange}
            onReplay={handleReplay}
            onView={handleView}
          />
        );
      case 'configuration':
        return <ConfigurationTab />;
      case 'connection':
        return <ConnectionTab />;
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

            <div className="flex-1 p-6">
              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                  <p className="text-destructive">{error}</p>
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
