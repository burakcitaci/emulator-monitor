import React, { useState } from 'react';
import { Message } from '@e2e-monitor/entities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MessageState } from './MessagesDataTable';

// Helper function to format status display text
const formatStatus = (status?: string): string => {
  if (!status) return 'Active';
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to get badge variant based on status
const getStatusBadgeVariant = (status?: string) => {
  switch (status) {
    case MessageState.ACTIVE:
      return 'default';
    case MessageState.DEAD_LETTERED:
      return 'destructive';
    case MessageState.DEFERRED:
      return 'secondary';
    case MessageState.SCHEDULED:
      return 'default';
    default:
      return 'secondary';
  }
};

// Helper function to format body content
const formatBody = (body: unknown): string => {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  } else if (typeof body === 'object' && body !== null) {
    return JSON.stringify(body, null, 2);
  }
  return String(body || 'No body content');
};

interface MessageDetailModalProps {
  message: Message | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({
  message,
  open,
  onOpenChange,
}) => {
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Message Details</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] space-y-4">
          {/* 2x2 Matrix Layout */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message ID
              </label>
              <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                {message.messageId}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {message.subject || 'N/A'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Badge variant={getStatusBadgeVariant(message.state)} className="text-xs">
                {formatStatus(message.state)}
              </Badge>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Properties
              </label>
              <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
                {message.properties && Object.keys(message.properties).length > 0
                  ? JSON.stringify(message.properties, null, 2)
                  : 'No properties'
                }
              </pre>
            </div>
          </div>

          {/* Time fields in a row below the matrix */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Created At
              </label>
              <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {message.createdAt ? message.createdAt.toLocaleString() : 'N/A'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timestamp
              </label>
              <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {message.timestamp ? message.timestamp.toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>

          {/* Message Body spanning full width */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Message Body
              </label>
              {message.body && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBodyExpanded(!isBodyExpanded)}
                  className="h-6 px-2 text-xs"
                >
                  {isBodyExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Hide Body
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show Body
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${
              isBodyExpanded ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                {message.body ? formatBody(message.body) : 'No body content'}
              </pre>
            </div>
            {!message.body && (
              <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded">
                No body content
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
