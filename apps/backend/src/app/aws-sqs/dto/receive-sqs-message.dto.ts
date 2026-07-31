import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class ReceiveSqsMessageDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  queueUrl?: string;

  @IsString()
  @IsNotEmpty()
  receivedBy!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxNumberOfMessages?: number; // 1-10, default 1

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  waitTimeSeconds?: number; // 0-20, default 0 (short polling)
}
