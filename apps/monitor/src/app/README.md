# Service Bus Monitor - App Structure

## Overview

The Service Bus Monitor is a real-time monitoring application for Azure Service Bus. The app directory contains the main application logic and UI components.

## File Organization

### Core Application Files

#### `app.tsx` (Main Application)

The primary entry point for the Service Bus Monitor application.

- **ServiceBusMonitorView**: Main component that renders the full UI with sidebar, header, and navigation
- Uses context providers for global state management (MonitorProvider)
- Integrates with the Header and ContainerSidebar components
- Handles tab navigation and tab content rendering
- Features:
  - Real-time message display
  - Message sending functionality
  - Connection configuration
  - Loading and error states
  - Dark mode support

Exports: `App` component (wrapped with providers)

#### `nx-welcome.tsx` (Standalone Demo)

A standalone demo version of the Service Bus Monitor without providers or context.

- **StandaloneServiceBusMonitor**: Simplified component for testing or fallback scenarios
- Uses local state instead of global context
- Useful for:
  - Component testing and development
  - Storybook demonstrations
  - Debugging individual components
- **Note**: Not used in production - see `app.tsx` for the main application

### Directory Structure

```
src/app/
├── app.tsx                 # Main application (production)
├── nx-welcome.tsx         # Standalone demo version
├── layout.tsx             # Layout wrapper
├── providers.tsx          # Context providers
├── components/            # React components
│   ├── common/           # Shared components (Header, TabNavigation, etc.)
│   ├── service-bus/      # Service Bus specific components
│   ├── containers/       # Container/sidebar components
│   └── ui/              # Generic UI components
├── hooks/                # React hooks
│   ├── api/             # API-related hooks
│   └── context/         # Context providers
├── lib/                 # Utility functions
└── utils/               # Helper utilities
```

## Component Hierarchy

### Production (app.tsx)

```
<Providers>
  <MonitorProvider>
    <ServiceBusMonitorView>
      <SidebarProvider>
        <ContainerSidebar />
        <SidebarInset>
          <Header />
          <TabNavigation />
          <main>
            <MessagesTab />
            <SendMessageTab />
            <Configuration />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ServiceBusMonitorView>
  </MonitorProvider>
</Providers>
```

### Standalone Demo (nx-welcome.tsx)

```
<StandaloneServiceBusMonitor>
  <div>
    <TabNavigation />
    <div>
      <MessagesTab />
      <SendMessageTab />
      <Configuration />
    </div>
  </div>
</StandaloneServiceBusMonitor>
```

## State Management

### Global Context (used in app.tsx)

- **MonitorProvider**: Manages application-wide state via `useMonitor()` hook
  - activeTab, setActiveTab
  - sendForm, setSendForm
  - messages, setMessages
  - dlqMessages
  - connectionInfo, setConnectionInfo
  - sendMessage()
  - isLoading, error

### Local State (used in nx-welcome.tsx)

- Each component manages its own state independently

## Tab Types

- **messages**: View incoming messages
- **send**: Send test messages
- **configuration**: Configure Service Bus connection
- **dlq**: Dead letter queue (reserved)

## Styling

- Tailwind CSS for styling
- Support for light/dark modes
- Responsive design with sidebar navigation
- Consistent typography using Inter font (see styles.css)

## Entry Point

The application is mounted in `main.tsx` which imports and renders the `App` component from `app.tsx`.
