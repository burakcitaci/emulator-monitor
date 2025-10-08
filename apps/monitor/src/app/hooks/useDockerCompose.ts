import { useCallback, useState, useRef } from 'react';

interface ComposeContainer {
  Name: string;
  Command: string;
  Project: string;
  Service: string;
  State: string;
  Health: string;
  ExitCode: number;
  Publishers: Array<{
    URL: string;
    TargetPort: number;
    PublishedPort: number;
    Protocol: string;
  }>;
}

interface ComposeUpOptions {
  filePath?: string;
  projectName?: string;
  services?: string[];
}

interface ComposeDownOptions {
  filePath?: string;
  projectName?: string;
  removeVolumes?: boolean;
}

interface ComposeLogsOptions {
  filePath?: string;
  projectName?: string;
  service?: string;
  tail?: number;
}

interface ComposeRestartOptions {
  filePath?: string;
  projectName?: string;
  services?: string[];
}

interface UseDockerComposeReturn {
  containers: ComposeContainer[];
  logs: string;
  loading: boolean;
  error: Error | null;
  isRefreshing: boolean;
  fetchContainers: (
    options?: { filePath?: string; projectName?: string },
    isInitial?: boolean
  ) => Promise<void>;
  composeUp: (options?: ComposeUpOptions) => Promise<void>;
  composeDown: (options?: ComposeDownOptions) => Promise<void>;
  composeLogs: (options?: ComposeLogsOptions) => Promise<void>;
  composeRestart: (options?: ComposeRestartOptions) => Promise<void>;
}

export const useDockerCompose = (): UseDockerComposeReturn => {
  const [containers, setContainers] = useState<ComposeContainer[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasInitialLoad = useRef(false);

  const fetchContainers = useCallback(
    async (
      options?: { filePath?: string; projectName?: string },
      isInitial = false
    ) => {
      // Only show loading spinner on initial load
      if (isInitial || !hasInitialLoad.current) {
        setLoading(true);
      } else {
        // For subsequent refreshes, just set refreshing flag
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.filePath) params.append('filePath', options.filePath);
        if (options?.projectName)
          params.append('projectName', options.projectName);

        const url = `http://localhost:3000/api/v1/docker-compose/ps${
          params.toString() ? `?${params.toString()}` : ''
        }`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch containers: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          setContainers(data.containers || []);
          hasInitialLoad.current = true;
        } else {
          throw new Error(data.error || 'Failed to fetch containers');
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    []
  );

  const composeUp = useCallback(
    async (options?: ComposeUpOptions) => {
      setError(null);
      setLoading(true);

      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/docker-compose/up',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options || {}),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to run compose up: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to run compose up');
        }

        // Refresh the container list after compose up
        await fetchContainers(
          options
            ? { filePath: options.filePath, projectName: options.projectName }
            : undefined
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchContainers]
  );

  const composeDown = useCallback(
    async (options?: ComposeDownOptions) => {
      setError(null);
      setLoading(true);

      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/docker-compose/down',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options || {}),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to run compose down: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to run compose down');
        }

        // Refresh the container list after compose down
        await fetchContainers(
          options
            ? { filePath: options.filePath, projectName: options.projectName }
            : undefined
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchContainers]
  );

  const composeLogs = useCallback(async (options?: ComposeLogsOptions) => {
    setError(null);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (options?.filePath) params.append('filePath', options.filePath);
      if (options?.projectName)
        params.append('projectName', options.projectName);
      if (options?.service) params.append('service', options.service);
      if (options?.tail) params.append('tail', options.tail.toString());

      const url = `http://localhost:3000/api/v1/docker-compose/logs${
        params.toString() ? `?${params.toString()}` : ''
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setLogs(data.logs || '');
      } else {
        throw new Error(data.error || 'Failed to fetch logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const composeRestart = useCallback(
    async (options?: ComposeRestartOptions) => {
      setError(null);
      setLoading(true);

      try {
        const response = await fetch(
          'http://localhost:3000/api/v1/docker-compose/restart',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options || {}),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to restart services: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to restart services');
        }

        // Refresh the container list after restart
        await fetchContainers(
          options
            ? { filePath: options.filePath, projectName: options.projectName }
            : undefined
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchContainers]
  );

  return {
    containers,
    logs,
    loading,
    error,
    isRefreshing,
    fetchContainers,
    composeUp,
    composeDown,
    composeLogs,
    composeRestart,
  };
};
