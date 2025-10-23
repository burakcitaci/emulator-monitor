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
      // Try backend API with versioning, then fallback to public directory
      let response = await fetch(`http://localhost:3000/api/v1/file/${name}`);
      
      // If backend fails, try public directory (for production builds)
      if (!response.ok) {
        response = await fetch(`/${name}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch ${name}: ${response.statusText}`);
      }

      const text = await response.text();
      
      // Handle HTML error responses
      if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error(`Backend returned HTML error. Backend may not be running on http://localhost:3000`);
      }

      // Parse the response
      let parsed: T;
      try {
        // First try to parse as JSON (API response format: {name, content})
        const json = JSON.parse(text);
        
        if (json.content !== undefined) {
          // Response from backend API with {name, content} structure
          const rawContent = json.content;
          
          // Now parse the actual file content based on file type
          if (name.endsWith('.json')) {
            if (typeof rawContent === 'string') {
              parsed = JSON.parse(rawContent) as T;
            } else {
              parsed = rawContent as T;
            }
          } else {
            // For YAML or other formats
            if (typeof rawContent === 'string') {
              parsed = yaml.parse(rawContent) as T;
            } else {
              parsed = rawContent as T;
            }
          }
        } else {
          // Direct file content (from public directory)
          if (name.endsWith('.json')) {
            parsed = json as T;
          } else {
            // This was already parsed as JSON, but it's supposed to be YAML
            throw new Error(`Expected YAML file but got JSON: ${name}`);
          }
        }
      } catch (parseError) {
        const msg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Failed to parse ${name}: ${msg}`);
      }

      setData({ name, content: parsed });
      setError(null);
      hasInitialLoad.current = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching file';
      console.error(`Error loading ${name}:`, errorMessage);
      setError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchFile };
};
