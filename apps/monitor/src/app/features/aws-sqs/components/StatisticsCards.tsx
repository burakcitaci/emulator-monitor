import React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { TrackingMessage } from '../../../lib/schemas';

type AwsSqsMessagesData = {
  data: TrackingMessage[];
  queueName?: string;
  queueUrl?: string;
};

interface StatisticsProps {
  messages: AwsSqsMessagesData;
}

export const Statistics: React.FC<StatisticsProps> = ({ messages }) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Messages</div>
          <div className="text-xl font-bold">
            {messages.data.length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Completed</div>
          <div className="text-xl font-bold">
            {messages.data.filter((message: TrackingMessage) => message.disposition === 'complete').length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">
            DLQ Messages
          </div>
          <div className="text-xl font-bold">
            {messages.data.filter((message: TrackingMessage) => message.disposition === 'deadletter').length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">
            Abandoned
          </div>
          <div className="text-xl font-bold">
            {messages.data.filter((message: TrackingMessage) => message.disposition === 'abandon').length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Deferred</div>
          <div className="text-xl font-bold">
            {messages.data.filter((message: TrackingMessage) => message.disposition === 'defer').length}
          </div>
         
        </CardContent>
      </Card>
    </div>
  );
};