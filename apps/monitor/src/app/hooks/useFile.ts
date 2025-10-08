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
    console.log('Fetching file:', name, 'isInitial:', isInitial);

    // Only show loading spinner on initial load
    if (isInitial || !hasInitialLoad.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const url = `http://localhost:3000/api/v1/file/${name}`;
      console.log('Making API call to:', url);
      const response = await fetch(url);

      console.log('File response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('File response error text:', errorText);
        throw new Error(
          `Failed to fetch file: ${response.statusText} - ${errorText}`
        );
      }

      const fileResponse = await response.text();
      console.log('File content length:', fileResponse.length);

      try {
        const yamlContent = yaml.parse(fileResponse) as DockerCompose;
        const fileData = { name: name, content: yamlContent };
        console.log('Parsed YAML successfully');

        setData(fileData);
        hasInitialLoad.current = true;
      } catch (parseError) {
        console.error('YAML parsing error:', parseError);
        throw new Error(`Failed to parse YAML file: ${parseError}`);
      }
    } catch (err) {
      console.error('Fetch file error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchFile };
};
