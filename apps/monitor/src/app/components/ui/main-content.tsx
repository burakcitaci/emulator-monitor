import React from 'react';
import { LoadingSpinner } from './loading-spinner';
import { ErrorAlert } from './error-alert';

interface MainContentProps {
  isLoading: boolean;
  error: string | null;
  renderActiveTab: () => React.ReactNode;
}

export function MainContent({
  isLoading,
  error,
  renderActiveTab,
}: MainContentProps) {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert error={error} />;
  return <>{renderActiveTab()}</>;
}
