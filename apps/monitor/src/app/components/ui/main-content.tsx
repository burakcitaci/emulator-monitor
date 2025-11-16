import React from 'react';

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
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return <>{renderActiveTab()}</>;
}
