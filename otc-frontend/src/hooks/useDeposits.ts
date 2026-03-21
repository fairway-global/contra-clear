import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getWalletDeposits, type DepositRecord } from '../lib/api';

export function useDeposits() {
  const { publicKey } = useWallet();
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setDeposits([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getWalletDeposits(publicKey.toString());
      setDeposits(data);
    } catch (err) {
      console.error('Failed to fetch deposits:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { deposits, loading, refresh };
}
