import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { API_BASE } from '../lib/constants';

const AUTH_STORAGE_KEY = 'contra_otc_auth';

// Restore from sessionStorage on load
let authToken: string | null = null;
let authWallet: string | null = null;

try {
  const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    authToken = parsed.token;
    authWallet = parsed.wallet;
    (window as any).__authToken = authToken;
  }
} catch {}

function persistAuth(token: string | null, wallet: string | null) {
  authToken = token;
  authWallet = wallet;
  (window as any).__authToken = token;
  if (token && wallet) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, wallet }));
  } else {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function useAuth() {
  const { publicKey, signMessage, connected } = useWallet();
  const [authenticated, setAuthenticated] = useState(() => {
    // Restore auth state if wallet matches
    return Boolean(authToken && authWallet && publicKey && authWallet === publicKey.toString());
  });
  const [loading, setLoading] = useState(false);

  // On connect: restore session if token matches wallet
  useEffect(() => {
    if (!connected || !publicKey) return;

    if (authWallet && authWallet !== publicKey.toString()) {
      persistAuth(null, null);
      setAuthenticated(false);
      return;
    }

    if (authToken && authWallet === publicKey.toString()) {
      setAuthenticated(true);
    }
  }, [connected, publicKey]);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setLoading(true);
    try {
      const timestamp = Date.now();
      const message = `Login to Contra OTC Desk\ntimestamp:${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);

      const bs58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      function toBase58(bytes: Uint8Array): string {
        const digits = [0];
        for (const byte of bytes) {
          let carry = byte;
          for (let j = 0; j < digits.length; j++) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = (carry / 58) | 0;
          }
          while (carry > 0) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
          }
        }
        let str = '';
        for (let i = 0; i < bytes.length && bytes[i] === 0; i++) str += '1';
        for (let i = digits.length - 1; i >= 0; i--) str += bs58chars[digits[i]];
        return str;
      }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          message,
          signature: toBase58(signature),
        }),
      });

      const data = await res.json();
      if (data.token) {
        persistAuth(data.token, publicKey.toString());
        setAuthenticated(true);
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Auth failed:', err);
      persistAuth(null, null);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage]);

  useEffect(() => {
    if (!connected) {
      persistAuth(null, null);
      setAuthenticated(false);
    }
  }, [connected]);

  return { authenticated, loading, login };
}
