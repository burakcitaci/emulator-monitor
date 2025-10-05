import React from 'react';
import { Activity } from 'lucide-react';
import { Message } from '../../types';
import { getStatusColor, getDirectionColor } from '../../utils/messageUtils';

interface MessageTableProps {
  messages: Message[];
  onMessageSelect: (message: Message) => void;
}

export const MessageTable: React.FC<MessageTableProps> = ({
  messages,
  onMessageSelect,
}) => {
  if (messages.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No messages found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Queue/Topic
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Message ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Body Preview
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
                className={`hover:bg-indigo-50 transition-colors cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
                onClick={() => onMessageSelect(message)}
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDirectionColor(
                      message.direction
                    )}`}
                  >
                    {message.direction}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      message.status
                    )}`}
                  >
                    {message.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {message.id.substring(0, 12)}...
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <div className="max-w-md truncate font-mono text-xs">
                    {message.body.substring(0, 80)}
                    {message.body.length > 80 ? '...' : ''}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMessageSelect(message);
                    }}
                    className="text-indigo-600 hover:text-indigo-900 transition-colors"
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
          <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Queue
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Preview
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
                className={`hover:bg-indigo-50 transition-colors cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
                onClick={() => onMessageSelect(message)}
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
                  <div className="flex items-center space-x-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDirectionColor(
                        message.direction
                      )}`}
                    >
                      {message.direction}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      message.status
                    )}`}
                  >
                    {message.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="max-w-xs truncate font-mono text-xs">
                    {message.body.substring(0, 50)}
                    {message.body.length > 50 ? '...' : ''}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMessageSelect(message);
                    }}
                    className="text-indigo-600 hover:text-indigo-900 transition-colors"
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
              className={`p-4 hover:bg-indigo-50 transition-colors cursor-pointer ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
              onClick={() => onMessageSelect(message)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {message.queueName}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDirectionColor(
                        message.direction
                      )}`}
                    >
                      {message.direction}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        message.status
                      )}`}
                    >
                      {message.status}
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

                  <div className="text-xs text-gray-700 font-mono bg-gray-100 p-2 rounded">
                    <div className="truncate">
                      {message.body.substring(0, 60)}
                      {message.body.length > 60 ? '...' : ''}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-2 font-mono">
                    ID: {message.id.substring(0, 16)}...
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMessageSelect(message);
                    }}
                    className="text-indigo-600 hover:text-indigo-900 transition-colors text-sm font-medium"
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
