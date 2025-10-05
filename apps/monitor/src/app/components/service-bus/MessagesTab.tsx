import React from 'react';
import { MessagesDataTable } from './MessagesDataTable';
import { DeadLetterMessage } from '../../hooks/useServiceBus';

interface MessagesTabProps {
  messages: DeadLetterMessage[];
  searchTerm: string;
  filterQueue: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onMessageSelect: (message: DeadLetterMessage) => void;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({
  messages,
  onMessageSelect,
}) => {
  return (
    <div>
      <MessagesDataTable
        messages={messages}
        onMessageSelect={onMessageSelect}
      />
    </div>
  );
};
