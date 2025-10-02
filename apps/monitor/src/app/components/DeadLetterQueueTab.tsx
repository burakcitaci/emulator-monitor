import React from 'react';
import { Trash2 } from 'lucide-react';
import { Message } from '../types';
import { DLQDataTable } from './DLQDataTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

interface DeadLetterQueueTabProps {
  dlqMessages: Message[];
  dlqQueue: string;
  uniqueQueues: string[];
  onQueueChange: (queue: string) => void;
  onReplay: (messageId: string) => void;
  onView: (message: Message) => void;
}

export const DeadLetterQueueTab: React.FC<DeadLetterQueueTabProps> = ({
  dlqMessages,
  dlqQueue,
  uniqueQueues,
  onQueueChange,
  onReplay,
  onView,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Label>Select Queue/Topic</Label>
          <Select value={dlqQueue} onValueChange={onQueueChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select queue or topic..." />
            </SelectTrigger>
            <SelectContent>
              {uniqueQueues.map((queue) => (
                <SelectItem key={queue} value={queue}>
                  {queue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2 bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">
          <Trash2 className="w-5 h-5 text-destructive" />
          <span className="text-sm text-muted-foreground">
            <Badge variant="destructive" className="mr-1">
              {dlqMessages.length}
            </Badge>
            messages in DLQ
          </span>
        </div>
      </div>

      <DLQDataTable
        messages={dlqMessages}
        onReplay={onReplay}
        onView={onView}
      />
    </div>
  );
};
