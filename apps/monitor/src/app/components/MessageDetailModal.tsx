import React from 'react';
import { X } from 'lucide-react';
import { Message } from '../types';

interface MessageDetailModalProps {
  message: Message | null;
  onClose: () => void;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({
  message,
  onClose,
}) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Message Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message ID
                </label>
                <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                  {message.id}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Queue/Topic
                </label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {message.queueName}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direction
                </label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    message.direction === 'incoming'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {message.direction}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    message.status === 'processing'
                      ? 'bg-yellow-100 text-yellow-800'
                      : message.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : message.status === 'sent'
                      ? 'bg-blue-100 text-blue-800'
                      : message.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {message.status}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timestamp
                </label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {new Date(message.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Properties
                </label>
                <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
                  {JSON.stringify(message.properties, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message Body
            </label>
            <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto max-h-64">
              {JSON.stringify(JSON.parse(message.body), null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
