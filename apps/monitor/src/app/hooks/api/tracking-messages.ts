import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/api-client';
import { TrackingMessage } from '../../lib/schemas';

// Query keys
export const trackingMessageKeys = {
  all: ['tracking-messages'] as const,
  lists: () => [...trackingMessageKeys.all, 'list'] as const,
  list: () => [...trackingMessageKeys.lists()] as const,
  details: () => [...trackingMessageKeys.all, 'detail'] as const,
  detail: (id: string) => [...trackingMessageKeys.details(), id] as const,
};

// Hooks
export const useTrackingMessages = () => {
  return useQuery({
    queryKey: trackingMessageKeys.list(),
    queryFn: () => apiClient.getTrackingMessages(),
    staleTime: 30000, // 30 seconds
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

export const useTrackingMessage = (id: string) => {
  return useQuery({
    queryKey: trackingMessageKeys.detail(id),
    queryFn: () => apiClient.getTrackingMessage(id),
    enabled: !!id,
    staleTime: 60000, // 1 minute
  });
};

export const useCreateTrackingMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: Partial<TrackingMessage>) =>
      apiClient.createTrackingMessage(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.lists() });
    },
  });
};

export const useUpdateTrackingMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: Partial<TrackingMessage> }) =>
      apiClient.updateTrackingMessage(id, message),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.detail(id) });
    },
  });
};

export const useDeleteTrackingMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTrackingMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trackingMessageKeys.lists() });
    },
  });
};