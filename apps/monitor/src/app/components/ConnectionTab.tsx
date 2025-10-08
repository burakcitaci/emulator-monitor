import React from 'react';
import { ConnectionInfo, ConnectionForm } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface ConnectionTabProps {
  connectionInfo: ConnectionInfo;
  form: ConnectionForm;
  onFormChange: (form: ConnectionForm) => void;
  onUpdate: () => void;
  onTest: () => void;
  onReset: () => void;
}

export const ConnectionTab: React.FC<ConnectionTabProps> = ({
  connectionInfo,
  form,
  onFormChange,
  onUpdate,
  onTest,
  onReset,
}) => {
  // Default connection info to prevent undefined errors
  const safeConnectionInfo = connectionInfo || {
    isConnected: false,
    isLocal: true,
    endpoint: '',
    connectionString: '',
  };

  // Default form to prevent undefined errors
  const safeForm = form || {
    connectionString: '',
    queues: '',
  };

  const handleInputChange = (field: keyof ConnectionForm, value: string) => {
    onFormChange({ ...safeForm, [field]: value });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status:</span>
            <Badge
              variant={
                safeConnectionInfo.isConnected ? 'default' : 'destructive'
              }
            >
              {safeConnectionInfo.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium">
              {safeConnectionInfo.isLocal ? 'Local Emulator' : 'Azure Cloud'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Endpoint:</span>
            <span className="font-medium text-sm break-all">
              {safeConnectionInfo.endpoint}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="connection-string">Connection String</Label>
        <Input
          id="connection-string"
          type="text"
          value={safeForm.connectionString}
          onChange={(e) =>
            handleInputChange('connectionString', e.target.value)
          }
          className="font-mono text-sm"
          placeholder="Endpoint=sb://localhost;SharedAccessKeyName=..."
        />
        <p className="text-sm text-muted-foreground">
          Leave empty to use local emulator default
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="queues">Queues to Monitor (comma-separated)</Label>
        <Input
          id="queues"
          type="text"
          value={safeForm.queues}
          onChange={(e) => handleInputChange('queues', e.target.value)}
          placeholder="test-queue,orders-queue,notifications-queue"
        />
      </div>

      <div className="flex space-x-3">
        <Button onClick={onUpdate} className="flex-1">
          Update Connection
        </Button>
        <Button onClick={onTest} variant="outline">
          Test
        </Button>
        <Button onClick={onReset} variant="secondary">
          Reset
        </Button>
      </div>
    </div>
  );
};
