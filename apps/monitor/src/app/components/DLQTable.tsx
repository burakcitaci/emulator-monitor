import React from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Message } from '../types';

interface DLQTableProps {
  messages: Message[];
  onReplay: (messageId: string) => void;
  onView: (message: Message) => void;
}

export const DLQTable: React.FC<DLQTableProps> = ({
  messages,
  onReplay,
  onView,
}) => {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50">
        <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No dead letter messages</p>
        <p className="text-sm text-gray-500 mt-1">
          Failed messages will appear here
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-red-50 to-pink-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Queue/Topic
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Message ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Error Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Properties
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {messages.map((message, index) => (
              <tr
                key={message.id}
                className={`hover:bg-red-50 transition-colors ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(message.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {message.queueName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {message.id.substring(0, 12)}...
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-700 font-mono bg-red-50 px-3 py-2 rounded max-w-md truncate">
                    {message.body.substring(0, 60)}
                    {message.body.length > 60 ? '...' : ''}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(message.properties)
                      .slice(0, 2)
                      .map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {key}: {String(value)}
                        </span>
                      ))}
                    {Object.keys(message.properties).length > 2 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                        +{Object.keys(message.properties).length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => onReplay(message.id)}
                    className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium rounded-md hover:from-indigo-700 hover:to-purple-700 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Replay
                  </button>
                  <button
                    onClick={() => onView(message)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tablet View */}
      <div className="hidden md:block lg:hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-red-50 to-pink-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Queue
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Error
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {messages.map((message, index) => (
              <tr
                key={message.id}
                className={`hover:bg-red-50 transition-colors ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {new Date(message.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {message.queueName}
                  </div>
                  <div className="text-xs text-gray-500 font-mono mt-1">
                    {message.id.substring(0, 12)}...
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-700 font-mono bg-red-50 px-2 py-1 rounded max-w-xs truncate">
                    {message.body.substring(0, 40)}
                    {message.body.length > 40 ? '...' : ''}
                  </div>
                  {Object.keys(message.properties).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(message.properties)
                        .slice(0, 1)
                        .map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                      {Object.keys(message.properties).length > 1 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                          +{Object.keys(message.properties).length - 1}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-1">
                  <button
                    onClick={() => onReplay(message.id)}
                    className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium rounded hover:from-indigo-700 hover:to-purple-700 transition-all"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Replay
                  </button>
                  <button
                    onClick={() => onView(message)}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden">
        <div className="divide-y divide-gray-200">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`p-4 hover:bg-red-50 transition-colors ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {message.queueName}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Failed
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mb-2">
                    {new Date(message.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  <div className="text-xs text-gray-700 font-mono bg-red-50 p-2 rounded mb-2">
                    <div className="truncate">
                      {message.body.substring(0, 50)}
                      {message.body.length > 50 ? '...' : ''}
                    </div>
                  </div>

                  {Object.keys(message.properties).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(message.properties)
                        .slice(0, 2)
                        .map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                      {Object.keys(message.properties).length > 2 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                          +{Object.keys(message.properties).length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 font-mono">
                    ID: {message.id.substring(0, 16)}...
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0 flex flex-col space-y-1">
                  <button
                    onClick={() => onReplay(message.id)}
                    className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-medium rounded hover:from-indigo-700 hover:to-purple-700 transition-all"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Replay
                  </button>
                  <button
                    onClick={() => onView(message)}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
