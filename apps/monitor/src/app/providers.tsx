'use client';

import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { ActiveThemeProvider } from './components/common/theme';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingSpinner } from './components/ui/loading-spinner';

interface ProvidersProps {
  children: React.ReactNode;
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx errors
        if (
          error &&
          typeof error === 'object' &&
          'status' in error &&
          typeof error.status === 'number' &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  const isDev = import.meta.env.DEV;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ActiveThemeProvider>
            <Suspense fallback={<LoadingSpinner />}>
              {children}
            </Suspense>
            <Toaster />
          </ActiveThemeProvider>
        </ThemeProvider>
        {isDev && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
