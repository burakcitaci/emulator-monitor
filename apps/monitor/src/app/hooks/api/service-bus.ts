import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { SendServiceBusMessage } from '../../lib/schemas';

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
  return useMutation({
    mutationFn: (message: SendServiceBusMessage) =>
      apiClient.sendMessage(message),
  });
};