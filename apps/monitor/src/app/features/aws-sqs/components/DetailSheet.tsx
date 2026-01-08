import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SqsMessageRow, TrackingMessage } from '../lib/entities';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../../components/ui/sheet';

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

// Helper Components
const InfoBlock: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded break-words">
      {value}
    </p>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
    {children}
  </div>
);

interface MessageDetailModalProps {
  isModalOpen: boolean;
  handleModalClose: () => void;
  selectedMessage: SqsMessageRow;
  selectedOriginalMessage: TrackingMessage;
  isBodyExpanded: boolean;
  setIsBodyExpanded: (expanded: boolean) => void;
}

const DetailSheet: React.FC<MessageDetailModalProps> = ({
  isModalOpen,
  handleModalClose,
  selectedMessage,
  selectedOriginalMessage,
  isBodyExpanded,
  setIsBodyExpanded,
}) => {
  
  return (
    <Sheet open={isModalOpen} onOpenChange={handleModalClose}>
      <SheetContent className="w-2/6 sm:max-w-4xl overflow-hidden">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">
            <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-bold uppercase text-gray-700 mb-1">
                  SQS Message Details
                </label>
                <Badge variant="outline" className="text-xs">
                  SQS
                </Badge>
              </div>
              {selectedOriginalMessage && (
                <Badge
                  variant={
                    selectedOriginalMessage.disposition === 'abandon'
                      ? 'secondary'
                      : 'default'
                  }
                  className="text-sm"
                >
                  {selectedOriginalMessage.disposition}
                </Badge>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {selectedOriginalMessage && (
          <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 p-4">
            {/* Top Section */}
            <div className="grid grid-cols-2 gap-4">
              <InfoBlock
                label="Message ID"
                value={
                  <span className="font-mono text-xs">
                    {selectedOriginalMessage.messageId}
                  </span>
                }
              />
              <InfoBlock
                label="Sent By"
                value={selectedOriginalMessage.sentBy || 'N/A'}
              />
            </div>

            {/* Timestamps */}
            <Section title="Timestamps">
              <div className="grid grid-cols-1 gap-4">
                <InfoBlock
                  label="Sent At"
                  value={
                    selectedOriginalMessage.sentAt
                      ? selectedOriginalMessage.sentAt.toLocaleString()
                      : 'N/A'
                  }
                />
              </div>
            </Section>

            {/* Message Body */}
            <Section title="Message Body">
              {selectedOriginalMessage.body ? (
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
                      isBodyExpanded
                        ? 'max-h-[500px] opacity-100'
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <pre className="text-xs text-gray-900 bg-gray-50 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                      {formatBody(selectedOriginalMessage.body)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded">
                  No body content
                </div>
              )}
            </Section>

            {/* Additional Info for Tracking Messages */}
            {selectedOriginalMessage && (
              <Section title="Tracking Information">
                <div className="grid grid-cols-2 gap-4">
                  <InfoBlock
                    label="Status"
                    value={selectedOriginalMessage.status || 'N/A'}
                  />
                  <InfoBlock
                    label="Received By"
                    value={selectedOriginalMessage.receivedBy || 'N/A'}
                  />
                  {selectedOriginalMessage.receivedAt && (
                    <InfoBlock
                      label="Received At"
                      value={new Date(
                        selectedOriginalMessage.receivedAt,
                      ).toLocaleString()}
                    />
                  )}
                </div>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default DetailSheet;