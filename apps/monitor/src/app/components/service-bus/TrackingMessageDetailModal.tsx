import React, { useState } from 'react';
import { TrackingMessage } from '@e2e-monitor/entities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Helper function to format status display text
const formatStatus = (status?: string): string => {
  if (!status) return 'Sent';
  if (status === 'received') return 'Completed';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

// Helper function to get badge variant based on status
const getStatusBadgeVariant = (status?: string) => {
  switch (status) {
    case 'received':
      return 'default';
    case 'sent':
      return 'secondary';
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

// Helper function to calculate processing duration
const calculateProcessingDuration = (sentAt: string | Date, receivedAt?: string | Date): string => {
  if (!receivedAt) return 'N/A';

  const sent = new Date(sentAt).getTime();
  const received = new Date(receivedAt).getTime();
  const durationMs = received - sent;

  if (durationMs < 0) return 'Invalid';

  // Convert to appropriate units
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(2)}s`;
  } else if (durationMs < 3600000) {
    return `${(durationMs / 60000).toFixed(2)}m`;
  } else {
    return `${(durationMs / 3600000).toFixed(2)}h`;
  }
};

interface TrackingMessageDetailModalProps {
  message: TrackingMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TrackingMessageDetailModal: React.FC<TrackingMessageDetailModalProps> = ({
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
              <label className="block text-sm font-bold uppercase text-gray-700 mb-1">Tracking Message Details</label>
              <Badge variant={getStatusBadgeVariant(message.status)} className="text-sm">
                {formatStatus(message.status)}
              </Badge>
            </div></DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
          {/* Top Section: ID, Sent By, Received By */}
          <div className="grid grid-cols-3 gap-4">
            <InfoBlock label="Message ID" value={message.messageId} />
            <InfoBlock label="Sent By" value={message.sentBy} />
            <InfoBlock label="Received By" value={message.receivedBy || 'N/A'} />
          </div>

          {/* Timestamps */}
          <Section title="Timestamps">
            <div className="grid grid-cols-3 gap-4">
              <InfoBlock label="Sent At" value={new Date(message.sentAt).toLocaleString()} />
              <InfoBlock label="Received At" value={message.receivedAt ? new Date(message.receivedAt).toLocaleString() : 'N/A'} />
               <InfoBlock label="Processing Duration" value={calculateProcessingDuration(message.sentAt, message.receivedAt)} />
            </div>
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
