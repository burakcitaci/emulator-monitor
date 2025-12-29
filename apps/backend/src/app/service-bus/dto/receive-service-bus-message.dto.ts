import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReceiveServiceBusMessageDto {
  @IsOptional()
  @IsString()
  queue?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  subscription?: string;

  @IsString()
  @IsNotEmpty()
  receivedBy!: string;
}

