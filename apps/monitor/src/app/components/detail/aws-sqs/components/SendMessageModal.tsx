import React, { useState } from 'react';
import { Send, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../../ui/sheet';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Button } from '../../../ui/button';
import { useSendSqsMessage, useAwsSqsConfig } from '../../../../hooks/api/aws-sqs';
import { useServiceBusConfig } from '../../../../hooks/api/service-bus';

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AwsSqsSendMessageModal: React.FC<SendMessageModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [queue, setQueue] = useState('__default__');
  const [body, setBody] = useState('');
  const [sentBy, setSentBy] = useState('');
  const [messageDisposition, setMessageDisposition] = useState<'complete' | 'abandon' | 'deadletter' | 'defer'>('complete');
  const [messageGroupId, setMessageGroupId] = useState('');
  const [messageDeduplicationId, setMessageDeduplicationId] = useState('');
  const [delaySeconds, setDelaySeconds] = useState<number | undefined>(undefined);
    const { data: config } = useServiceBusConfig();
  const sendSqsMutation = useSendSqsMessage();
  const { data: awsSqsConfig } = useAwsSqsConfig();
   // Extract queues and topics from config
  const destinations = React.useMemo(() => {
    if (!config?.UserConfig?.Namespaces) return [];
    const allDestinations: string[] = [];
    config.UserConfig.Namespaces.forEach((namespace) => {
      if (namespace.Queues) {
        namespace.Queues.forEach((q) => {
          allDestinations.push(q.Name);
        });
      }
      if (namespace.Topics) {
        namespace.Topics.forEach((t) => {
          allDestinations.push(t.Name);
        });
      }
    });
    return allDestinations.sort();
  }, [config]);
  const generateRandomJson = () => {
    const sampleData = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      event: ['created', 'updated', 'deleted', 'processed'][Math.floor(Math.random() * 4)],
      userId: Math.floor(Math.random() * 10000),
      metadata: {
        source: ['web', 'api', 'mobile', 'batch'][Math.floor(Math.random() * 4)],
        version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`,
      },
      value: Math.floor(Math.random() * 1000),
    };
    setBody(JSON.stringify(sampleData, null, 2));
  };

  const generateRandomSender = () => {
    const prefixes = ['aws-sqs', 'lambda', 'worker', 'scheduler', 'processor', 'handler'];
    const suffixes = ['api', 'service', 'worker', 'processor', 'handler', 'client'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    setSentBy(`${prefix}-${suffix}`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!body.trim()) {
      toast.error('Body is required');
      return;
    }

    try {
      const queueNameOrUrl = queue === '__default__' 
        ? (awsSqsConfig?.queueName || undefined)
        : queue.trim() || undefined;
      
      const queueUrl = queueNameOrUrl?.startsWith('http') 
        ? queueNameOrUrl
        : queueNameOrUrl
          ? `http://localhost:4566/000000000000/${queueNameOrUrl}`
          : undefined;

      const messagePayload = {
        queueUrl,
        body: body.trim(),
        sentBy: sentBy.trim() || undefined,
        messageGroupId: messageGroupId.trim() || undefined,
        messageDeduplicationId: messageDeduplicationId.trim() || undefined,
        delaySeconds: delaySeconds !== undefined ? delaySeconds : undefined,
        messageDisposition: messageDisposition,
      };
      
      await sendSqsMutation.mutateAsync(messagePayload);

      toast.success('Message simulated successfully', {
        description: 'The message has been enqueued to AWS SQS.',
      });

      // Reset form
      setQueue('__default__');
      setBody('');
      setSentBy('');
      setMessageDisposition('complete');
      setMessageGroupId('');
      setMessageDeduplicationId('');
      setDelaySeconds(undefined);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to simulate message', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-2/6 sm:max-w-4xl flex flex-col overflow-hidden">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Simulate Message</SheetTitle>
          <SheetDescription>
            Simulate sending a message to AWS SQS. The message will be tracked.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSendMessage} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0 pr-2">
            <div className="grid gap-2">
              <Label htmlFor="queue">Queue Name/URL (optional)</Label>
              <Select value={queue} onValueChange={setQueue}>
                <SelectTrigger id="queue">
                  <SelectValue placeholder="Select a queue or leave empty for default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default Queue</SelectItem>
                  {destinations.map((destinationName) => (
                    <SelectItem key={destinationName} value={destinationName}>
                      {destinationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">
                  Message Body <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateRandomJson}
                  className="h-7 text-xs"
                >
                  <Shuffle className="mr-1 h-3 w-3" />
                  Random JSON
                </Button>
              </div>
              <textarea
                id="body"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder='{"key": "value"} or plain text'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sentBy">Sent By (optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateRandomSender}
                  className="h-7 text-xs"
                >
                  <Shuffle className="mr-1 h-3 w-3" />
                  Random Sender
                </Button>
              </div>
              <Input
                id="sentBy"
                placeholder="aws-sqs-api"
                value={sentBy}
                onChange={(e) => setSentBy(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="disposition">Message Disposition</Label>
              <Select value={messageDisposition} onValueChange={(value: 'complete' | 'abandon' | 'deadletter' | 'defer') => setMessageDisposition(value)}>
                <SelectTrigger id="disposition">
                  <SelectValue placeholder="Select message disposition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="abandon">Abandon</SelectItem>
                  <SelectItem value="deadletter">Dead Letter</SelectItem>
                  <SelectItem value="defer">Defer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {messageDisposition === 'complete' && 'Message will be completed and deleted from the queue.'}
                {messageDisposition === 'abandon' && 'Message will be abandoned and become visible again after visibility timeout.'}
                {messageDisposition === 'deadletter' && 'Message will be marked for dead-letter queue (requires redrive policy configuration).'}
                {messageDisposition === 'defer' && 'Message will be deferred with extended visibility timeout (5 minutes).'}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="messageGroupId">Message Group ID (FIFO queues only, optional)</Label>
              <Input
                id="messageGroupId"
                placeholder="group-123"
                value={messageGroupId}
                onChange={(e) => setMessageGroupId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Required for FIFO queues. Messages with the same group ID are processed in order.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="messageDeduplicationId">Message Deduplication ID (FIFO queues only, optional)</Label>
              <Input
                id="messageDeduplicationId"
                placeholder="dedup-123"
                value={messageDeduplicationId}
                onChange={(e) => setMessageDeduplicationId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to prevent duplicate messages in FIFO queues within the deduplication interval.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="delaySeconds">Delay Seconds (optional)</Label>
              <Input
                id="delaySeconds"
                type="number"
                min="0"
                max="900"
                placeholder="0"
                value={delaySeconds ?? ''}
                onChange={(e) => setDelaySeconds(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              />
              <p className="text-xs text-muted-foreground">
                The number of seconds to delay the message (0-900). Messages become available after this delay.
              </p>
            </div>
          </div>
          <SheetFooter className="mt-4 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={sendSqsMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="default" disabled={sendSqsMutation.isPending}>
              {sendSqsMutation.isPending ? (
                'Simulating...'
              ) : (
                <>
                  <Send />
                  Simulate Message
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};