import React from 'react';
import { Send } from 'lucide-react';
import { SendForm } from '../types';
import { useServiceBusConfig } from '../hooks';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface SendMessageTabProps {
  form: SendForm;
  onFormChange: (form: SendForm) => void;
  onSend: () => void;
}

export const SendMessageTab: React.FC<SendMessageTabProps> = ({
  form,
  onFormChange,
  onSend,
}) => {
  const { allDestinations, getQueueNames, getTopicNames } =
    useServiceBusConfig();

  const handleInputChange = (field: keyof SendForm, value: string) => {
    onFormChange({ ...form, [field]: value });
  };

  const queues = getQueueNames();
  const topics = getTopicNames();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="queueName">Queue/Topic Name</Label>
        <Select
          value={form.queueName}
          onValueChange={(value) => handleInputChange('queueName', value)}
        >
          <SelectTrigger id="queueName">
            <SelectValue placeholder="Select queue or topic..." />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Queues
            </div>
            {queues.map((queue) => (
              <SelectItem key={queue} value={queue}>
                📦 {queue}
              </SelectItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
              Topics
            </div>
            {topics.map((topic) => (
              <SelectItem key={topic} value={topic}>
                📡 {topic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="messageBody">Message Body (JSON)</Label>
        <Textarea
          id="messageBody"
          value={form.body}
          onChange={(e) => handleInputChange('body', e.target.value)}
          rows={8}
          className="font-mono text-sm"
          placeholder='{"policyId": "P001", "violation": "speed"}'
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="properties">Properties (JSON, Optional)</Label>
        <Textarea
          id="properties"
          value={form.properties}
          onChange={(e) => handleInputChange('properties', e.target.value)}
          rows={4}
          className="font-mono text-sm"
          placeholder='{"severity": "high"}'
        />
      </div>
      <Button
        onClick={onSend}
        disabled={!form.queueName || !form.body}
        className="w-full"
        size="lg"
      >
        <Send className="w-5 h-5 mr-2" />
        Send Message
      </Button>
    </div>
  );
};
