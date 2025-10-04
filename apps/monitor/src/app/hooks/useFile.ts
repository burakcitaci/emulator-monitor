import { useState, useCallback, useRef } from 'react';
import { DockerCompose } from '../types/dockerCompose';
import yaml from 'yaml';
interface FileData {
  // Define the structure of your file response here
  // For example:
  name: string;
  content: DockerCompose;
  // Add other properties based on what your service returns
}

interface UseFileReturn {
  data: FileData | null;
  loading: boolean;
  error: Error | null;
  fetchFile: (name: string, isInitial?: boolean) => Promise<void>;
}

export const useFile = (): UseFileReturn => {
  const [data, setData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasInitialLoad = useRef(false);

  const fetchFile = useCallback(async (name: string, isInitial = false) => {
    // Only show loading spinner on initial load
    if (isInitial || !hasInitialLoad.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`http://localhost:3000/api/file/${name}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const fileResponse = await response.text();

      const yamlContent = yaml.parse(fileResponse) as DockerCompose;
      const fileData = { name: name, content: yamlContent };

      setData(fileData);
      hasInitialLoad.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchFile };
};
