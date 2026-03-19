import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { PlatformProvider } from './hooks/usePlatform';
import './styles/globals.css';

function Root() {
  return (
    <PlatformProvider>
      <AuthProvider>
        <>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#111111',
                color: '#e0e0e0',
                border: '1px solid #1e1e1e',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.75rem',
              },
            }}
          />
        </>
      </AuthProvider>
    </PlatformProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
