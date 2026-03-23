import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getBalances, type ChannelBalance } from '../lib/api';
import { registerBalanceTokens, subscribeTokenRegistry } from '../lib/constants';

interface BalanceSnapshot {
  channelBalances: ChannelBalance[];
  onChainBalances: ChannelBalance[];
  loading: boolean;
  lastUpdatedAt: number | null;
}

const EMPTY_SNAPSHOT: BalanceSnapshot = {
  channelBalances: [],
  onChainBalances: [],
  loading: false,
  lastUpdatedAt: null,
};

// Keep one shared balance cache per wallet so pages don't flicker between separate polls.
const balanceStore = new Map<string, BalanceSnapshot>();
const balanceListeners = new Map<string, Set<(snapshot: BalanceSnapshot) => void>>();
const pollingTimers = new Map<string, number>();
const subscriberCounts = new Map<string, number>();
const inFlightRefreshes = new Map<string, Promise<BalanceSnapshot>>();

function getSnapshot(walletAddress: string | null): BalanceSnapshot {
  if (!walletAddress) {
    return EMPTY_SNAPSHOT;
  }
  return balanceStore.get(walletAddress) || EMPTY_SNAPSHOT;
}

function emitSnapshot(walletAddress: string): void {
  const snapshot = getSnapshot(walletAddress);
  balanceListeners.get(walletAddress)?.forEach((listener) => listener(snapshot));
}

function setSnapshot(walletAddress: string, snapshot: BalanceSnapshot): void {
  balanceStore.set(walletAddress, snapshot);
  emitSnapshot(walletAddress);
}

async function refreshWalletBalances(walletAddress: string, silent = false): Promise<BalanceSnapshot> {
  const existingRequest = inFlightRefreshes.get(walletAddress);
  if (existingRequest) {
    return existingRequest;
  }

  const current = getSnapshot(walletAddress);
  if (!silent) {
    setSnapshot(walletAddress, {
      ...current,
      loading: true,
    });
  }

  const request = (async () => {
    try {
      const data = await getBalances(walletAddress);
      const nextSnapshot: BalanceSnapshot = {
        channelBalances: data.channel || [],
        onChainBalances: data.onChain || [],
        loading: false,
        lastUpdatedAt: Date.now(),
      };

      registerBalanceTokens(nextSnapshot.channelBalances);
      registerBalanceTokens(nextSnapshot.onChainBalances);
      setSnapshot(walletAddress, nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      const nextSnapshot: BalanceSnapshot = {
        ...getSnapshot(walletAddress),
        loading: false,
      };
      setSnapshot(walletAddress, nextSnapshot);
      return nextSnapshot;
    } finally {
      inFlightRefreshes.delete(walletAddress);
    }
  })();

  inFlightRefreshes.set(walletAddress, request);
  return request;
}

function startPolling(walletAddress: string): void {
  const nextCount = (subscriberCounts.get(walletAddress) || 0) + 1;
  subscriberCounts.set(walletAddress, nextCount);

  if (pollingTimers.has(walletAddress)) {
    return;
  }

  void refreshWalletBalances(walletAddress);
  const timer = window.setInterval(() => {
    void refreshWalletBalances(walletAddress, true);
  }, 5000);
  pollingTimers.set(walletAddress, timer);
}

function stopPolling(walletAddress: string): void {
  const nextCount = (subscriberCounts.get(walletAddress) || 0) - 1;
  if (nextCount > 0) {
    subscriberCounts.set(walletAddress, nextCount);
    return;
  }

  subscriberCounts.delete(walletAddress);
  const timer = pollingTimers.get(walletAddress);
  if (timer) {
    window.clearInterval(timer);
    pollingTimers.delete(walletAddress);
  }
}

export function useBalances() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toString() || null;
  const [snapshot, setSnapshotState] = useState<BalanceSnapshot>(() => getSnapshot(walletAddress));

  useEffect(() => {
    setSnapshotState(getSnapshot(walletAddress));

    if (!walletAddress) {
      return;
    }

    const walletListeners = balanceListeners.get(walletAddress) || new Set<(snapshot: BalanceSnapshot) => void>();
    balanceListeners.set(walletAddress, walletListeners);

    const handleSnapshot = (nextSnapshot: BalanceSnapshot) => {
      setSnapshotState(nextSnapshot);
    };

    walletListeners.add(handleSnapshot);
    startPolling(walletAddress);

    return () => {
      walletListeners.delete(handleSnapshot);
      if (walletListeners.size === 0) {
        balanceListeners.delete(walletAddress);
      }
      stopPolling(walletAddress);
    };
  }, [walletAddress]);

  useEffect(() => {
    return subscribeTokenRegistry(() => {
      if (!walletAddress) {
        return;
      }

      setSnapshotState((current) => ({
        ...current,
        channelBalances: [...current.channelBalances],
        onChainBalances: [...current.onChainBalances],
      }));
    });
  }, [walletAddress]);

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      return EMPTY_SNAPSHOT;
    }
    return refreshWalletBalances(walletAddress);
  }, [walletAddress]);

  return {
    channelBalances: snapshot.channelBalances,
    onChainBalances: snapshot.onChainBalances,
    loading: snapshot.loading,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    refresh,
  };
}
