// message.mapper.ts
import { ServiceBusMessage, ServiceBusReceivedMessage } from '@azure/service-bus';
import { Message } from './message.schema';

type AzureMsg = ServiceBusMessage | ServiceBusReceivedMessage;

export function mapToDocument(msg: AzureMsg): Partial<Message> {
  const doc: Partial<Message> = {
    body: msg.body,
    messageId:
      typeof msg.messageId === 'object' ? JSON.stringify(msg.messageId) : msg.messageId,
    contentType: msg.contentType ?? undefined,
    correlationId:
      typeof msg.correlationId === 'object'
        ? JSON.stringify(msg.correlationId)
        : msg.correlationId,
    partitionKey: msg.partitionKey ?? undefined,
    sessionId: msg.sessionId ?? undefined,
    replyToSessionId: msg.replyToSessionId ?? undefined,
    timeToLive: msg.timeToLive ?? undefined,
    subject: msg.subject ?? undefined,
    to: msg.to ?? undefined,
    replyTo: msg.replyTo ?? undefined,
    scheduledEnqueueTimeUtc: msg.scheduledEnqueueTimeUtc ?? undefined,
    applicationProperties: msg.applicationProperties ?? undefined,
  };

  // Only available on ServiceBusReceivedMessage
  if ('state' in msg) {
    doc['state'] = msg.state;
    doc['rawAmqpMessage'] = msg._rawAmqpMessage ? { ...msg._rawAmqpMessage } : undefined;
  }

  return doc;
}
