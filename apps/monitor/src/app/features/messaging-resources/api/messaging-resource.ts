import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { MessageResources } from "../../../lib/schemas";

export const useGetMessageResources = () => {
  return useQuery({
    queryKey: ['message-resources'],
    queryFn: () => apiClient.getMessageResources(),
  });
};

export const useCreateMessageResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resource: MessageResources) => apiClient.createMessageResource(resource),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-resources'] });
    },
  });
};