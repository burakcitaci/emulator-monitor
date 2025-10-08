import React from 'react';
import { MessagesDataTable } from './MessagesDataTable';
import { DeadLetterMessage } from '../../hooks/useServiceBus';

interface MessagesTabProps {
  messages: DeadLetterMessage[];
  searchTerm?: string;
  filterQueue?: string;
  onSearchChange?: (value: string) => void;
  onFilterChange?: (value: string) => void;
  onClearFilters?: () => void;
  onMessageSelect: (message: DeadLetterMessage) => void;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({
  messages,
  onMessageSelect,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Service Bus Messages</h2>
        <p className="text-muted-foreground">
          Monitor and inspect messages flowing through your Service Bus
          emulator.
        </p>
      </div>

      {/* Messages Table - Full width */}
      <div className="w-full">
        <MessagesDataTable
          messages={messages}
          onMessageSelect={onMessageSelect}
        />
      </div>
    </div>
  );
};
