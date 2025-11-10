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
    <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
      <div className="flex items-center space-x-3">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">
          Emulator Monitor
        </h1>
      </div>
    </div>
  );
};
