import { IsNotEmpty, IsOptional, IsNumber, IsString } from 'class-validator';

export class ReceiveRabbitmqMessageDto {
  @IsOptional()
  @IsString()
  queue?: string;

  @IsString()
  @IsNotEmpty()
  receivedBy!: string;

  @IsOptional()
  @IsNumber()
  maxMessages?: number; // Default 1
}

