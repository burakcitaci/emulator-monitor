import { ContainerSidebar } from './components/ContainerSidebar';
import NxWelcome from './nx-welcome';

export function App() {
  return (
    <div className="flex h-screen bg-background">
      <ContainerSidebar />
      <NxWelcome />
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
