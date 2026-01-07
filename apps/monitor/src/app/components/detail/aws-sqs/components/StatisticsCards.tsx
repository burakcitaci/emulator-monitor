import React from 'react';
import { Card, CardContent } from '../../../ui/card';
import { AwsSqsMessagesData } from '../../../../lib/schemas';

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
            {messages.data.filter((message) => message.disposition === 'complete').length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">
            DLQ Messages
          </div>
          <div className="text-xl font-bold">
            {messages.data.filter((message) => message.disposition === 'deadletter').length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">
            Abandoned
          </div>
          <div className="text-xl font-bold">
            {messages.data.filter((message) => message.disposition === 'abandon').length}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Deferred</div>
          <div className="text-xl font-bold">
            {messages.data.filter((message) => message.disposition === 'defer').length}
          </div>
         
        </CardContent>
      </Card>
    </div>
  );
};