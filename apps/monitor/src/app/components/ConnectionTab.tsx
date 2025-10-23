import React, { useState, useEffect } from 'react';
import { ConnectionInfo, ConnectionForm } from '@e2e-monitor/entities';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useServiceBusConfig } from '../hooks/api/useServiceBusConfig';
import { Server, Database, AlertCircle, CheckCircle, TestTube, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

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
  onTest,
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const { config, loading, error, queuesAndTopics } = useServiceBusConfig();

  // Auto-expand settings when needed
  useEffect(() => {
    if (!form?.connectionString?.trim() || testResult) {
      setIsSettingsExpanded(true);
    }
  }, [form?.connectionString, testResult]);

  const extractEndpoint = (connectionString: string): string => {
    if (!connectionString?.trim()) return '';
    const match = connectionString.match(/Endpoint=([^;]+)/);
    return match ? match[1] : 'http://localhost:3000';
  };

  const handleTestConnection = async () => {
    if (!form?.connectionString?.trim() && !connectionInfo?.isLocal) {
      toast.error('Please enter a connection string or use local emulator');
      return;
    }

    setIsTesting(true);
    setIsSettingsExpanded(true);
    setTestResult(null);

    try {
      await onTest();
      setTestResult('success');
      toast.success('Connection test successful!');
    } catch (error) {
      setTestResult('error');
      const message = error instanceof Error ? error.message : 'Connection test failed';
      toast.error(`Connection test failed: ${message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const isConnected = testResult === 'success' || connectionInfo?.isConnected;
  const statusVariant = testResult === 'success' ? 'default' : testResult === 'error' ? 'destructive' : isConnected ? 'default' : 'destructive';
  const statusText = testResult === 'success' ? 'Passed' : testResult === 'error' ? 'Failed' : isConnected ? 'Connected' : 'Disconnected';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Service Bus Configuration</h2>
        <p className="text-muted-foreground">
          View and manage your Service Bus emulator configuration.
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Server className="h-5 w-5" />
              Connection Status & Settings
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure connection and view real-time status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              className="h-8 px-2"
            >
              {isSettingsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="ml-1 text-xs font-medium">
                {isSettingsExpanded ? 'Collapse' : 'Expand'}
              </span>
            </Button>
            {testResult ? (
              testResult === 'success' ? 
                <CheckCircle className="h-4 w-4 text-green-500 animate-pulse" /> :
                <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
            ) : isConnected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <Badge variant={statusVariant} className={testResult ? 'ring-2 ring-primary/20' : ''}>
              {statusText}
            </Badge>
            {testResult && (
              <button
                onClick={() => setTestResult(null)}
                className="ml-1 hover:bg-muted rounded-full p-0.5 transition-colors"
                title="Clear test result"
              >
                <span className="text-xs">×</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-sm text-muted-foreground">Type:</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                {connectionInfo?.isLocal ? 'Local Emulator' : 'Azure Cloud'}
              </Badge>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <span className="text-sm text-muted-foreground">Endpoint:</span>
            <p className="text-sm break-all mt-1">{connectionInfo.endpoint}</p>
          </div>
          <Button
            onClick={handleTestConnection}
            disabled={isTesting}
            variant={testResult === 'success' ? 'default' : testResult === 'error' ? 'destructive' : 'outline'}
            size="sm"
            className="min-w-[100px]"
          >
            {isTesting ? (
              <>
                <TestTube className="h-4 w-4 mr-2 animate-pulse" />
                Testing...
              </>
            ) : testResult === 'success' ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Passed
              </>
            ) : testResult === 'error' ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                Failed
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Test
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Configuration Display */}
      {loading ? (
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading configuration...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-card border rounded-lg p-6 text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Using fallback configuration</p>
        </div>
      ) : config ? (
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Database className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Service Bus Entities</h3>
          </div>

          {/* Entity Lists - 1x3 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Namespaces */}
            <EntityList
              title="Namespaces"
              icon="🏗️"
              count={config.UserConfig.Namespaces.length}
              items={config.UserConfig.Namespaces.map(ns => ns.Name)}
            />
            
            {/* Queues */}
            <EntityList
              title="Queues"
              icon="📦"
              count={queuesAndTopics.filter(q => q.type === 'queue').length}
              items={config.UserConfig.Namespaces.flatMap(ns => ns.Queues?.map(q => q.Name) || [])}
              mono
            />
            
            {/* Topics & Subscriptions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-label="topics" role="img">📡</span>
                <h4 className="font-medium text-sm">Topics & Subscriptions</h4>
                <Badge variant="outline" className="text-xs">
                  {queuesAndTopics.filter(q => q.type === 'topic').length}
                </Badge>
              </div>
              <div className="space-y-1">
                {config.UserConfig.Namespaces.map(namespace =>
                  namespace.Topics?.map(topic => (
                    <div key={topic.Name} className="p-2 bg-muted/30 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{topic.Name}</span>
                      </div>
                      {topic.Subscriptions && topic.Subscriptions.length > 0 && (
                        <div className="ml-4 mt-1 flex flex-wrap gap-1">
                          {topic.Subscriptions.map((sub, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs h-4">
                              {sub.Name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// Helper Components
const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-muted/50 rounded-lg p-3 text-center">
    <div className="text-xl font-bold text-primary">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const EntityList: React.FC<{ 
  title: string; 
  icon: string; 
  count: number; 
  items: string[];
  mono?: boolean;
}> = ({ title, icon, count, items, mono }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="text-lg" role="img">{icon}</span>
      <h4 className="font-medium text-sm">{title}</h4>
      <Badge variant="outline" className="text-xs">{count}</Badge>
    </div>
    <div className="space-y-1">
      {items.map(item => (
        <div key={item} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
          <span className="text-muted-foreground">•</span>
          <span className={mono ? 'font-medium' : 'font-medium'}>{item}</span>
        </div>
      ))}
    </div>
  </div>
);