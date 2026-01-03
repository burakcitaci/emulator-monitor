import React from 'react';
import {
  SidebarInset,
  SidebarProvider,
} from './components/ui/sidebar';
import { Routes, Route } from 'react-router';
import { Messages } from './components/messages/Messages';
import { AppSidebar } from './components/containers/ContainerSidebar';
import { SiteHeader } from './components/common/SiteHeader';
import { useSidebarState } from './hooks/useSidebarState';
import { Detail } from './components/detail';


export function App() {
  const { isOpen } = useSidebarState();

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
        <SiteHeader />
          <div className="flex flex-1 flex-col min-w-0">
            <Routes>
              <Route path="/" element={<Messages />} />
              <Route path="/:emulator" element={<Detail />} />
            </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
