import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class SendSqsMessageDto {
  @IsOptional()
  @IsString()
  queueUrl?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  sentBy?: string;

  @IsOptional()
  @IsString()
  messageGroupId?: string; // For FIFO queues

  @IsOptional()
  @IsString()
  messageDeduplicationId?: string; // For FIFO queues

  @IsOptional()
  @IsObject()
  messageAttributes?: Record<string, { DataType: string; StringValue?: string; BinaryValue?: string }>;

  @IsOptional()
  @IsNumber()
  delaySeconds?: number;

  @IsOptional()
  @IsEnum(['complete', 'abandon', 'deadletter', 'defer'])
  messageDisposition?: 'complete' | 'abandon' | 'deadletter' | 'defer';
}

