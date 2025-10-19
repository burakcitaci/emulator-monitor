import { useState, useCallback, useRef } from 'react';
import yaml from 'yaml';

interface FileData<T> {
  name: string;
  content: T;
}

interface UseFileReturn<T> {
  data: FileData<T> | null;
  loading: boolean;
  error: Error | null;
  fetchFile: (name: string, isInitial?: boolean) => Promise<void>;
}

export const useFile = <T = unknown>(): UseFileReturn<T> => {
  const [data, setData] = useState<FileData<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasInitialLoad = useRef(false);

  const fetchFile = useCallback(async (name: string, isInitial = false) => {
    if (isInitial || !hasInitialLoad.current) {
      setLoading(true);
    }

    try {
      const response = await fetch(`/${name}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const text = await response.text();
      const parsed: T = name.endsWith('.json')
        ? JSON.parse(text)
        : yaml.parse(text);

      setData({ name, content: parsed });
      setError(null);
      hasInitialLoad.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchFile };
};
