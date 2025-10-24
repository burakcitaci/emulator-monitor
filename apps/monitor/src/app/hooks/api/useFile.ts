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
      let response: Response | null = null;
      let lastError: Error | null = null;

      // Try fetching from public directory first (direct file access)
      try {
        response = await fetch(`/${name}`);
        if (response.ok) {
          const text = await response.text();
          
          // Parse the response
          let parsed: T;
          try {
            if (name.endsWith('.json')) {
              parsed = JSON.parse(text) as T;
            } else {
              // For YAML files
              parsed = yaml.parse(text) as T;
            }
          } catch (parseError) {
            const msg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
            throw new Error(`Failed to parse ${name}: ${msg}`);
          }

          setData({ name, content: parsed });
          setError(null);
          hasInitialLoad.current = true;
          setLoading(false);
          return;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to fetch from public directory');
      }

      // Fallback to backend API with versioning
      try {
        response = await fetch(`http://localhost:3000/api/v1/file/${name}`);
        
        if (response.ok) {
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
              // Direct file content
              if (name.endsWith('.json')) {
                parsed = json as T;
              } else {
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
          setLoading(false);
          return;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Failed to fetch from backend');
      }

      // If both methods failed, throw error
      throw lastError || new Error(`Failed to fetch ${name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching file';
      console.error(`Error loading file:`, errorMessage);
      setError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchFile };
};
