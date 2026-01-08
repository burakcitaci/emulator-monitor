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
} from '../../../components/ui/sheet';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import {
  useSendSqsMessage,
  useAwsSqsConfig,
} from '../hooks/aws-sqs';
import { useServiceBusConfig } from '../../azure-sb/api/service-bus';

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
type MessageDisposition =
  | 'complete'
  | 'abandon'
  | 'deadletter'
  | 'defer';


export const AwsSqsSendMessageSheet: React.FC<SendMessageModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [queue, setQueue] = useState('__default__');
  const [body, setBody] = useState('');
  const [sentBy, setSentBy] = useState('');
  const [messageDisposition, setMessageDisposition] = useState<MessageDisposition>('complete');

  const { data: config } = useServiceBusConfig();
  const sendSqsMutation = useSendSqsMessage();
  const { data: awsSqsConfig } = useAwsSqsConfig();

  const destinations = React.useMemo(() => {
    if (!config?.UserConfig?.Namespaces) return [];
    const allDestinations: string[] = [];

    config.UserConfig.Namespaces.forEach((namespace) => {
      namespace.Queues?.forEach((q) => allDestinations.push(q.Name));
      namespace.Topics?.forEach((t) => allDestinations.push(t.Name));
    });

    return allDestinations.sort();
  }, [config]);

  const generateRandomJson = () => {
    const sampleData = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      event: ['created', 'updated', 'deleted', 'processed'][
        Math.floor(Math.random() * 4)
      ],
      userId: Math.floor(Math.random() * 10000),
      metadata: {
        source: ['web', 'api', 'mobile', 'batch'][
          Math.floor(Math.random() * 4)
        ],
        version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(
          Math.random() * 10,
        )}`,
      },
      value: Math.floor(Math.random() * 1000),
    };

    setBody(JSON.stringify(sampleData, null, 2));
  };

  const generateRandomSender = () => {
    const prefixes = ['aws-sqs', 'lambda', 'worker', 'scheduler', 'processor'];
    const suffixes = ['api', 'service', 'worker', 'handler', 'client'];

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
      const queueNameOrUrl =
        queue === '__default__'
          ? awsSqsConfig?.queueName || undefined
          : queue.trim() || undefined;

      const queueUrl = queueNameOrUrl?.startsWith('http')
        ? queueNameOrUrl
        : queueNameOrUrl
        ? `http://localhost:4566/000000000000/${queueNameOrUrl}`
        : undefined;

      await sendSqsMutation.mutateAsync({
        queueUrl,
        body: body.trim(),
        sentBy: sentBy.trim() || undefined,
        messageDisposition,
      });

      toast.success('Message simulated successfully', {
        description: 'The message has been enqueued to AWS SQS.',
      });

      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to simulate message', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-2/6 sm:max-w-4xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Simulate Message</SheetTitle>
          <SheetDescription>
            Simulate sending a message to AWS SQS. The message will be tracked.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSendMessage}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="grid gap-6 py-6 flex-1 min-h-0 pr-2">
            {/* Queue */}
            <div className="grid gap-2">
              <Label htmlFor="queue">Queue Name / URL (optional)</Label>
              <Select value={queue} onValueChange={setQueue}>
                <SelectTrigger id="queue">
                  <SelectValue placeholder="Select a queue or leave empty for default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">
                    Default Queue
                  </SelectItem>
                  {destinations.map((destination) => (
                    <SelectItem key={destination} value={destination}>
                      {destination}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Body */}
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
                  className="h-7 px-2 text-xs"
                >
                  <Shuffle className="mr-1 h-3 w-3" />
                  Random
                </Button>
              </div>

              <textarea
                id="body"
                className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder='{"key": "value"}'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            {/* Sent By (duplicated intentionally) */}
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sentBy">Sent By (optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateRandomSender}
                      className="h-7 px-2 text-xs"
                    >
                      <Shuffle className="mr-1 h-3 w-3" />
                      Random
                    </Button>
                  </div>
                  <Input
                    id="sentBy"
                    placeholder="aws-sqs-api"
                    value={sentBy}
                    onChange={(e) => setSentBy(e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Disposition */}
            <div className="grid gap-2">
              <Label htmlFor="disposition">Message Disposition</Label>
              <Select
                value={messageDisposition}
                onValueChange={(value: MessageDisposition) => setMessageDisposition(value)}
              >
                <SelectTrigger id="disposition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="abandon">Abandon</SelectItem>
                  <SelectItem value="deadletter">Dead Letter</SelectItem>
                  <SelectItem value="defer">Defer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              <Send className="mr-1 h-4 w-4" />
              Simulate Message
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
