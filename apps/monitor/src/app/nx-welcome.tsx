import React, { useState, useEffect } from 'react';
import {
  Activity,
  Send,
  Trash2,
  RefreshCw,
  Database,
  Wifi,
  WifiOff,
  Filter,
  Search,
  X,
} from 'lucide-react';

// -------------------- TYPES --------------------
type Message = {
  id: string;
  queueName: string;
  body: string;
  properties: Record<string, any>;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  status: 'processing' | 'completed' | 'sent' | 'failed' | 'replayed';
  isDeadLetter: boolean;
};

type ConnectionInfo = {
  isConnected: boolean;
  isLocal: boolean;
  endpoint: string;
  connectionString: string;
};

type SendForm = {
  queueName: string;
  body: string;
  properties: string;
};

type ConnectionForm = {
  connectionString: string;
  queues: string;
};

// -------------------- COMPONENT --------------------
export default function ServiceBusMonitor() {
  const [activeTab, setActiveTab] = useState<
    'messages' | 'send' | 'dlq' | 'connection'
  >('messages');

  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionInfo] = useState<ConnectionInfo>({
    isConnected: true,
    isLocal: true,
    endpoint: 'localhost',
    connectionString: '',
  });
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filterQueue, setFilterQueue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [sendForm, setSendForm] = useState<SendForm>({
    queueName: 'errm-policy-triggered',
    body: '',
    properties: '',
  });

  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    connectionString: '',
    queues: 'test-queue,orders-queue',
  });

  const [dlqQueue, setDlqQueue] = useState('errm-policy-triggered');
  const [dlqMessages, setDlqMessages] = useState<Message[]>([]);

  // -------------------- INIT --------------------
  useEffect(() => {
    const initialMessages: Message[] = [
      {
        id: 'msg-001',
        queueName: 'errm-policy-triggered',
        body: '{"policyId": "P001", "violation": "speed", "timestamp": "2024-01-15T10:30:00Z"}',
        properties: { severity: 'high', source: 'api' },
        timestamp: new Date(Date.now() - 300000).toISOString(),
        direction: 'incoming',
        status: 'completed',
        isDeadLetter: false,
      },
      {
        id: 'msg-002',
        queueName: 'test-queue',
        body: '{"orderId": "12345", "customerId": "user-123", "amount": 99.99}',
        properties: { correlationId: 'abc123' },
        timestamp: new Date(Date.now() - 240000).toISOString(),
        direction: 'outgoing',
        status: 'sent',
        isDeadLetter: false,
      },
      {
        id: 'msg-003',
        queueName: 'errm-policy-triggered',
        body: '{"policyId": "P002", "violation": "timeout"}',
        properties: { severity: 'medium' },
        timestamp: new Date(Date.now() - 180000).toISOString(),
        direction: 'incoming',
        status: 'processing',
        isDeadLetter: false,
      },
    ];
    setMessages(initialMessages);

    const dlq: Message[] = [
      {
        id: 'msg-dlq-001',
        queueName: 'errm-policy-triggered',
        body: '{"policyId": "P999", "error": "Invalid format"}',
        properties: { severity: 'high', retryCount: 3 },
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        direction: 'incoming',
        status: 'failed',
        isDeadLetter: true,
      },
    ];
    setDlqMessages(dlq);
  }, []);

  // -------------------- HANDLERS --------------------
  const handleSendMessage = () => {
    let parsedProps: Record<string, any> = {};
    try {
      parsedProps = sendForm.properties ? JSON.parse(sendForm.properties) : {};
    } catch {
      alert('Invalid JSON in properties');
      return;
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      queueName: sendForm.queueName,
      body: sendForm.body,
      properties: parsedProps,
      timestamp: new Date().toISOString(),
      direction: 'outgoing',
      status: 'sent',
      isDeadLetter: false,
    };
    setMessages([newMessage, ...messages]);
    setSendForm({ ...sendForm, body: '', properties: '' });
  };

  const handleReplayMessage = (messageId: string) => {
    setDlqMessages(dlqMessages.filter((m) => m.id !== messageId));
    const replayed = dlqMessages.find((m) => m.id === messageId);
    if (replayed) {
      setMessages([
        {
          ...replayed,
          status: 'replayed',
          isDeadLetter: false,
          timestamp: new Date().toISOString(),
        },
        ...messages,
      ]);
    }
  };

  const getStatusColor = (status: Message['status']) => {
    const colors: Record<Message['status'], string> = {
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      sent: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      replayed: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDirectionColor = (direction: Message['direction']) => {
    return direction === 'incoming'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-sky-100 text-sky-800';
  };

  const filteredMessages = messages.filter((msg) => {
    const matchesQueue = !filterQueue || msg.queueName === filterQueue;
    const matchesSearch =
      !searchTerm ||
      msg.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesQueue && matchesSearch;
  });

  const uniqueQueues = [...new Set(messages.map((m) => m.queueName))];

  // -------------------- JSX --------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Service Bus Monitor
                </h1>
                <p className="text-sm text-gray-500">
                  Real-time message monitoring
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
              <div className="flex items-center space-x-3 bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600">
                    Incoming:{' '}
                    <strong>
                      {
                        messages.filter((m) => m.direction === 'incoming')
                          .length
                      }
                    </strong>
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600">
                    Outgoing:{' '}
                    <strong>
                      {
                        messages.filter((m) => m.direction === 'outgoing')
                          .length
                      }
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
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'messages', name: 'Messages', icon: Activity },
                { id: 'send', name: 'Send Message', icon: Send },
                { id: 'dlq', name: 'Dead Letter Queue', icon: Trash2 },
                { id: 'connection', name: 'Connection', icon: Database },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex items-center space-x-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search messages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={filterQueue}
                      onChange={(e) => setFilterQueue(e.target.value)}
                      className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">All Queues</option>
                      {uniqueQueues.map((queue) => (
                        <option key={queue} value={queue}>
                          {queue}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(searchTerm || filterQueue) && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setFilterQueue('');
                      }}
                      className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Messages List */}
                <div className="space-y-3">
                  {filteredMessages.map((message) => (
                    <div
                      key={message.id}
                      onClick={() => setSelectedMessage(message)}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer hover:border-indigo-300"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleString()}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {message.queueName}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getDirectionColor(
                              message.direction
                            )}`}
                          >
                            {message.direction}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              message.status
                            )}`}
                          >
                            {message.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {message.id}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded p-3 font-mono text-sm text-gray-700">
                        {message.body.substring(0, 100)}
                        {message.body.length > 100 ? '...' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send Message Tab */}
            {activeTab === 'send' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Queue/Topic Name
                  </label>
                  <input
                    type="text"
                    value={sendForm.queueName}
                    onChange={(e) =>
                      setSendForm({ ...sendForm, queueName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="errm-policy-triggered"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message Body (JSON)
                  </label>
                  <textarea
                    value={sendForm.body}
                    onChange={(e) =>
                      setSendForm({ ...sendForm, body: e.target.value })
                    }
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                    placeholder='{"policyId": "P001", "violation": "speed", "timestamp": "2024-01-15T10:30:00Z"}'
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Properties (JSON, Optional)
                  </label>
                  <textarea
                    value={sendForm.properties}
                    onChange={(e) =>
                      setSendForm({ ...sendForm, properties: e.target.value })
                    }
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                    placeholder='{"severity": "high", "source": "api"}'
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!sendForm.queueName || !sendForm.body}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>Send Message</span>
                </button>
              </div>
            )}

            {/* DLQ Tab */}
            {activeTab === 'dlq' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Queue/Topic
                    </label>
                    <select
                      value={dlqQueue}
                      onChange={(e) => setDlqQueue(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {uniqueQueues.map((queue) => (
                        <option key={queue} value={queue}>
                          {queue}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">{dlqMessages.length}</span>{' '}
                    messages in dead letter queue
                  </div>
                </div>
                {dlqMessages.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No dead letter messages</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dlqMessages.map((message) => (
                      <div
                        key={message.id}
                        className="bg-red-50 border border-red-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs text-red-600 font-medium">
                              DLQ
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                              {message.queueName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {message.id}
                          </span>
                        </div>
                        <div className="bg-white rounded p-3 font-mono text-sm text-gray-700 mb-3">
                          {message.body}
                        </div>
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => handleReplayMessage(message.id)}
                            className="px-4 py-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center space-x-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Replay</span>
                          </button>
                          <button className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Connection Tab */}
            {activeTab === 'connection' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Connection String
                  </label>
                  <input
                    type="text"
                    value={connectionForm.connectionString}
                    onChange={(e) =>
                      setConnectionForm({
                        ...connectionForm,
                        connectionString: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Endpoint=sb://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Queues (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={connectionForm.queues}
                    onChange={(e) =>
                      setConnectionForm({
                        ...connectionForm,
                        queues: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="queue1,queue2,queue3"
                  />
                </div>
                <button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Connect</span>
                </button>

                <div className="mt-8 bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Connection Status
                  </h3>
                  <div className="flex items-center space-x-2">
                    {connectionInfo.isConnected ? (
                      <Wifi className="w-5 h-5 text-green-500" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-500" />
                    )}
                    <span
                      className={`font-medium ${
                        connectionInfo.isConnected
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {connectionInfo.isConnected
                        ? 'Connected'
                        : 'Disconnected'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {connectionInfo.endpoint}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-medium text-gray-900">
                Message Details
              </h2>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message ID
                  </label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">
                    {selectedMessage.id}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Queue
                  </label>
                  <p className="text-sm">{selectedMessage.queueName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timestamp
                  </label>
                  <p className="text-sm">
                    {new Date(selectedMessage.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      selectedMessage.status
                    )}`}
                  >
                    {selectedMessage.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Direction
                  </label>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getDirectionColor(
                      selectedMessage.direction
                    )}`}
                  >
                    {selectedMessage.direction}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Properties
                  </label>
                  <pre className="bg-gray-50 p-3 rounded text-sm font-mono overflow-x-auto">
                    {JSON.stringify(selectedMessage.properties, null, 2)}
                  </pre>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Body
                  </label>
                  <pre className="bg-gray-50 p-3 rounded text-sm font-mono overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedMessage.body), null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              >
                Close
              </button>
              <button className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
