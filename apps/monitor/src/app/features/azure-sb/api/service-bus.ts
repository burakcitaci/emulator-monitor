import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../../lib/api-client';
import { SendServiceBusMessage, ReceiveServiceBusMessage } from '../../../lib/schemas';
import { toast } from 'sonner';


// Query keys
export const serviceBusKeys = {
  all: ['service-bus'] as const,
  config: () => [...serviceBusKeys.all, 'config'] as const,
  messages: () => [...serviceBusKeys.all, 'messages'] as const,
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
      // Invalidate to trigger refetch
      queryClient.invalidateQueries({
        queryKey: serviceBusKeys.messages(),
        exact: true,
      });
      
      toast.success('Message sent', {
        description: 'Your message has been sent successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
      
      // On error, revert optimistic update
      queryClient.invalidateQueries({
        queryKey: serviceBusKeys.messages(),
        exact: true,
      });
      
      toast.error('Failed to send message', {
        description: error instanceof ApiError 
          ? error.message 
          : 'An unexpected error occurred. Please try again.',
      });
    },
  });
};

export const useDeleteServiceBusMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTrackingMessage(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: serviceBusKeys.messages(),
      });

      toast.success('Message deleted', {
        description: 'The tracking message has been removed.',
      });
    },

    onError: (error) => {
      console.error('Failed to delete message:', error);

      toast.error('Failed to delete message', {
        description: error instanceof ApiError 
          ? error.message 
          : 'Please try again.',
      });
    },
  });
};


export const useReceiveServiceBusMessage = () => {

  return useMutation({
    mutationFn: (message: ReceiveServiceBusMessage) =>
      apiClient.receiveMessage(message),
    onSuccess: () => {
      toast.success('Message received', {
        description: 'The message has been processed successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to receive message:', error);
      
      toast.error('Failed to receive message', {
        description: error instanceof ApiError 
          ? error.message 
          : 'An unexpected error occurred. Please try again.',
      });
    },
  });
};

export const useGetServiceBusMessages = () => {
  return useQuery({
    queryKey: serviceBusKeys.messages(),
    staleTime: 5000,
    refetchInterval: 3000,
    queryFn: () => apiClient.getServiceBusMessages(),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
};