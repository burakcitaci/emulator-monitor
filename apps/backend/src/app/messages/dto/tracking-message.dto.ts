import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  emulatorTypes,
  messageDispositions,
  trackingStatuses,
} from '../message.schema';

export class CreateTrackingMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId!: string;

  @IsString()
  body!: string;

  @IsString()
  @IsNotEmpty()
  sentBy!: string;

  @IsDateString()
  sentAt!: string;

  @IsOptional()
  @IsString()
  queue?: string;

  @IsOptional()
  @IsIn(trackingStatuses)
  status?: (typeof trackingStatuses)[number];

  @IsIn(emulatorTypes)
  emulatorType!: (typeof emulatorTypes)[number];
}

export class UpdateTrackingMessageDto {
  @IsOptional()
  @IsIn(trackingStatuses)
  status?: (typeof trackingStatuses)[number];

  @IsOptional()
  @IsString()
  receivedBy?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsIn(messageDispositions)
  disposition?: (typeof messageDispositions)[number];
}
