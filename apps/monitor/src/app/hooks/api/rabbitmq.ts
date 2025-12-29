import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { SendRabbitmqMessage, ReceiveRabbitmqMessage } from '../../lib/schemas';
import { trackingMessageKeys } from './tracking-messages';

// Query keys
export const rabbitmqKeys = {
  all: ['rabbitmq'] as const,
  config: () => [...rabbitmqKeys.all, 'config'] as const,
};

// Hooks
export const useRabbitmqConfig = () => {
  return useQuery({
    queryKey: rabbitmqKeys.config(),
    queryFn: () => apiClient.getRabbitmqConfig(),
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

export const useSendRabbitmqMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: SendRabbitmqMessage) =>
      apiClient.sendRabbitmqMessage(message),
    onSuccess: () => {
      // Invalidate tracking messages to refresh the list
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};

export const useReceiveRabbitmqMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: ReceiveRabbitmqMessage) =>
      apiClient.receiveRabbitmqMessage(message),
    onSuccess: () => {
      // Invalidate tracking messages to refresh the list
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};

