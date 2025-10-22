import React, { useState } from 'react';
import { DeadLetterMessage } from '../../hooks/api/useServiceBus';
import { ConnectionInfo, Message } from '@e2e-monitor/entities';
import { Button } from '../ui/button';
import { Loader2, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface HeaderProps {
  connectionInfo: ConnectionInfo;
  messages: Message[];
  dlqMessages: DeadLetterMessage[];
  serviceBusConfig?: any;
  onServiceBusInitialized?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionInfo,
  messages,
  dlqMessages,
  serviceBusConfig,
  onServiceBusInitialized,
}) => {
  const [isInitializingServiceBus, setIsInitializingServiceBus] = useState(false);

  const handleInitializeServiceBus = async () => {
    setIsInitializingServiceBus(true);
    try {
      const response = await fetch('http://localhost:3000/api/v1/servicebus/debug-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Service Bus initialized successfully!');
        onServiceBusInitialized?.();
        // Refresh the page to reload configuration
        window.location.reload();
      } else {
        toast.error(result.message || 'Failed to initialize Service Bus');
      }
    } catch (err) {
      console.error('Service Bus initialization failed:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to initialize Service Bus. Please check the backend logs.',
        { duration: 5000 }
      );
    } finally {
      setIsInitializingServiceBus(false);
    }
  };

  // Check if Service Bus is initialized by checking if we have config
  const isServiceBusInitialized = !!serviceBusConfig;

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
            <div className={`w-2 h-2 rounded-full animate-pulse ${isServiceBusInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-muted-foreground">
              Service Bus:{' '}
              <strong className="text-foreground">{isServiceBusInitialized ? 'Connected' : 'Not Initialized'}</strong>
            </span>
          </div>
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
          {!isServiceBusInitialized && (
            <Button
              onClick={handleInitializeServiceBus}
              disabled={isInitializingServiceBus}
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
            >
              {isInitializingServiceBus ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Init
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  Initialize
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
