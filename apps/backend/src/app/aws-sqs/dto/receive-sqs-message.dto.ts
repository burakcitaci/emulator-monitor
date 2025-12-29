import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';

export class ReceiveSqsMessageDto {
  @IsOptional()
  @IsString()
  queueUrl?: string;

  @IsString()
  @IsNotEmpty()
  receivedBy!: string;

  @IsOptional()
  @IsNumber()
  maxNumberOfMessages?: number; // 1-10, default 1

  @IsOptional()
  @IsNumber()
  waitTimeSeconds?: number; // 0-20, default 0 (short polling)
}

