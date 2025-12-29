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
import { useSendServiceBusMessage, useServiceBusConfig } from '../../hooks/api/service-bus';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SendMessageModal: React.FC<SendMessageModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [queue, setQueue] = useState('');
  const [body, setBody] = useState('');
  const [sentBy, setSentBy] = useState('');

  const sendMutation = useSendServiceBusMessage();
  const { data: config } = useServiceBusConfig();

  // Extract queues and topics from config
  const destinations = useMemo(() => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!body.trim()) {
      toast.error('Body is required');
      return;
    }

    try {
      await sendMutation.mutateAsync({
        queue: queue === '__default__' ? undefined : queue.trim() || undefined,
        body: body.trim(),
        sentBy: sentBy.trim() || undefined,
      });

      toast.success('Message simulated successfully', {
        description: 'The message has been enqueued.',
      });

      // Reset form
      setQueue('__default__');
      setBody('');
      setSentBy('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to simulate message', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Simulate Message</DialogTitle>
          <DialogDescription>
            Simulate sending a message to the Service Bus queue. The message will be tracked.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="queue">Queue Name (optional)</Label>
              <Select value={queue || '__default__'} onValueChange={setQueue}>
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
              <Label htmlFor="body">
                Message Body <span className="text-destructive">*</span>
              </Label>
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
              <Label htmlFor="sentBy">Sent By (optional)</Label>
              <Input
                id="sentBy"
                placeholder="service-bus-api"
                value={sentBy}
                onChange={(e) => setSentBy(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
                'Simulating...'
              ) : (
                <>
                  <Send className="mr-2 h-3 w-4" />
                  Simulate Message
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

