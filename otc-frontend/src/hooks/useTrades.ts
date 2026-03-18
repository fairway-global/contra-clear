import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getAllTrades, getWalletTrades, type Trade } from '../lib/api';
import { useWSRefresh } from './useWebSocket';

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTrades(await getAllTrades());
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  useWSRefresh(['trade_completed'], refresh);

  return { trades, loading, refresh };
}

export function useWalletTrades() {
  const { publicKey } = useWallet();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      setTrades(await getWalletTrades(publicKey.toString()));
    } catch (err) {
      console.error('Failed to fetch wallet trades:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  useWSRefresh(['trade_completed'], refresh);

  return { trades, loading, refresh };
}
