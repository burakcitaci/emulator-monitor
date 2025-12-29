import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class SendRabbitmqMessageDto {
  @IsOptional()
  @IsString()
  queue?: string;

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
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  expiration?: number; // Message TTL in milliseconds

  @IsOptional()
  @IsNumber()
  priority?: number; // Message priority (0-255)

  @IsOptional()
  @IsEnum(['complete', 'abandon', 'deadletter', 'defer'])
  messageDisposition?: 'complete' | 'abandon' | 'deadletter' | 'defer';
}

