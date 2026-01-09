import { Provider, ResourceType } from "../message-resources.schema";

export interface CreateMessageResourceDto {
  name: string;
  provider: Provider;
  type: ResourceType;
  status: 'active' | 'inactive';
}
