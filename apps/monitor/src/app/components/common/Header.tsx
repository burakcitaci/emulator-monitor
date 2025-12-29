import React from 'react';
import { ConnectionInfo, Message } from '@e2e-monitor/entities';
import { ServiceBusMessage } from '@azure/service-bus';

interface HeaderProps {
  connectionInfo: ConnectionInfo;
  messages: Message[];
  dlqMessages: ServiceBusMessage[];
  serviceBusConfig?: unknown;
  onServiceBusInitialized?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Service Bus Message Monitor</h2>
    </div>
  );
};
