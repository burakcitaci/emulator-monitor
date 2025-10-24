/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared types and interfaces between backend and frontend
import { ServiceBusMessage } from '@azure/service-bus';
import { MessageState } from './message-state';
// Service Bus Configuration Types
export interface ServiceBusNamespace {
  Name: string;
  Topics?: ServiceBusTopic[];
  Queues?: ServiceBusQueue[];
}

export interface TopicProperties {
  DefaultMessageTimeToLive: string;
  DuplicateDetectionHistoryTimeWindow: string;
  RequiresDuplicateDetection: boolean;
}

export interface ServiceBusSubscription {
  Name: string;
  DeadLetteringOnMessageExpiration: boolean;
  MaxDeliveryCount: number;
}

export interface ServiceBusTopic {
  Name: string;
  Properties: TopicProperties;
  Subscriptions: ServiceBusSubscription[];
}

export interface QueueProperties {
  DefaultMessageTimeToLive: string;
  MaxDeliveryCount: number;
  DeadLetteringOnMessageExpiration: boolean;
}

export interface ServiceBusQueue {
  Name: string;
  Properties: QueueProperties;
}

export interface ServiceBusConfig {
  UserConfig: {
    Namespaces: ServiceBusNamespace[];
    Logging: {
      Type: string;
    };
  };
}

// Service Bus DTOs
export interface SendMessageDto {
  namespace: string;
  topic: string;
  message: {
    body: any;
    contentType?: string;
    messageId?: string | number;
    correlationId?: string;
    subject?: string;
    applicationProperties?: Record<string, any>;
  };
}

export interface SendBatchDto {
  namespace: string;
  topic: string;
  messages: Array<{
    body: any;
    contentType?: string;
    messageId?: string | number;
    correlationId?: string;
    subject?: string;
    applicationProperties?: Record<string, any>;
  }>;
}

export interface InitializeDto {
  config: ServiceBusConfig;
  connectionString: string;
}

// Service Bus Response Types
export interface SendMessageResponse {
  success: boolean;
  message: string;
  messageId?: string | number;
  namespace?: string;
  topic?: string;
}

export interface SendBatchResponse {
  success: boolean;
  message: string;
  messageCount?: number;
  namespace?: string;
  topic?: string;
}

export interface InitializeResponse {
  success: boolean;
  message: string;
  namespaces: Array<{
    name: string;
    topics: string[];
  }>;
}

export interface NamespaceInfo {
  name: string;
  topics: Array<{
    name: string;
    properties: {
      DefaultMessageTimeToLive: string;
      DuplicateDetectionHistoryTimeWindow: string;
      RequiresDuplicateDetection: boolean;
    };
    subscriptions: Array<{
      name: string;
      deadLetteringOnMessageExpiration: boolean;
      maxDeliveryCount: number;
    }>;
  }>;
}

export interface GetNamespacesResponse {
  success: boolean;
  message?: string;
  namespaces: NamespaceInfo[];
}

// Docker Types
export interface DockerService {
  container_name?: string;
  image?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: string[];
  networks?: Record<string, { aliases?: string[] }>;
}

export interface DockerCompose {
  name?: string;
  version?: string;
  services: Record<string, DockerService>;
}

export function loadDockerCompose(path: string): DockerCompose {
  const fs = require('fs');
  const yaml = require('yaml');
  const file = fs.readFileSync(path, 'utf8');
  return yaml.parse(file) as DockerCompose;
}

// Docker DTOs
export interface ContainerOperationDto {
  containerId?: string;
  containerName?: string;
}

export interface ContainerCreateDto {
  Image?: string;
  name?: string;
  Hostname?: string;
  Domainname?: string;
  User?: string;
  AttachStdin?: boolean;
  AttachStdout?: boolean;
  AttachStderr?: boolean;
  ExposedPorts?: { [port: string]: any };
  Tty?: boolean;
  OpenStdin?: boolean;
  StdinOnce?: boolean;
  Env?: string[];
  Cmd?: string[];
  Entrypoint?: string[];
  WorkingDir?: string;
  NetworkDisabled?: boolean;
  MacAddress?: string;
  OnBuild?: string[];
  Labels?: { [key: string]: string };
  StopSignal?: string;
  StopTimeout?: number;
  HealthCheck?: any;
  HostConfig?: any;
  NetworkingConfig?: any;
}

export interface ContainerLogsDto {
  containerId?: string;
  tail?: number;
  timestamps?: boolean;
}

export interface ContainerStatsDto {
  containerId?: string;
  stream?: boolean;
}

// Frontend-specific types (these might be moved to frontend-specific shared library)
export interface QueueTopicItem {
  name: string;
  type: 'queue' | 'topic' | 'subscription';
  namespace: string;
  parentTopic?: string;
  properties: QueueProperties | TopicProperties;
}

export type MessageDirection = 'incoming' | 'outgoing';

export interface Message {
  id: string;
  messageId: string;
  queue: string;
  body: string | Record<string, unknown>;
  properties: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  state: MessageState;
}

export interface ConnectionInfo {
  isConnected: boolean;
  isLocal: boolean;
  endpoint: string;
  connectionString: string;
}

export interface SendForm {
  queueName: string;
  body: string;
  properties: string;
  subject: string;
}

export interface ConnectionForm {
  connectionString: string;
  queues: string;
}

export interface DeadLetterMessageResponse {
  success: true;
  messageCount: number;
  messages: ServiceBusMessage[];
  entityPath: string;
}
