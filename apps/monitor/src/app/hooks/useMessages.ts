import { useState, useEffect } from 'react';
import { DeadLetterMessage } from './useServiceBus';

export const useMessages = () => {
  const [messages, setMessages] = useState<DeadLetterMessage[]>([]);
  const [dlqMessages, setDlqMessages] = useState<DeadLetterMessage[]>([]);

  useEffect(() => {
    const initialMessages: DeadLetterMessage[] = [
      {
        messageId: 'msg-001',
        subject: 'system-messages',
        body: {
          eventType: 'system.started',
          timestamp: '2024-01-15T10:30:00Z',
          source: 'api-gateway',
        },
        contentType: 'application/json',
        applicationProperties: { severity: 'info' },
        correlationId: 'evt-001',
        enqueuedTimeUtc: new Date(Date.now() - 300000),
        deliveryCount: 1,
      },
      {
        messageId: 'msg-002',
        subject: 'orders-queue',
        body: {
          orderId: 'ORD-12345',
          customerId: 'user-123',
          amount: 99.99,
          items: 3,
        },
        contentType: 'application/json',
        applicationProperties: { priority: 'high' },
        correlationId: 'order-abc123',
        enqueuedTimeUtc: new Date(Date.now() - 240000),
        deliveryCount: 1,
      },
      {
        messageId: 'msg-003',
        subject: 'application-events',
        body: {
          eventName: 'user.login',
          userId: 'usr-456',
          timestamp: '2024-01-15T10:35:00Z',
        },
        contentType: 'application/json',
        applicationProperties: {
          eventType: 'authentication',
          region: 'eu-west',
        },
        enqueuedTimeUtc: new Date(Date.now() - 180000),
        deliveryCount: 1,
      },
      {
        messageId: 'msg-004',
        subject: 'notifications-queue',
        body: {
          type: 'email',
          recipient: 'user@example.com',
          subject: 'Order Confirmation',
        },
        contentType: 'application/json',
        applicationProperties: { priority: 'normal', retryCount: 0 },
        enqueuedTimeUtc: new Date(Date.now() - 120000),
        deliveryCount: 1,
      },
      {
        messageId: 'msg-005',
        subject: 'errm-policy-triggered',
        body: { policyId: 'P001', violation: 'speed_limit', severity: 'high' },
        contentType: 'application/json',
        applicationProperties: { source: 'monitoring-system', alert: true },
        enqueuedTimeUtc: new Date(Date.now() - 60000),
        deliveryCount: 1,
      },
    ];
    setMessages(initialMessages);

    const dlq: DeadLetterMessage[] = [
      {
        messageId: 'msg-dlq-001',
        subject: 'orders-queue',
        body: {
          orderId: 'ORD-999',
          error: 'Invalid payment method',
          customerId: 'user-789',
        },
        contentType: 'application/json',
        applicationProperties: { severity: 'high', retryCount: 10 },
        correlationId: 'order-dlq-001',
        enqueuedTimeUtc: new Date(Date.now() - 7200000),
        deliveryCount: 10,
        deadLetterReason: 'MaxDeliveryCountExceeded',
        deadLetterErrorDescription:
          'Message exceeded maximum delivery attempts',
      },
      {
        messageId: 'msg-dlq-002',
        subject: 'application-events',
        body: {
          eventName: 'data.corrupted',
          error: 'Schema validation failed',
        },
        contentType: 'application/json',
        applicationProperties: { severity: 'critical', retryCount: 5 },
        correlationId: 'event-dlq-002',
        enqueuedTimeUtc: new Date(Date.now() - 3600000),
        deliveryCount: 5,
        deadLetterReason: 'ValidationError',
        deadLetterErrorDescription: 'Message failed schema validation',
      },
    ];
    setDlqMessages(dlq);
  }, []);

  const addMessage = (message: DeadLetterMessage) => {
    setMessages([message, ...messages]);
  };

  const replayMessage = (messageId: string) => {
    const replayed = dlqMessages.find((m) => m.messageId === messageId);
    if (replayed) {
      setDlqMessages(dlqMessages.filter((m) => m.messageId !== messageId));
      setMessages([
        {
          ...replayed,
          enqueuedTimeUtc: new Date(),
          deliveryCount: 1,
          deadLetterReason: undefined,
          deadLetterErrorDescription: undefined,
        },
        ...messages,
      ]);
    }
  };

  return {
    messages,
    dlqMessages,
    addMessage,
    replayMessage,
  };
};
