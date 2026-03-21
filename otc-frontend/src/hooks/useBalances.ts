import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getBalances, type ChannelBalance } from '../lib/api';
import { registerBalanceTokens } from '../lib/constants';

export function useBalances() {
  const { publicKey } = useWallet();
  const [channelBalances, setChannelBalances] = useState<ChannelBalance[]>([]);
  const [onChainBalances, setOnChainBalances] = useState<ChannelBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const data = await getBalances(publicKey.toString());
      setChannelBalances(data.channel || []);
      setOnChainBalances(data.onChain || []);
      registerBalanceTokens(data.channel || []);
      registerBalanceTokens(data.onChain || []);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { channelBalances, onChainBalances, loading, refresh };
}
