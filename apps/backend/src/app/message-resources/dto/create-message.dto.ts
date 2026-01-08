import { Provider, ResourceType } from "../message-resources.schema";

export type CreateMessageResourceDto = {
  name: string;
  provider: Provider;
  type: ResourceType;
  region: string;
  status: 'active' | 'inactive';
}