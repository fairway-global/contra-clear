import { useRFQs } from '../../hooks/useRFQ';
import { getTokenSymbol, truncateAddress, timeAgo } from '../../lib/constants';
import type { RFQ } from '../../lib/api';
import Panel from '../layout/Panel';

interface RFQListProps {
  onSelectRFQ: (rfq: RFQ) => void;
  selectedRFQId?: string;
}

export default function RFQList({ onSelectRFQ, selectedRFQId }: RFQListProps) {
  const { rfqs, loading } = useRFQs();

  return (
    <Panel
      title="Active RFQs"
      action={<span className="text-xs font-mono text-terminal-dim">{loading ? '...' : `${rfqs.length} active`}</span>}
    >
      {rfqs.length === 0 ? (
        <div className="text-center py-12 text-terminal-dim font-mono text-sm">
          No active RFQs. Create one to start trading.
        </div>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {rfqs.map(rfq => (
            <button
              key={rfq.id}
              onClick={() => onSelectRFQ(rfq)}
              className={`w-full text-left px-3 py-3 rounded transition-colors ${
                selectedRFQId === rfq.id
                  ? 'bg-terminal-accent/10 border border-terminal-accent/30'
                  : 'hover:bg-terminal-muted/30 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{getTokenSymbol(rfq.sellToken)} → {getTokenSymbol(rfq.buyToken)}</span>
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${rfq.side === 'sell' ? 'bg-terminal-red/10 text-terminal-red' : 'bg-terminal-green/10 text-terminal-green'}`}>
                    {rfq.side.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-mono text-terminal-dim" title={rfq.createdAt}>{timeAgo(rfq.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-terminal-dim">{truncateAddress(rfq.creator)}</span>
                <span className="font-mono text-xs text-terminal-accent">{rfq.sellAmount} {getTokenSymbol(rfq.sellToken)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
