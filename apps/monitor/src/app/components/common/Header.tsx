import React from 'react';
import { DeadLetterMessage } from '../../hooks/useServiceBus';
import { ConnectionInfo, Message } from '@e2e-monitor/entities';

interface HeaderProps {
  connectionInfo: ConnectionInfo;
  messages: Message[];
  dlqMessages: DeadLetterMessage[];
}

export const Header: React.FC<HeaderProps> = ({
  connectionInfo,
  messages,
  dlqMessages,
}) => {
  return (
    <div className="flex items-center justify-between w-full space-x-2 gap-4">
      <div className="flex items-center space-x-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">
            Emulator Monitor
          </h1>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-muted/50 rounded-lg px-3 sm:px-4 py-2 border border-border/50">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground">
              Messages:{' '}
              <strong className="text-foreground">{messages.length}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground">
              DLQ:{' '}
              <strong className="text-foreground">{dlqMessages.length}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
