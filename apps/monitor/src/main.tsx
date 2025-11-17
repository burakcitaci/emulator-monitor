import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import { ActiveThemeProvider } from './app/components/common/theme';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <ActiveThemeProvider>
      <App />
    </ActiveThemeProvider>
  </StrictMode>
);
