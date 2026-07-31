import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Provider, ResourceType } from '../message-resources.schema';

export class CreateMessageResourceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(Provider)
  provider!: Provider;

  @IsEnum(ResourceType)
  type!: ResourceType;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
