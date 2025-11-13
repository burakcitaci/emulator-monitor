import React from 'react';

interface HeaderProps {
  connectionInfo: any;
  messages: any[];
  dlqMessages: any[];
  serviceBusConfig?: any;
  onServiceBusInitialized?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Service Bus Message Monitor</h2>
    </div>
  );
};
