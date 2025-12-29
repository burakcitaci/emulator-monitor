import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { SendServiceBusMessage, ReceiveServiceBusMessage } from '../../lib/schemas';
import { trackingMessageKeys } from './tracking-messages';

// Query keys
export const serviceBusKeys = {
  all: ['service-bus'] as const,
  config: () => [...serviceBusKeys.all, 'config'] as const,
};

// Hooks
export const useServiceBusConfig = () => {
  return useQuery({
    queryKey: serviceBusKeys.config(),
    queryFn: () => apiClient.getServiceBusConfig(),
    staleTime: 300000, // 5 minutes - config doesn't change often
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

export const useSendServiceBusMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: SendServiceBusMessage) =>
      apiClient.sendMessage(message),
    onSuccess: () => {
      // Invalidate tracking messages to refresh the list
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};

export const useReceiveServiceBusMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: ReceiveServiceBusMessage) =>
      apiClient.receiveMessage(message),
    onSuccess: () => {
      // Invalidate tracking messages to refresh the list
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};