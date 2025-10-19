import { useCallback, useState } from 'react';
import Docker from 'dockerode';
interface UseDockerReturn {
  containers: Docker.ContainerInfo[];
  loading: boolean;
  error: Error | null;
  fetchContainers: () => Promise<void>;
  startContainer: (containerId: string) => Promise<void>;
  stopContainer: (containerId: string) => Promise<void>;
}

export const useDocker = (): UseDockerReturn => {
  const [containers, setContainers] = useState<Docker.ContainerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchContainers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3000/api/v1/docker`);
      if (!response.ok) throw new Error('Failed to fetch containers');
      const data = (await response.json()) as Docker.ContainerInfo[];
      setContainers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setContainers([]);
    } finally {
      setLoading(false);
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
    fetchContainers,
    startContainer,
    stopContainer,
  };
};
