import { useState } from 'react';
import { ConnectionForm, ConnectionInfo } from '@e2e-monitor/entities';

export const useConnection = (serviceBusConfig: any) => {
  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    connectionString: '',
    queues: 'test-queue,orders-queue',
  });

  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    isConnected: false,
    isLocal: true,
    endpoint: 'http://localhost:3000',
    connectionString: '',
  });

  const updateConnectionInfo = (form: ConnectionForm) => {
    const endpoint = form.connectionString.trim() === ''
      ? 'http://localhost:3000'
      : form.connectionString.match(/Endpoint=([^;]+)/)?.[1] || 'Azure Service Bus';

    setConnectionInfo({
      isConnected: form.connectionString.trim() !== '' || serviceBusConfig !== null,
      isLocal: form.connectionString.trim() === '',
      endpoint: endpoint,
      connectionString: form.connectionString,
    });
  };

  const handleConnectionFormChange = (form: ConnectionForm) => {
    setConnectionForm(form);
    updateConnectionInfo(form);
  };

  const resetConnection = () => {
    setConnectionInfo({
      isConnected: false,
      isLocal: true,
      endpoint: 'http://localhost:3000',
      connectionString: '',
    });
    setConnectionForm({
      connectionString: '',
      queues: 'test-queue,orders-queue',
    });
  };

  return {
    connectionForm,
    connectionInfo,
    setConnectionInfo,
    handleConnectionFormChange,
    updateConnectionInfo,
    resetConnection,
  };
};
