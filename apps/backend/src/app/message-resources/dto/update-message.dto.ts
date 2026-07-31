import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Provider, ResourceType } from '../message-resources.schema';

export class UpdateMessageResourceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Provider)
  provider?: Provider;

  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
