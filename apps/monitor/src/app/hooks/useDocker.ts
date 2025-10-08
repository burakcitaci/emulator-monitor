import { useCallback, useState, useRef } from 'react';
import Docker from 'dockerode';
interface UseDockerReturn {
  containers: Docker.ContainerInfo[];
  loading: boolean;
  error: Error | null;
  isRefreshing: boolean;
  fetchContainers: (isInitial?: boolean) => Promise<void>;
  startContainer: (containerId: string) => Promise<void>;
  stopContainer: (containerId: string) => Promise<void>;
}

export const useDocker = (): UseDockerReturn => {
  const [containers, setContainers] = useState<Docker.ContainerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasInitialLoad = useRef(false);

  const fetchContainers = useCallback(async (isInitial = false) => {
    console.log('Fetching containers, isInitial:', isInitial);

    // Only show loading spinner on initial load
    if (isInitial || !hasInitialLoad.current) {
      setLoading(true);
    } else {
      // For subsequent refreshes, just set refreshing flag
      setIsRefreshing(true);
    }
    setError(null);

    try {
      console.log('Making API call to:', `http://localhost:3000/api/v1/docker`);
      const response = await fetch(`http://localhost:3000/api/v1/docker`);

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        throw new Error(
          `Failed to fetch containers: ${response.statusText} - ${errorText}`
        );
      }

      const containers = (await response.json()) as Docker.ContainerInfo[];
      console.log('Received containers:', containers.length);
      setContainers(containers);
      hasInitialLoad.current = true;
    } catch (err) {
      console.error('Fetch containers error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const startContainer = useCallback(
    async (containerId: string) => {
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:3000/api/v1/docker/${containerId}/start`,
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to start container: ${response.statusText}`);
        }

        // Refresh the container list after starting
        await fetchContainers();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err; // Re-throw so the caller can handle it if needed
      }
    },
    [fetchContainers]
  );

  const stopContainer = useCallback(
    async (containerId: string) => {
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:3000/api/v1/docker/${containerId}/stop`,
          {
            method: 'POST',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to stop container: ${response.statusText}`);
        }

        // Refresh the container list after stopping
        await fetchContainers();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err; // Re-throw so the caller can handle it if needed
      }
    },
    [fetchContainers]
  );

  return {
    containers,
    loading,
    error,
    isRefreshing,
    fetchContainers,
    startContainer,
    stopContainer,
  };
};
