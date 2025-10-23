'use client';

import React from 'react';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'react-hot-toast';

interface ProvidersProps {
  children: React.ReactNode;
}

const ThemeAwareToaster: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: theme === 'dark' ? {
          background: '#1f2937',
          color: '#f9fafb',
          border: '1px solid #374151',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          padding: '12px 16px',
        } : {
          background: '#ffffff',
          color: '#0c0a09',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          padding: '12px 16px',
        },
        success: {
          style: theme === 'dark' ? {
            background: '#1f2937',
            color: '#f9fafb',
            border: '1px solid #374151',
          } : {
            background: '#ffffff',
            color: '#0c0a09',
            border: '1px solid #e5e7eb',
          },
          iconTheme: {
            primary: '#10b981',
            secondary: theme === 'dark' ? '#1f2937' : '#ffffff',
          },
        },
        error: {
          style: theme === 'dark' ? {
            background: '#1f2937',
            color: '#f9fafb',
            border: '1px solid #374151',
          } : {
            background: '#ffffff',
            color: '#0c0a09',
            border: '1px solid #e5e7eb',
          },
          iconTheme: {
            primary: '#ef4444',
            secondary: theme === 'dark' ? '#1f2937' : '#ffffff',
          },
        },
      }}
    />
  );
};

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <ThemeAwareToaster />
    </ThemeProvider>
  );
};
