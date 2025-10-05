import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { DLQDataTable } from './DLQDataTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  DeadLetterMessage,
  DeadLetterMessageResponse,
  useServiceBus,
} from '../../hooks/useServiceBus';

interface DeadLetterQueueTabProps {
  dlqMessages: DeadLetterMessageResponse;
  dlqQueue: string;
  uniqueQueues: string[];
  onQueueChange: (queue: string) => void;
  onReplay: (messageId: string) => void;
  onView: (message: DeadLetterMessage) => void;
}

export const DeadLetterQueueTab: React.FC<DeadLetterQueueTabProps> = ({
  dlqMessages,
  dlqQueue,
  uniqueQueues,
  onQueueChange,
  onReplay,
  onView,
}) => {
  const { getDeadLetterMessages } = useServiceBus();
  const [messages, setMessages] = useState<DeadLetterMessageResponse>();
  useEffect(() => {
    // Define an async function inside useEffect
    const fetchDLQMessages = async () => {
      try {
        const dlqMessages = await getDeadLetterMessages({
          namespace: 'solution-monitor-ns',
          topic: 'system-messages',
          subscription: 'funcapp-processor-dev',
          maxMessages: 20,
          maxWaitTimeInSeconds: 10,
        });

        dlqMessages.messages.forEach((msg) => {
          console.log('Message:', msg);
          console.log('Dead Letter Reason:', msg.deadLetterReason);
        });
        setMessages(dlqMessages);
      } catch (err) {
        console.error('Failed to fetch DLQ messages:', err);
      }
    };

    fetchDLQMessages();
  }, [getDeadLetterMessages]); // Add getDeadLette
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
              {messages?.messages?.length || 0}
            </Badge>
            messages in DLQ
          </span>
        </div>
      </div>

      <DLQDataTable
        messages={messages || ({} as DeadLetterMessageResponse)}
        onReplay={onReplay}
        onView={onView}
      />
    </div>
  );
};
