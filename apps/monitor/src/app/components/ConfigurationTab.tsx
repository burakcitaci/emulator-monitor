import React from 'react';
import {
  Database,
  Package,
  Radio,
  Users,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useServiceBusConfig } from '../hooks';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';

export const ConfigurationTab: React.FC = () => {
  const { config, loading: configLoading, error } = useServiceBusConfig();

  // Show loading state only during initial loading, not when backend is unavailable
  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading configuration...</p>
      </div>
    );
  }

  // Show backend unavailable state when not loading but config is null
  if (!config) {
    return (
      <div className="space-y-6">
        {/* Header Section */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Service Bus Configuration</h2>
          <p className="text-muted-foreground">
            View and manage your Service Bus emulator configuration.
          </p>
        </div>

        {/* Backend Unavailable Status */}
        <div className="rounded-lg border p-8 text-center bg-muted/50">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">
            Backend Service Unavailable
          </h3>
          <p className="text-muted-foreground">
            Unable to connect to backend service. Please ensure the backend is
            running and accessible.
          </p>
          {error && <p className="text-sm text-red-600 mt-2">Error: {error}</p>}
        </div>
      </div>
    );
  }

  const parseDuration = (duration: string): string => {
    const regex = /PT?(\d+)([DHMS])/;
    const match = regex.exec(duration);
    if (!match) return duration;

    const value = match[1];
    const unit = match[2];
    const units: Record<string, string> = {
      D: 'day',
      H: 'hour',
      M: 'minute',
      S: 'second',
    };

    return `${value} ${units[unit]}${value !== '1' ? 's' : ''}`;
  };

  return (
    <div className="space-y-8">
      {config.UserConfig.Namespaces.map((namespace) => (
        <div key={namespace.Name} className="space-y-6">
          {/* Namespace Header */}
          <Card className="border-2 border-primary shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Database className="size-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-semibold">
                    Namespace: {namespace.Name}
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    Azure Service Bus Namespace Configuration
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Queues Section */}
          {namespace.Queues && namespace.Queues.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 px-1">
                <Package className="size-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  Queues ({namespace.Queues.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {namespace.Queues.map((queue) => (
                  <Card
                    key={queue.Name}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center space-x-2">
                          <Package className="size-4 text-primary" />
                          <span>{queue.Name}</span>
                        </CardTitle>
                        <Badge variant="secondary">Queue</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <Clock className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">TTL:</span>
                        <span className="font-medium">
                          {parseDuration(
                            queue.Properties.DefaultMessageTimeToLive
                          )}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Max Delivery:
                        </span>
                        <span className="font-medium">
                          {queue.Properties.MaxDeliveryCount}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-muted-foreground">
                          Dead Letter:
                        </span>
                        {queue.Properties.DeadLetteringOnMessageExpiration ? (
                          <Badge variant="default">Enabled</Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Topics Section */}
          {namespace.Topics && namespace.Topics.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 px-1">
                <Radio className="size-5 text-accent-foreground" />
                <h3 className="text-lg font-semibold">
                  Topics ({namespace.Topics.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {namespace.Topics.map((topic) => (
                  <Card
                    key={topic.Name}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center space-x-2">
                          <Radio className="size-4 text-accent-foreground" />
                          <span>{topic.Name}</span>
                        </CardTitle>
                        <Badge variant="secondary">Topic</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Topic Properties */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center space-x-2">
                          <Clock className="size-4 text-muted-foreground" />
                          <div>
                            <span className="text-muted-foreground block text-xs">
                              TTL
                            </span>
                            <span className="font-medium">
                              {parseDuration(
                                topic.Properties.DefaultMessageTimeToLive
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground block text-xs">
                            Duplicate Detection
                          </span>
                          {topic.Properties.RequiresDuplicateDetection ? (
                            <Badge variant="default">
                              Enabled (
                              {parseDuration(
                                topic.Properties
                                  .DuplicateDetectionHistoryTimeWindow
                              )}
                              )
                            </Badge>
                          ) : (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                        </div>
                      </div>

                      {/* Subscriptions */}
                      {topic.Subscriptions &&
                        topic.Subscriptions.length > 0 && (
                          <div className="border-t pt-3">
                            <div className="flex items-center space-x-2 mb-3">
                              <Users className="size-4 text-accent-foreground" />
                              <h4 className="text-sm font-semibold">
                                Subscriptions ({topic.Subscriptions.length})
                              </h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {topic.Subscriptions.map((subscription) => (
                                <div
                                  key={subscription.Name}
                                  className="bg-accent border border-border rounded-lg p-3 space-y-1"
                                >
                                  <div className="flex items-center space-x-2">
                                    <Users className="size-3 text-accent-foreground" />
                                    <span className="font-medium text-sm">
                                      {subscription.Name}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex justify-between">
                                      <span>Max Delivery:</span>
                                      <span className="font-medium">
                                        {subscription.MaxDeliveryCount}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Dead Letter:</span>
                                      {subscription.DeadLetteringOnMessageExpiration ? (
                                        <Badge
                                          variant="default"
                                          className="text-xs h-4"
                                        >
                                          Yes
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="text-xs h-4"
                                        >
                                          No
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Summary Stats */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {config.UserConfig.Namespaces.length}
              </div>
              <div className="text-sm text-muted-foreground">Namespace(s)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {config.UserConfig.Namespaces.reduce(
                  (acc, ns) => acc + (ns.Queues?.length || 0),
                  0
                )}
              </div>
              <div className="text-sm text-muted-foreground">Queue(s)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {config.UserConfig.Namespaces.reduce(
                  (acc, ns) => acc + (ns.Topics?.length || 0),
                  0
                )}
              </div>
              <div className="text-sm text-muted-foreground">Topic(s)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {config.UserConfig.Namespaces.reduce(
                  (acc, ns) =>
                    acc +
                    (ns.Topics?.reduce(
                      (topicAcc, topic) =>
                        topicAcc + (topic.Subscriptions?.length || 0),
                      0
                    ) || 0),
                  0
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Subscription(s)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
