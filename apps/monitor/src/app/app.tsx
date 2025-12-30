import React, { useState, useEffect } from 'react';
import {
  SidebarInset,
  SidebarProvider,
} from './components/ui/sidebar';
import { Routes, Route } from 'react-router';
import { Messages } from './components/service-bus/Messages';
import { AppSidebar } from './components/containers/ContainerSidebar';
import { SiteHeader } from './components/common/SiteHeader';
import { useSidebarState } from './hooks/useSidebarState';
import { Detail } from './components/detail';


type EmulatorType = 'sqs' | 'azure-service-bus' | 'rabbitmq' | null;

function getEmulatorTypeFromPath(): EmulatorType {
  const path = window.location.pathname;
  if (path === '/sqs' || path.startsWith('/sqs/')) return 'sqs';
  if (path === '/azure-service-bus' || path.startsWith('/azure-service-bus/')) return 'azure-service-bus';
  if (path === '/rabbitmq' || path.startsWith('/rabbitmq/')) return 'rabbitmq';
  return null;
}

export function App() {
  const { isOpen } = useSidebarState();
  const [emulatorType, setEmulatorType] = useState<EmulatorType>(() => getEmulatorTypeFromPath());

  useEffect(() => {
    const handleRouteChange = () => {
      setEmulatorType(getEmulatorTypeFromPath());
    };

    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handleRouteChange);
    
    // Listen for custom route change events
    window.addEventListener('routechange', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('routechange', handleRouteChange);
    };
  }, []);

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
