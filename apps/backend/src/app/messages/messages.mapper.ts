// message.mapper.ts
import {
  ServiceBusMessage,
  ServiceBusReceivedMessage,
} from '@azure/service-bus';
import { Message, MessageState } from './message.schema';

export function mapToMessage(msg: ServiceBusMessage): Partial<Message> {
  return {
    messageId: normalizeValue(msg.messageId),
    body: msg.body,
    contentType: msg.contentType,
    correlationId: normalizeValue(msg.correlationId),
    partitionKey: msg.partitionKey,
    sessionId: msg.sessionId,
    replyToSessionId: msg.replyToSessionId,
    timeToLive: msg.timeToLive,
    subject: msg.subject,
    to: msg.to,
    replyTo: msg.replyTo,
    scheduledEnqueueTimeUtc: msg.scheduledEnqueueTimeUtc,
    applicationProperties: msg.applicationProperties
      ? new Map(Object.entries(msg.applicationProperties))
      : undefined,
    state: MessageState.ACTIVE,
    lastUpdated: new Date(),
  };
}

function normalizeValue(
  value: string | number | Buffer | undefined
): string | number | undefined {
  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8'); // or 'hex' if needed
  }
  return value;
}
