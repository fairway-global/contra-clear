import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { API_BASE } from '../lib/constants';

let authToken: string | null = null;

// Global getter so api.ts can access the token
export function getAuthToken(): string | null {
  return authToken;
}

export function useAuth() {
  const { publicKey, signMessage, connected } = useWallet();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    setLoading(true);
    try {
      const timestamp = Date.now();
      const message = `Login to Contra OTC Desk\ntimestamp:${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);

      // Encode signature as base58
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

      const sigBase58 = toBase58(signature);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          message,
          signature: sigBase58,
        }),
      });

      const data = await res.json();
      if (data.token) {
        authToken = data.token;
        (window as any).__authToken = data.token;
        setAuthenticated(true);
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Auth failed:', err);
      authToken = null;
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage]);

  useEffect(() => {
    if (!connected) {
      authToken = null;
      (window as any).__authToken = null;
      setAuthenticated(false);
    }
  }, [connected]);

  return { authenticated, loading, login };
}
