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
} from '../ui/sheet';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { useSendServiceBusMessage } from '../../hooks/api/service-bus';
import { useSendSqsMessage, useAwsSqsConfig } from '../../hooks/api/aws-sqs';
import { useSendRabbitmqMessage, useRabbitmqConfig } from '../../hooks/api/rabbitmq';

type ServiceType = 'service-bus' | 'sqs' | 'rabbitmq';

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinations: string[];
}

export const SendMessageModal: React.FC<SendMessageModalProps> = ({
  open,
  onOpenChange,
  destinations,
}) => {
  const [serviceType, setServiceType] = useState<ServiceType>('service-bus');
  const [queue, setQueue] = useState('__default__');
  const [body, setBody] = useState('');
  const [sentBy, setSentBy] = useState('');
  const [messageDisposition, setMessageDisposition] = useState<'complete' | 'abandon' | 'deadletter' | 'defer'>('complete');
  // SQS-specific fields
  const [messageGroupId, setMessageGroupId] = useState('');
  const [messageDeduplicationId, setMessageDeduplicationId] = useState('');
  const [delaySeconds, setDelaySeconds] = useState<number | undefined>(undefined);
  // RabbitMQ-specific fields
  const [expiration, setExpiration] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<number | undefined>(undefined);

  const sendServiceBusMutation = useSendServiceBusMessage();
  const sendSqsMutation = useSendSqsMessage();
  const sendRabbitmqMutation = useSendRabbitmqMessage();
  const { data: awsSqsConfig } = useAwsSqsConfig();
  const { data: rabbitmqConfig } = useRabbitmqConfig();

  const sendMutation = 
    serviceType === 'service-bus' 
      ? sendServiceBusMutation 
      : serviceType === 'sqs'
      ? sendSqsMutation
      : sendRabbitmqMutation;

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
    const prefixes = 
      serviceType === 'service-bus' 
        ? ['service-bus', 'api', 'worker', 'scheduler', 'processor', 'handler']
        : serviceType === 'sqs'
        ? ['aws-sqs', 'lambda', 'worker', 'scheduler', 'processor', 'handler']
        : ['rabbitmq', 'api', 'worker', 'scheduler', 'processor', 'handler'];
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
      if (serviceType === 'service-bus') {
        const messagePayload = {
          queue: queue === '__default__' ? undefined : queue.trim() || undefined,
          body: body.trim(),
          sentBy: sentBy.trim() || undefined,
          messageDisposition: messageDisposition,
        };
        await sendServiceBusMutation.mutateAsync(messagePayload);
      } else if (serviceType === 'sqs') {
        // SQS
        const queueNameOrUrl = queue === '__default__' 
          ? (awsSqsConfig?.queueName || undefined)
          : queue.trim() || undefined;
        
        // If it's a full URL, use it; otherwise construct URL or use queue name
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
        };
        await sendSqsMutation.mutateAsync(messagePayload);
      } else {
        // RabbitMQ
        const messagePayload = {
          queue: queue === '__default__' 
            ? (rabbitmqConfig?.queueName || undefined)
            : queue.trim() || undefined,
          body: body.trim(),
          sentBy: sentBy.trim() || undefined,
          expiration: expiration !== undefined ? expiration : undefined,
          priority: priority !== undefined ? priority : undefined,
          messageDisposition: messageDisposition,
        };
        await sendRabbitmqMutation.mutateAsync(messagePayload);
      }

      const serviceName = 
        serviceType === 'service-bus' 
          ? 'Azure Service Bus' 
          : serviceType === 'sqs'
          ? 'AWS SQS'
          : 'RabbitMQ';
      toast.success('Message simulated successfully', {
        description: `The message has been enqueued to ${serviceName}.`,
      });

      // Reset form
      setQueue('__default__');
      setBody('');
      setSentBy('');
      setMessageDisposition('complete');
      setMessageGroupId('');
      setMessageDeduplicationId('');
      setDelaySeconds(undefined);
      setExpiration(undefined);
      setPriority(undefined);
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
            Simulate sending a message to {
              serviceType === 'service-bus' 
                ? 'Azure Service Bus' 
                : serviceType === 'sqs'
                ? 'AWS SQS'
                : 'RabbitMQ'
            }. The message will be tracked.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSendMessage} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0 pr-2">
            <div className="grid gap-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Select value={serviceType} onValueChange={(value: ServiceType) => {
                setServiceType(value);
                // Reset form fields when switching service types
                setQueue('__default__');
                setMessageDisposition('complete');
                setMessageGroupId('');
                setMessageDeduplicationId('');
                setDelaySeconds(undefined);
                setExpiration(undefined);
                setPriority(undefined);
              }}>
                <SelectTrigger id="serviceType">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service-bus">Azure Service Bus</SelectItem>
                  <SelectItem value="sqs">AWS SQS</SelectItem>
                  <SelectItem value="rabbitmq">RabbitMQ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="queue">
                {serviceType === 'service-bus' ? 'Queue Name' : 'Queue Name/URL'} (optional)
              </Label>
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
                placeholder={
                  serviceType === 'service-bus' 
                    ? 'service-bus-api' 
                    : serviceType === 'sqs'
                    ? 'aws-sqs-api'
                    : 'rabbitmq-api'
                }
                value={sentBy}
                onChange={(e) => setSentBy(e.target.value)}
              />
            </div>
            {serviceType === 'service-bus' && (
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
                  {messageDisposition === 'complete' && 'Message will be completed and removed from the queue.'}
                  {messageDisposition === 'abandon' && 'Message will be abandoned and returned to the queue for reprocessing.'}
                  {messageDisposition === 'deadletter' && 'Message will be moved to the dead-letter queue.'}
                  {messageDisposition === 'defer' && 'Message will be deferred and can be received later using sequence number.'}
                </p>
              </div>
            )}
            {serviceType === 'sqs' && (
              <>
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
              </>
            )}
            {serviceType === 'rabbitmq' && (
              <>
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
                    {messageDisposition === 'complete' && 'Message will be acknowledged and removed from the queue.'}
                    {messageDisposition === 'abandon' && 'Message will be rejected and requeued for reprocessing.'}
                    {messageDisposition === 'deadletter' && 'Message will be rejected without requeue (will go to dead-letter queue if configured).'}
                    {messageDisposition === 'defer' && 'Message will be rejected and requeued (deferred).'}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expiration">Expiration (TTL in milliseconds, optional)</Label>
                  <Input
                    id="expiration"
                    type="number"
                    min="0"
                    placeholder="60000"
                    value={expiration ?? ''}
                    onChange={(e) => setExpiration(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Message time-to-live in milliseconds. Message will expire after this duration.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority (0-255, optional)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="0"
                    max="255"
                    placeholder="0"
                    value={priority ?? ''}
                    onChange={(e) => setPriority(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Message priority (0-255). Higher priority messages are delivered first.
                  </p>
                </div>
              </>
            )}
          </div>
          <SheetFooter className="mt-4 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="default" disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
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

