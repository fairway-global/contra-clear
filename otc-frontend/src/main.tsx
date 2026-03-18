import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { Toaster } from 'react-hot-toast';

import App from './App';
import './styles/globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';

// Use the Contra gateway as the default endpoint for channel operations
// Users switch to localhost:18899 for on-chain deposits (handled in deposit flow)
const ENDPOINT = 'http://localhost:8899';

function Root() {
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
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
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
