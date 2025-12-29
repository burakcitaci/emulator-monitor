import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useReceiveServiceBusMessage, useServiceBusConfig } from '../../hooks/api/service-bus';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

interface ReceiveMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReceiveMessageModal: React.FC<ReceiveMessageModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [receiveMode, setReceiveMode] = useState<'queue' | 'topic'>('queue');
  const [queue, setQueue] = useState('__default__');
  const [topic, setTopic] = useState('');
  const [subscription, setSubscription] = useState('');
  const [receivedBy, setReceivedBy] = useState('');

  const receiveMutation = useReceiveServiceBusMessage();
  const { data: config } = useServiceBusConfig();

  // Extract queues from config
  const queues = useMemo(() => {
    if (!config?.UserConfig?.Namespaces) return [];
    const allQueues: string[] = [];
    config.UserConfig.Namespaces.forEach((namespace) => {
      if (namespace.Queues) {
        namespace.Queues.forEach((q) => {
          allQueues.push(q.Name);
        });
      }
    });
    return allQueues.sort();
  }, [config]);

  // Extract topics from config
  const topics = useMemo(() => {
    if (!config?.UserConfig?.Namespaces) return [];
    const allTopics: string[] = [];
    config.UserConfig.Namespaces.forEach((namespace) => {
      if (namespace.Topics) {
        namespace.Topics.forEach((t) => {
          allTopics.push(t.Name);
        });
      }
    });
    return allTopics.sort();
  }, [config]);

  // Get subscriptions for selected topic
  const subscriptions = useMemo(() => {
    if (!config?.UserConfig?.Namespaces || !topic) return [];
    for (const namespace of config.UserConfig.Namespaces) {
      const topicConfig = namespace.Topics?.find((t) => t.Name === topic);
      if (topicConfig?.Subscriptions) {
        return topicConfig.Subscriptions.map((s) => s.Name).sort();
      }
    }
    return [];
  }, [config, topic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receivedBy.trim()) {
      toast.error('Received By is required');
      return;
    }

    // Validate selection based on receive mode
    if (receiveMode === 'queue' && queue === '__default__' && !queue.trim()) {
      toast.error('Please select a queue');
      return;
    }

    if (receiveMode === 'topic' && (!topic || !subscription)) {
      toast.error('Please select both a topic and subscription');
      return;
    }

    try {
      const result = await receiveMutation.mutateAsync({
        queue: receiveMode === 'queue' && queue !== '__default__' ? queue.trim() : undefined,
        topic: receiveMode === 'topic' ? topic : undefined,
        subscription: receiveMode === 'topic' ? subscription : undefined,
        receivedBy: receivedBy.trim(),
      });

      if (result.success && result.data) {
        toast.success('Message received successfully', {
          description: `Message ${result.data.messageId} has been received and processed.`,
        });
        // Reset form
        setReceiveMode('queue');
        setQueue('__default__');
        setTopic('');
        setSubscription('');
        setReceivedBy('');
        onOpenChange(false);
      } else {
        toast.info('No messages available', {
          description: result.message || 'The destination is empty.',
        });
      }
    } catch (error) {
      console.error('Failed to receive message:', error);
      toast.error('Failed to receive message', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Receive Message</DialogTitle>
          <DialogDescription>
            Receive and process a message from a Service Bus queue or topic subscription. The message will be marked as received.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="receive-mode">Receive From</Label>
              <Select value={receiveMode} onValueChange={(value: 'queue' | 'topic') => setReceiveMode(value)}>
                <SelectTrigger id="receive-mode">
                  <SelectValue placeholder="Select receive mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="queue">Queue</SelectItem>
                  <SelectItem value="topic">Topic Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {receiveMode === 'queue' && (
              <div className="grid gap-2">
                <Label htmlFor="receive-queue">Queue Name (optional)</Label>
                <Select value={queue} onValueChange={setQueue}>
                  <SelectTrigger id="receive-queue">
                    <SelectValue placeholder="Select a queue or leave empty for default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default Queue</SelectItem>
                    {queues.map((queueName) => (
                      <SelectItem key={queueName} value={queueName}>
                        {queueName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {receiveMode === 'topic' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="receive-topic">Topic Name</Label>
                  <Select value={topic} onValueChange={(value) => {
                    setTopic(value);
                    setSubscription(''); // Reset subscription when topic changes
                  }}>
                    <SelectTrigger id="receive-topic">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map((topicName) => (
                        <SelectItem key={topicName} value={topicName}>
                          {topicName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="receive-subscription">Subscription Name</Label>
                  <Select value={subscription} onValueChange={setSubscription} disabled={!topic}>
                    <SelectTrigger id="receive-subscription">
                      <SelectValue placeholder={topic ? "Select a subscription" : "Select a topic first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subscriptions.map((subscriptionName) => (
                        <SelectItem key={subscriptionName} value={subscriptionName}>
                          {subscriptionName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="receivedBy">
                Received By <span className="text-destructive">*</span>
              </Label>
              <Input
                id="receivedBy"
                placeholder="service-bus-worker"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={receiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? (
                'Receiving...'
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Receive Message
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

