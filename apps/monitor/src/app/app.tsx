import React from 'react';

import {
  SidebarInset,
  SidebarProvider,
} from './components/ui/sidebar';
import { Messages } from './components/service-bus/Messages';
import { AppSidebar } from './components/containers/ContainerSidebar';
import { SiteHeader } from './components/common/SiteHeader';


export function App() {
  const cookieStore = document.cookie
    .split('; ')
    .map((v) => v.split('='))
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

  const defaultOpen = cookieStore['sidebar_state'] === 'true';
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
        } as React.CSSProperties
      }
    >

      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <Messages />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
