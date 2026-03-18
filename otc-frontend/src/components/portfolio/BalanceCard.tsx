import { useBalances } from '../../hooks/useBalances';
import { getTokenSymbol, formatUiAmount } from '../../lib/constants';
import Panel from '../layout/Panel';

export default function BalanceCard() {
  const { channelBalances, onChainBalances, loading, refresh } = useBalances();

  return (
    <Panel
      title="Balances"
      action={
        <button onClick={refresh} className="text-xs font-mono text-terminal-dim hover:text-terminal-accent transition-colors">
          {loading ? '...' : 'Refresh'}
        </button>
      }
    >
      {channelBalances.length === 0 && onChainBalances.length === 0 ? (
        <div className="text-center py-8 text-terminal-dim font-mono text-sm">
          No balances found. Deposit tokens to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Channel Balances */}
          {channelBalances.length > 0 && (
            <div>
              <div className="text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">Channel</div>
              <div className="space-y-2">
                {channelBalances.map(b => (
                  <div key={b.mint} className="flex items-center justify-between py-2 px-3 bg-terminal-bg rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-terminal-accent" />
                      <span className="font-mono text-sm font-medium">{getTokenSymbol(b.mint)}</span>
                    </div>
                    <span className="font-mono text-sm text-terminal-accent">{formatUiAmount(b.uiAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On-Chain Balances */}
          {onChainBalances.length > 0 && (
            <div>
              <div className="text-xs font-mono text-terminal-dim mb-2 uppercase tracking-wider">On-Chain</div>
              <div className="space-y-2">
                {onChainBalances.map(b => (
                  <div key={b.mint} className="flex items-center justify-between py-2 px-3 bg-terminal-bg rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-terminal-amber" />
                      <span className="font-mono text-sm font-medium">{getTokenSymbol(b.mint)}</span>
                    </div>
                    <span className="font-mono text-sm">{formatUiAmount(b.uiAmount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
