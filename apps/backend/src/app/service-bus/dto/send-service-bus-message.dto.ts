import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendServiceBusMessageDto {
  @IsOptional()
  @IsString()
  queue?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  sentBy?: string;

  @IsOptional()
  @IsString()
  receivedBy?: string;

  @IsOptional()
  @IsObject()
  applicationProperties?: Record<string, unknown>;
}
