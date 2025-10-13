import { useContext } from 'react';
import { MonitorContext, MonitorContextType } from './monitor-provider';

export const useMonitor = (): MonitorContextType => {
  const context = useContext(MonitorContext);
  if (context === undefined) {
    throw new Error('useMonitor must be used within a MonitorProvider');
  }
  return context;
};
