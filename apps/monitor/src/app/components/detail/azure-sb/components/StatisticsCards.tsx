import { Card, CardContent } from '../../../ui/card';
import { ServiceBusMessagesData } from '../../../../lib/schemas';

export const Statistics = ({
  messages,
}: {
  messages: ServiceBusMessagesData;
}) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Completed</div>
          <div className="text-xl font-bold">
            {messages.summary.trackingComplete}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">
            Dead Letter Queue
          </div>
          <div className="text-xl font-bold">
            {messages.summary.trackingDeadletter}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Abandoned</div>
          <div className="text-xl font-bold">
            {messages.summary.trackingAbandon}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Deferred</div>
          <div className="text-xl font-bold">
            {messages.summary.trackingDefer}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
