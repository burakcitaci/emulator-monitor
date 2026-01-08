import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../../lib/api-client';
import { SendSqsMessage, ReceiveSqsMessage } from '../../../lib/schemas';
import { trackingMessageKeys } from '../../../hooks/api/tracking-messages';
import { toast } from 'sonner';

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

export const useDeleteSqsMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTrackingMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: awsSqsKeys.messages() });
    },
    onError: (error) => {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message', {
        description: 'Please try again.',
      });
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
    staleTime: 5000,
    refetchInterval: 3000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
};