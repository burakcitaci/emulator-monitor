import React from 'react';

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      <p className="ml-3 text-muted-foreground">Loading...</p>
    </div>
  );
}
