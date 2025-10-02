import React from 'react';
import { Message } from '../types';
import { MessagesDataTable } from './MessagesDataTable';

interface MessagesTabProps {
  messages: Message[];
  searchTerm: string;
  filterQueue: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onMessageSelect: (message: Message) => void;
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
