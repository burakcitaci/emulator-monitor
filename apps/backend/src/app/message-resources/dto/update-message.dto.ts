import { Provider, ResourceType } from "../message-resources.schema";

export type UpdateMessageResourceDto = {
  name?: string;
  provider?: Provider;
  type?: ResourceType;
  status?: 'active' | 'inactive';
}