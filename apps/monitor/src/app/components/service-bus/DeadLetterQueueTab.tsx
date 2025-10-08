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
import { useServiceBusConfig } from '../../hooks/useServiceBusConfig';

interface DeadLetterQueueTabProps {
  onReplay: (messageId: string) => void;
  onView: (message: DeadLetterMessage) => void;
}

export const DeadLetterQueueTab: React.FC<DeadLetterQueueTabProps> = ({
  onReplay,
  onView,
}) => {
  const { getDeadLetterMessages } = useServiceBus();
  const { queuesAndTopics } = useServiceBusConfig();
  const [messages, setMessages] = useState<DeadLetterMessageResponse>();
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  // Get entities that can have DLQ (queues and subscriptions)
  const getDLQEntities = () => {
    return queuesAndTopics.filter(
      (item) => item.type === 'queue' || item.type === 'subscription'
    );
  };

  const handleEntityChange = (entityName: string) => {
    setSelectedEntity(entityName);
    const entity = queuesAndTopics.find((item) => item.name === entityName);
    if (entity) {
      setSelectedNamespace(entity.namespace);
    }
  };

  useEffect(() => {
    if (!selectedEntity || !selectedNamespace) return;

    const fetchDLQMessages = async () => {
      try {
        const entity = queuesAndTopics.find(
          (item) => item.name === selectedEntity
        );
        if (!entity) return;

        let dlqOptions;

        if (entity.type === 'queue') {
          // For queues, we use the queue name as topic and empty subscription
          dlqOptions = {
            namespace: selectedNamespace,
            topic: entity.name,
            subscription: '', // Empty for queues
            maxMessages: 20,
            maxWaitTimeInSeconds: 10,
          };
        } else if (entity.type === 'subscription') {
          // For subscriptions, we need the parent topic
          dlqOptions = {
            namespace: selectedNamespace,
            topic: entity.parentTopic || '',
            subscription: entity.name,
            maxMessages: 20,
            maxWaitTimeInSeconds: 10,
          };
        }

        if (dlqOptions) {
          const dlqMessages = await getDeadLetterMessages(dlqOptions);
          setMessages(dlqMessages);
        }
      } catch (err) {
        console.error('Failed to fetch DLQ messages:', err);
        setMessages({
          success: false,
          messageCount: 0,
          messages: [],
          entityPath: '',
        });
      }
    };

    fetchDLQMessages();
  }, [
    selectedEntity,
    selectedNamespace,
    getDeadLetterMessages,
    queuesAndTopics,
  ]);
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Dead Letter Queue</h2>
          <p className="text-muted-foreground">
            Monitor and manage messages that failed processing in your Service
            Bus emulator.
          </p>
        </div>

        <div className="flex items-center justify-between p-6 bg-card border rounded-lg">
          <div className="space-y-2">
            <Label className="text-base font-medium">
              Select Queue/Subscription
            </Label>
            <Select value={selectedEntity} onValueChange={handleEntityChange}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select queue or subscription..." />
              </SelectTrigger>
              <SelectContent>
                {getDLQEntities().map((entity) => (
                  <SelectItem key={entity.name} value={entity.name}>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        {entity.type}
                      </span>
                      <span>{entity.name}</span>
                      {entity.type === 'subscription' && entity.parentTopic && (
                        <span className="text-xs text-muted-foreground">
                          ({entity.parentTopic})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-3 bg-destructive/10 px-4 py-3 rounded-lg border border-destructive/20">
            <Trash2 className="w-5 h-5 text-destructive" />
            <span className="text-sm font-medium">
              <Badge variant="destructive" className="mr-2">
                {messages?.messages?.length || 0}
              </Badge>
              messages in DLQ
            </span>
          </div>
        </div>
      </div>

      {/* Data Table - Full width */}
      <div className="w-full">
        <DLQDataTable
          messages={messages || ({} as DeadLetterMessageResponse)}
          onReplay={onReplay}
          onView={onView}
        />
      </div>
    </div>
  );
};
