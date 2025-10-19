import React from 'react';
import { Activity } from 'lucide-react';
import { getStatusColor, getDirectionColor } from '../../utils/messageUtils';
import { Message } from '@emulator-monitor/entities';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

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
      <Card>
        <CardContent className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No messages found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader className="bg-gradient-to-r h-4 from-indigo-50 to-purple-50">
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Queue/Topic</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message ID</TableHead>
              <TableHead>Body Preview</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((message, index) => (
              <TableRow
                key={message.id}
                className={`hover:bg-indigo-50 transition-colors p-0 cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
                onClick={() => onMessageSelect(message)}
              >
                <TableCell className="text-sm text-gray-600">
                  {new Date(message.timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{message.subject}</div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDirectionColor(
                      message.direction
                    )}`}
                  >
                    {message.direction}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      message.status
                    )}`}
                  >
                    {message.status}
                  </span>
                </TableCell>
                <TableCell className="font-mono">
                  {message.id.substring(0, 12)}...
                </TableCell>
                <TableCell>
                  <div className="max-w-md truncate font-mono text-xs">
                    {message.body.substring(0, 80)}
                    {message.body.length > 80 ? '...' : ''}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMessageSelect(message);
                    }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden">
        <div className="space-y-2">
          {messages.map((message) => (
            <Card
              key={message.id}
              className="cursor-pointer hover:bg-indigo-50 transition-colors"
              onClick={() => onMessageSelect(message)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{message.subject}</span>
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

                    <div className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>

                    <div className="text-xs font-mono bg-gray-100 p-2 rounded">
                      {message.body.substring(0, 60)}
                      {message.body.length > 60 ? '...' : ''}
                    </div>

                    <div className="text-xs text-gray-500 font-mono">
                      ID: {message.id.substring(0, 16)}...
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMessageSelect(message);
                    }}
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
