import { useRef, useEffect } from 'react';
import { useTrades } from '../../hooks/useTrades';
import { getTokenSymbol, truncateAddress, timeAgo } from '../../lib/constants';
import Panel from '../layout/Panel';

export default function TradeTicker() {
  const { trades } = useTrades();
  const prevCountRef = useRef(trades.length);
  useEffect(() => { prevCountRef.current = trades.length; }, [trades.length]);
  const isNew = trades.length > prevCountRef.current;

  return (
    <Panel title="Trade Feed" action={<span className="text-xs font-mono text-terminal-dim">{trades.filter(t => t.status === 'completed').length} filled</span>}>
      {trades.length === 0 ? (
        <div className="text-center py-12 text-terminal-dim font-mono text-sm">No trades yet</div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {trades.slice(0, 30).map((trade, i) => (
            <div key={trade.id} className={`flex items-center justify-between px-2 py-2 rounded text-xs font-mono ${i === 0 && isNew ? 'ticker-enter trade-flash-green' : ''} ${trade.status === 'completed' ? '' : 'opacity-50'}`}>
              <div className="flex items-center gap-3">
                <span>{getTokenSymbol(trade.sellToken)}/{getTokenSymbol(trade.buyToken)}</span>
                <span className="text-terminal-accent">{trade.sellAmount}</span>
                <span className="text-terminal-dim">@</span>
                <span>{trade.price}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-terminal-dim">{truncateAddress(trade.partyA)} ↔ {truncateAddress(trade.partyB)}</span>
                <span className="text-terminal-dim" title={trade.createdAt}>{timeAgo(trade.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
