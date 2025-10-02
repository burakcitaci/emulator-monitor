import { useState, useEffect } from 'react';
import { Message } from '../types';

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dlqMessages, setDlqMessages] = useState<Message[]>([]);

  useEffect(() => {
    const initialMessages: Message[] = [
      {
        id: 'msg-001',
        queueName: 'system-messages',
        body: '{"eventType": "system.started", "timestamp": "2024-01-15T10:30:00Z", "source": "api-gateway"}',
        properties: { severity: 'info', correlationId: 'evt-001' },
        timestamp: new Date(Date.now() - 300000).toISOString(),
        direction: 'incoming',
        status: 'completed',
        isDeadLetter: false,
      },
      {
        id: 'msg-002',
        queueName: 'orders-queue',
        body: '{"orderId": "ORD-12345", "customerId": "user-123", "amount": 99.99, "items": 3}',
        properties: { correlationId: 'order-abc123', priority: 'high' },
        timestamp: new Date(Date.now() - 240000).toISOString(),
        direction: 'incoming',
        status: 'completed',
        isDeadLetter: false,
      },
      {
        id: 'msg-003',
        queueName: 'application-events',
        body: '{"eventName": "user.login", "userId": "usr-456", "timestamp": "2024-01-15T10:35:00Z"}',
        properties: { eventType: 'authentication', region: 'eu-west' },
        timestamp: new Date(Date.now() - 180000).toISOString(),
        direction: 'incoming',
        status: 'processing',
        isDeadLetter: false,
      },
      {
        id: 'msg-004',
        queueName: 'notifications-queue',
        body: '{"type": "email", "recipient": "user@example.com", "subject": "Order Confirmation"}',
        properties: { priority: 'normal', retryCount: 0 },
        timestamp: new Date(Date.now() - 120000).toISOString(),
        direction: 'outgoing',
        status: 'sent',
        isDeadLetter: false,
      },
      {
        id: 'msg-005',
        queueName: 'errm-policy-triggered',
        body: '{"policyId": "P001", "violation": "speed_limit", "severity": "high"}',
        properties: { source: 'monitoring-system', alert: true },
        timestamp: new Date(Date.now() - 60000).toISOString(),
        direction: 'incoming',
        status: 'completed',
        isDeadLetter: false,
      },
    ];
    setMessages(initialMessages);

    const dlq: Message[] = [
      {
        id: 'msg-dlq-001',
        queueName: 'orders-queue',
        body: '{"orderId": "ORD-999", "error": "Invalid payment method", "customerId": "user-789"}',
        properties: {
          severity: 'high',
          retryCount: 10,
          failureReason: 'MaxDeliveryCountExceeded',
        },
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        direction: 'incoming',
        status: 'failed',
        isDeadLetter: true,
      },
      {
        id: 'msg-dlq-002',
        queueName: 'application-events',
        body: '{"eventName": "data.corrupted", "error": "Schema validation failed"}',
        properties: {
          severity: 'critical',
          retryCount: 5,
          failureReason: 'ValidationError',
        },
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        direction: 'incoming',
        status: 'failed',
        isDeadLetter: true,
      },
    ];
    setDlqMessages(dlq);
  }, []);

  const addMessage = (message: Message) => {
    setMessages([message, ...messages]);
  };

  const replayMessage = (messageId: string) => {
    setDlqMessages(dlqMessages.filter((m) => m.id !== messageId));
    const replayed = dlqMessages.find((m) => m.id === messageId);
    if (replayed) {
      setMessages([
        {
          ...replayed,
          status: 'replayed',
          isDeadLetter: false,
          timestamp: new Date().toISOString(),
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
