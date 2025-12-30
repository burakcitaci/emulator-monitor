import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { SendSqsMessage, ReceiveSqsMessage } from '../../lib/schemas';
import { trackingMessageKeys } from './tracking-messages';

// Query keys
export const awsSqsKeys = {
  all: ['aws-sqs'] as const,
  config: () => [...awsSqsKeys.all, 'config'] as const,
  messages: () => [...awsSqsKeys.all, 'messages'] as const,
};

// Hooks
export const useAwsSqsConfig = () => {
  return useQuery({
    queryKey: awsSqsKeys.config(),
    queryFn: () => apiClient.getAwsSqsConfig(),
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

export const useSendSqsMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: SendSqsMessage) =>
      apiClient.sendSqsMessage(message),
    onSuccess: () => {
      // Invalidate tracking messages to refresh the list
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};

export const useReceiveSqsMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: ReceiveSqsMessage) =>
      apiClient.receiveSqsMessage(message),
    onSuccess: () => {
      // Invalidate tracking messages to refresh the list
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.all });
    },
  });
};

export const useGetSqsMessages = () => {
  return useQuery({
    queryKey: awsSqsKeys.messages(),
    queryFn: () => apiClient.getAwsSqsMessages(),
  });
};