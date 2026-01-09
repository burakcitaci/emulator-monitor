import { Card, CardContent } from '../../../components/ui/card';
import { TrackingMessage } from '../../../lib/schemas';

type ServiceBusMessagesData = {
  data: TrackingMessage[];
  namespace?: string;
  queueName?: string;
  summary?: {
    trackingDeadletter: number;
    trackingAbandon: number;
    trackingDefer: number;
    trackingComplete: number;
  };
};

export const Statistics = ({
  messages,
}: {
  messages: ServiceBusMessagesData;
}) => {
  // Use summary if available, otherwise calculate from data
  const summary = messages.summary || {
    trackingComplete: messages.data.filter((message: TrackingMessage) => message.disposition === 'complete').length,
    trackingDeadletter: messages.data.filter((message: TrackingMessage) => message.disposition === 'deadletter').length,
    trackingAbandon: messages.data.filter((message: TrackingMessage) => message.disposition === 'abandon').length,
    trackingDefer: messages.data.filter((message: TrackingMessage) => message.disposition === 'defer').length,
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Completed</div>
          <div className="text-xl font-bold">
            {summary.trackingComplete}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">
            Dead Letter Queue
          </div>
          <div className="text-xl font-bold">
            {summary.trackingDeadletter}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Abandoned</div>
          <div className="text-xl font-bold">
            {summary.trackingAbandon}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Deferred</div>
          <div className="text-xl font-bold">
            {summary.trackingDefer}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
