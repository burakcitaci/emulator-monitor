import { MessageStatus, MessageDirection } from '../types';

export const getStatusColor = (status: MessageStatus): string => {
  const colors: Record<MessageStatus, string> = {
    processing: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    sent: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    replayed: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getDirectionColor = (direction: MessageDirection): string => {
  return direction === 'incoming'
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-sky-100 text-sky-800';
};
