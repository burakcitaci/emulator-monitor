/* eslint-disable @typescript-eslint/no-explicit-any */
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
      return 'active';
    case MessageState.DEAD_LETTERED:
      return 'dead-lettered';
    case MessageState.DEFERRED:
      return 'deferred';
    case MessageState.SCHEDULED:
      return 'scheduled';
    case MessageState.EXPIRED:
      return 'expired';
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold"> 
            <div className='flex items-center justify-between px-4'>
              <label className="block text-sm font-bold uppercase text-gray-700 mb-1">Message Details</label>
              <Badge variant={getStatusBadgeVariant(message.state)} className="text-sm">
                {formatStatus(message.state)}
              </Badge>
            </div></DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
          {/* Top Section: ID, Subject, Status */}
          <div className="grid grid-cols-3 gap-4">
            <InfoBlock label="Message ID" value={message.messageId} />
            <InfoBlock
              label="Subject"
              value={
                typeof message.body === 'object' && message.body !== null && 'subject' in message.body
                  ? (message.body as any).subject?.toString() || 'N/A'
                  : message.properties?.subject?.toString() || 'N/A'
              }
            />
            <InfoBlock label="Created At" value={message.createdAt?.toLocaleString() || 'N/A'} />
           
          </div>

          {/* Properties */}
          <Section title="Properties">
            <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
              {message.properties && Object.keys(message.properties).length > 0
                ? JSON.stringify(message.properties, null, 2)
                : 'No properties'}
            </pre>
          </Section>

          {/* Metadata */}
          <Section title="Metadata">
            <div className="grid grid-cols-3 gap-4">
              <InfoBlock label="Enqueued Time UTC" value={message.enqueuedTimeUtc?.toLocaleString() || 'N/A'} />
              <InfoBlock label="Last Seen At" value={message.lastSeenAt?.toLocaleString() || 'N/A'} />
              <InfoBlock label="Delivery Count" value={message.deliveryCount ?? 'N/A'} />
              <InfoBlock label="Max Delivery Count" value={message.maxDeliveryCount ?? 'N/A'} />
              <InfoBlock label="Sequence Number" value={message.sequenceNumber ?? 'N/A'} />
              <InfoBlock label="Time to Live (ms)" value={message.timeToLive ?? 'N/A'} />
              <InfoBlock label="Sent By" value={message.sentBy ?? 'N/A'} />
              <InfoBlock label="Received By" value={message.recievedBy ?? 'N/A'} />
              <InfoBlock label="Sent At" value={message.sentAt?.toLocaleString() || 'N/A'} />
              <InfoBlock label="Received At" value={message.recievedAt?.toLocaleString() || 'N/A'} />
            </div>
          </Section>

          {/* Application Properties */}
          <Section title="Application Properties">
            <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
              {message.applicationProperties && Object.keys(message.applicationProperties).length > 0
                ? JSON.stringify(message.applicationProperties, null, 2)
                : 'No application properties'}
            </pre>
          </Section>

          {/* Message Body */}
          <Section title="Message Body">
            {message.body ? (
              <>
                <div className="flex justify-end mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsBodyExpanded(!isBodyExpanded)}
                    className="h-6 px-2 text-xs"
                  >
                    {isBodyExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" /> Hide Body
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" /> Show Body
                      </>
                    )}
                  </Button>
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isBodyExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                    {formatBody(message.body)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded">No body content</div>
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Helper Components */
const InfoBlock: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{value}</p>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
    {children}
  </div>
);