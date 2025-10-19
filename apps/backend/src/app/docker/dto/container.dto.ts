/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ContainerOperationDto as BaseContainerOperationDto,
  ContainerCreateDto as BaseContainerCreateDto,
  ContainerLogsDto as BaseContainerLogsDto,
  ContainerStatsDto as BaseContainerStatsDto,
} from '@e2e-monitor/entities';

// Extend the base DTOs with validation decorators
export class ContainerOperationDto implements BaseContainerOperationDto {
  @IsString()
  @IsOptional()
  containerId?: string;

  @IsString()
  @IsOptional()
  containerName?: string;
}

export class ContainerCreateDto implements BaseContainerCreateDto {
  @IsString()
  Image?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  Hostname?: string;

  @IsOptional()
  @IsString()
  Domainname?: string;

  @IsOptional()
  @IsString()
  User?: string;

  @IsOptional()
  @IsBoolean()
  AttachStdin?: boolean;

  @IsOptional()
  @IsBoolean()
  AttachStdout?: boolean;

  @IsOptional()
  @IsBoolean()
  AttachStderr?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1024)
  @Max(65535)
  @Type(() => Number)
  ExposedPorts?: { [port: string]: any };

  @IsOptional()
  @IsString()
  Tty?: boolean;

  @IsOptional()
  @IsBoolean()
  OpenStdin?: boolean;

  @IsOptional()
  @IsBoolean()
  StdinOnce?: boolean;

  @IsOptional()
  @IsString()
  Env?: string[];

  @IsOptional()
  @IsString()
  Cmd?: string[];

  @IsOptional()
  @IsString()
  Entrypoint?: string[];

  @IsOptional()
  @IsString()
  WorkingDir?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  NetworkDisabled?: boolean;

  @IsOptional()
  @IsString()
  MacAddress?: string;

  @IsOptional()
  @IsString()
  OnBuild?: string[];

  @IsOptional()
  @IsString()
  Labels?: { [key: string]: string };

  @IsOptional()
  @IsString()
  StopSignal?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  StopTimeout?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  HealthCheck?: any;

  @IsOptional()
  @IsString()
  HostConfig?: any;

  @IsOptional()
  @IsString()
  NetworkingConfig?: any;
}

export class ContainerLogsDto implements BaseContainerLogsDto {
  @IsString()
  containerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  tail?: number = 100;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  timestamps?: boolean = true;
}

export class ContainerStatsDto implements BaseContainerStatsDto {
  @IsString()
  containerId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  stream?: boolean = false;
}
