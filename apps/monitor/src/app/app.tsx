import React from 'react';
import {
  SidebarInset,
  SidebarProvider,
} from './components/ui/sidebar';
import { Routes, Route } from 'react-router';
import { AppSidebar } from './components/containers/ContainerSidebar';
import { SiteHeader } from './components/common/SiteHeader';
import { useSidebarState } from './hooks/useSidebarState';
import MessagingResources from './features/messaging-resources';
import { AzureSbDetailPage } from './features/azure-sb';
import { AwsSqsDetailPage } from './features/aws-sqs';
import { MessagesPage } from './features/messages';


export function App() {
  const { isOpen } = useSidebarState();

 const NAV_ITEMS = [
  { title: "Messaging Monitor", url: "/" },
  { title: "Messaging Resources", url: "/messaging-resources" },
]

  return (
    <SidebarProvider
      defaultOpen={isOpen}
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader items={NAV_ITEMS} />
          <div className="flex flex-1 flex-col min-w-0">
            <Routes>
              <Route path="/" element={<MessagesPage />} />
              <Route path="/messaging-resources" element={<MessagingResources />} />
              <Route path="/sqs" element={<AwsSqsDetailPage />} />
              <Route path="/azure-service-bus" element={<AzureSbDetailPage />} />
            </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
