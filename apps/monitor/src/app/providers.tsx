'use client';

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { ActiveThemeProvider } from './components/common/theme';
import { Toaster } from './components/ui/sonner';


interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <ActiveThemeProvider>
        {children}
        <Toaster />
      </ActiveThemeProvider>
    </ThemeProvider>
  );
};
