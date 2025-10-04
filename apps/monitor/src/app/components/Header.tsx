import React from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { ConnectionInfo, Message } from '../types';

interface HeaderProps {
  connectionInfo: ConnectionInfo;
  messages: Message[];
  dlqMessages: Message[];
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
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
            Emulator Monitor
          </h1>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="flex items-center space-x-2">
          {connectionInfo.isConnected ? (
            <Wifi className="w-5 h-5 text-green-500" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-500" />
          )}
          <span className="text-sm font-medium text-gray-700">
            {connectionInfo.isLocal ? 'Local Emulator' : 'Azure Cloud'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-gray-100 rounded-lg px-3 sm:px-4 py-2">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">
              In:{' '}
              <strong>
                {messages.filter((m) => m.direction === 'incoming').length}
              </strong>
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">
              Out:{' '}
              <strong>
                {messages.filter((m) => m.direction === 'outgoing').length}
              </strong>
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">
              DLQ: <strong>{dlqMessages.length}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
