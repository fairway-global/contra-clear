import { useWalletTrades } from '../../hooks/useTrades';
import { getTokenSymbol, truncateAddress, timeAgo } from '../../lib/constants';
import Panel from '../layout/Panel';

export default function TradeHistory() {
  const { trades, loading } = useWalletTrades();

  return (
    <Panel title="Your Trade History">
      {trades.length === 0 ? (
        <div className="text-center py-8 text-terminal-dim font-mono text-sm">
          {loading ? 'Loading...' : 'No trades yet'}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-6 gap-2 text-xs font-mono text-terminal-dim px-2 py-1 uppercase tracking-wider">
            <span>Pair</span>
            <span>Side</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Price</span>
            <span>Counterparty</span>
            <span className="text-right">Time</span>
          </div>
          {trades.map(trade => (
            <div
              key={trade.id}
              className={`grid grid-cols-6 gap-2 text-xs font-mono px-2 py-2 rounded hover:bg-terminal-muted/30 transition-colors ${
                trade.status === 'completed' ? '' : 'opacity-50'
              }`}
            >
              <span>
                {getTokenSymbol(trade.sellToken)}/{getTokenSymbol(trade.buyToken)}
              </span>
              <span className="text-terminal-red">SELL</span>
              <span className="text-right">{trade.sellAmount}</span>
              <span className="text-right">{trade.price}</span>
              <span className="text-terminal-dim">{truncateAddress(trade.partyB)}</span>
              <span className="text-right text-terminal-dim" title={trade.createdAt}>
                {timeAgo(trade.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
