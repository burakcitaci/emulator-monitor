/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useServiceBusConfig } from '../../hooks/api/useServiceBusConfig';

export type EntitySelection =
  | { kind: 'queue'; name: string; namespace: string }
  | { kind: 'topic'; name: string; subscription?: string; namespace: string };

interface EntitySelectorProps {
  value?: EntitySelection | null;
  onChange: (selection: EntitySelection | null) => void;
  includeQueues?: boolean; // default true
  includeTopics?: boolean; // default true
  requireSubscriptionForTopic?: boolean; // default true
  autoSelectPreferredSubscription?: boolean; // default true
  disabled?: boolean;
  label?: string;
  queuePlaceholder?: string;
  topicPlaceholder?: string;
  subscriptionPlaceholder?: string;
}

export const EntitySelector: React.FC<EntitySelectorProps> = ({
  value,
  onChange,
  includeQueues = true,
  includeTopics = true,
  requireSubscriptionForTopic = true,
  autoSelectPreferredSubscription = true,
  disabled = false,
  label = 'Select Queue or Topic',
  queuePlaceholder,
  topicPlaceholder,
  subscriptionPlaceholder,
}) => {
  const {
    queuesAndTopics,
    getQueueNames,
    getTopicNames,
    getSubscriptionsByTopic,
    loading: configLoading,
    error: configError,
  } = useServiceBusConfig();

  const queues = useMemo(
    () => (includeQueues ? getQueueNames() : []),
    [includeQueues, getQueueNames],
  );
  const topics = useMemo(
    () => (includeTopics ? getTopicNames() : []),
    [includeTopics, getTopicNames],
  );

  const [primary, setPrimary] = useState<null | {
    kind: 'queue' | 'topic';
    name: string;
  }>(value ? { kind: value.kind, name: value.name } : null);
  const [subscription, setSubscription] = useState<string>(
    value && value.kind === 'topic' ? value.subscription || '' : '',
  );

  // Derive namespace from the selected primary and available queues/topics.
  // Avoid calling setState inside an effect by computing this value during render.
  const derivedNamespace = useMemo(() => {
    if (!primary) return '';
    const item = queuesAndTopics.find(
      (i) => i.type === primary.kind && i.name === primary.name,
    );
    if (item?.namespace) return item.namespace;
    // Fallback to the incoming value.namespace when the initial prop matches the selection
    if (value && value.kind === primary.kind && value.name === primary.name) {
      return value.namespace ?? '';
    }
    return '';
  }, [primary, queuesAndTopics, value]);

  // Subscriptions for selected topic
  const topicSubscriptions = useMemo(() => {
    if (!primary || primary.kind !== 'topic') return [] as string[];
    return getSubscriptionsByTopic(primary.name);
  }, [primary, getSubscriptionsByTopic]);

  // Compute preferred subscription (no setState in effect)
  const preferredSubscription = useMemo(() => {
    if (!primary || primary.kind !== 'topic') return '';
    if (topicSubscriptions.length === 0) return '';
    return topicSubscriptions.includes('default')
      ? 'default'
      : topicSubscriptions[0];
  }, [primary, topicSubscriptions]);

  // Displayed subscription: user selection takes precedence, otherwise use preferred when enabled
  const displayedSubscription = useMemo(() => {
    if (subscription) return subscription;
    if (!autoSelectPreferredSubscription) return '';
    return preferredSubscription;
  }, [subscription, autoSelectPreferredSubscription, preferredSubscription]);

  // Emit changes when selection sufficient
  useEffect(() => {
    const namespace = derivedNamespace;
    const sub = displayedSubscription;
    if (!primary || !namespace) {
      onChange(null);
      return;
    }

    if (primary.kind === 'queue') {
      onChange({ kind: 'queue', name: primary.name, namespace });
      return;
    }

    // topic
    if (requireSubscriptionForTopic) {
      if (sub) {
        onChange({
          kind: 'topic',
          name: primary.name,
          subscription: sub,
          namespace,
        });
      } else {
        onChange(null);
      }
    } else {
      onChange({
        kind: 'topic',
        name: primary.name,
        subscription: sub,
        namespace,
      });
    }
  }, [
    primary,
    derivedNamespace,
    displayedSubscription,
    requireSubscriptionForTopic,
    onChange,
  ]);

  const isLoading = disabled || configLoading;

  return (
    <div className="flex items-center gap-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium text-muted-foreground">
          {label}
        </Label>
        <Select
          value={primary ? `${primary.kind}::${primary.name}` : ''}
          onValueChange={(val) => {
            const [kind, name] = val.split('::');
            if (kind === 'queue' || kind === 'topic') {
              setPrimary({ kind, name } as any);
              setSubscription('');
            }
          }}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[340px] rounded-sm" disabled={isLoading}>
            <SelectValue
              placeholder={
                queuePlaceholder ||
                topicPlaceholder ||
                'Select queue or topic...'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {includeQueues && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Queues
                </div>
                {queues.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No queues available
                  </div>
                ) : (
                  queues.map((q) => (
                    <SelectItem key={`queue::${q}`} value={`queue::${q}`}>
                      <div className="flex items-center space-x-2">
                        <span aria-hidden="true">📦</span>
                        <span>{q}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </>
            )}

            {includeTopics && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                  Topics
                </div>
                {topics.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No topics available
                  </div>
                ) : (
                  topics.map((t) => (
                    <SelectItem key={`topic::${t}`} value={`topic::${t}`}>
                      <div className="flex items-center space-x-2">
                        <span aria-hidden="true">📡</span>
                        <span>{t}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Subscription selector for topics */}
      {primary?.kind === 'topic' && (
        <div className="space-y-1">
          <Label className="text-sm text-muted-foreground">Subscription</Label>
          <Select
            value={displayedSubscription}
            onValueChange={setSubscription}
            disabled={isLoading || topicSubscriptions.length === 0}
          >
            <SelectTrigger
              className="w-[260px] rounded-sm"
              disabled={isLoading || topicSubscriptions.length === 0}
            >
              <SelectValue
                placeholder={
                  subscriptionPlaceholder || 'Select subscription...'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {topicSubscriptions.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No subscriptions
                </div>
              ) : (
                topicSubscriptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {configError && (
        <div className="text-xs text-destructive">{String(configError)}</div>
      )}
    </div>
  );
};

export default EntitySelector;
