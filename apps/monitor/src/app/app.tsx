import { ContainerSidebar } from './components/ContainerSidebar';
import NxWelcome from './nx-welcome';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from './components/ui/sidebar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbLink,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from './components/ui/breadcrumb';
import { Separator } from './components/ui/separator';
import { Header } from './components/Header';
export function App() {
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
                connectionInfo={{
                  connectionString: '',
                  endpoint: '',
                  isLocal: true,
                  isConnected: true,
                }}
                messages={[]}
                dlqMessages={[]}
              />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
            <NxWelcome />
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Emulator Monitor
              </h1>
              <p className="text-muted-foreground mt-2">
                Monitor and manage your Azure Service Bus emulator containers
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold">Quick Actions</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Container management and monitoring tools coming soon
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold">Service Bus Emulator</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Check the sidebar to see if your emulator is running
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold">Status</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Real-time status updates every 5 seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
}

export default App;
