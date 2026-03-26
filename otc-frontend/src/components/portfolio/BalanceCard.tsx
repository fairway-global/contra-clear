import { useMemo } from 'react';
import { useBalances } from '../../hooks/useBalances';
import { formatUiAmount, getTokenName, getTokenSymbol } from '../../lib/constants';
import Panel from '../layout/Panel';
import TokenIcon from '../ui/TokenIcon';

export default function BalanceCard() {
  const { channelBalances, onChainBalances, loading, refresh } = useBalances();

  const balanceRows = useMemo(() => {
    const mintSet = new Set([
      ...channelBalances.map((balance) => balance.mint),
      ...onChainBalances.map((balance) => balance.mint),
    ]);

    return Array.from(mintSet)
      .map((mint) => ({
        mint,
        channel: channelBalances.find((balance) => balance.mint === mint)?.uiAmount ?? 0,
        onChain: onChainBalances.find((balance) => balance.mint === mint)?.uiAmount ?? 0,
      }))
      .sort((left, right) => getTokenSymbol(left.mint).localeCompare(getTokenSymbol(right.mint)));
  }, [channelBalances, onChainBalances]);

  return (
    <Panel
      title="Balances"
      action={
        <button onClick={refresh} className="text-xs font-mono text-terminal-dim hover:text-terminal-accent transition-colors">
          {loading ? '...' : 'Refresh'}
        </button>
      }
    >
      {balanceRows.length === 0 ? (
        <div className="text-center py-8 text-terminal-dim font-mono text-sm">
          No balances found. Deposit tokens to get started.
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_0.9fr_0.9fr] gap-3 px-2 pb-2 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
            <span>Token</span>
            <span>Contra</span>
            <span>On-Chain</span>
          </div>
          {balanceRows.map((row) => (
            <div key={row.mint} className="grid grid-cols-[1fr_0.9fr_0.9fr] gap-3 rounded bg-terminal-bg px-3 py-3">
              <div className="flex items-center gap-2">
                <TokenIcon mint={row.mint} size={20} />
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium text-terminal-text">{getTokenSymbol(row.mint)}</div>
                  <div className="truncate font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
                    {getTokenName(row.mint)}
                  </div>
                </div>
              </div>
              <span className={`font-mono text-sm ${row.channel > 0 ? 'text-terminal-accent' : 'text-terminal-dim'}`}>
                {formatUiAmount(row.channel)}
              </span>
              <span className="font-mono text-sm text-terminal-text">{formatUiAmount(row.onChain)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
