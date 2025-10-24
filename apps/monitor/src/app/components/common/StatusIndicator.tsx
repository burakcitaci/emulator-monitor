import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

interface StatusIndicatorProps {
  label: string;
  status: 'success' | 'error' | 'warning' | 'checking';
  count?: number;
  animate?: boolean;
  showCount?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  label,
  status,
  count,
  animate = false,
  showCount = true,
}) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'success':
        return { color: 'bg-green-500', icon: CheckCircle, textColor: 'text-green-600 dark:text-green-400' };
      case 'error':
        return { color: 'bg-red-500', icon: AlertCircle, textColor: 'text-red-600 dark:text-red-400' };
      case 'warning':
        return { color: 'bg-yellow-500', icon: AlertTriangle, textColor: 'text-yellow-600 dark:text-yellow-400' };
      case 'checking':
        return { color: 'bg-gray-400', icon: AlertTriangle, textColor: 'text-gray-600 dark:text-gray-400' };
      default:
        return { color: 'bg-gray-400', icon: AlertTriangle, textColor: 'text-gray-600 dark:text-gray-400' };
    }
  };

  const { color, icon: Icon, textColor } = getStatusInfo();

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${color} ${animate ? 'animate-pulse' : ''}`}></div>
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {label}
       
       
      </span>
    </div>
  );
};
