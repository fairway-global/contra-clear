import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Panel from '../layout/Panel';
import TokenIcon from '../ui/TokenIcon';
import RFQStatusBadge from '../otc/rfq/RFQStatusBadge';
import { listPublicRFQs } from '../../lib/otc/api';
import { formatRawAmount, getTokenSymbol, timeAgo } from '../../lib/constants';
import type { RFQ } from '../../lib/otc/types';
import { RFQStatus } from '../../lib/otc/types';

interface PublicMarketplaceProps {
  onOpenRFQ: (rfqId: string) => void;
  onBack: () => void;
}

const OPEN_STATUSES = new Set<RFQStatus>([
  RFQStatus.OpenForQuotes,
  RFQStatus.Negotiating,
  RFQStatus.Draft,
]);

export default function PublicMarketplace({ onOpenRFQ, onBack }: PublicMarketplaceProps) {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'open' | 'all'>('open');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listPublicRFQs();
        if (!cancelled) setRfqs(list);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load RFQs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visibleRfqs = filterMode === 'open'
    ? rfqs.filter((rfq) => OPEN_STATUSES.has(rfq.status))
    : rfqs;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Panel
        title="Open Desk"
        action={(
          <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={onBack}>
            ← Back
          </button>
        )}
      >
        <div className="space-y-3 px-2 pb-2 font-mono text-xs leading-6 text-terminal-dim">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-terminal-accent">
            Approved Trader View · Public Read Access
          </div>
          <div>
            Open RFQs from originators on this desk. Tap any row to read the full request. Login and wallet are required
            only when you click <span className="text-terminal-text">Propose Quote</span>.
          </div>
          <div className="flex items-center gap-1 pt-1">
            <button
              type="button"
              onClick={() => setFilterMode('open')}
              className={`rounded border px-3 py-1 font-mono text-[11px] transition-colors ${
                filterMode === 'open'
                  ? 'border-terminal-accent bg-terminal-accent/10 text-terminal-accent'
                  : 'border-terminal-border text-terminal-dim hover:border-terminal-accent/40'
              }`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded border px-3 py-1 font-mono text-[11px] transition-colors ${
                filterMode === 'all'
                  ? 'border-terminal-accent bg-terminal-accent/10 text-terminal-accent'
                  : 'border-terminal-border text-terminal-dim hover:border-terminal-accent/40'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </Panel>

      <Panel title={loading ? 'Open RFQs (loading...)' : `Open RFQs (${visibleRfqs.length})`}>
        {!loading && visibleRfqs.length === 0 ? (
          <div className="py-12 text-center font-mono text-sm text-terminal-dim">
            No open RFQs on the desk right now.
          </div>
        ) : (
          <div className="space-y-1">
            {visibleRfqs.map((rfq) => (
              <button
                key={rfq.id}
                type="button"
                onClick={() => onOpenRFQ(rfq.id)}
                className="w-full rounded border border-transparent px-3 py-3 text-left hover:border-terminal-border hover:bg-terminal-muted/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm text-terminal-text">{rfq.reference}</div>
                  <RFQStatusBadge status={rfq.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                  <span className="flex items-center gap-1.5 text-terminal-dim">
                    <TokenIcon mint={rfq.sellToken} size={16} />
                    {getTokenSymbol(rfq.sellToken)}/{getTokenSymbol(rfq.buyToken)}
                    <TokenIcon mint={rfq.buyToken} size={16} />
                  </span>
                  <span className="text-terminal-accent">
                    {formatRawAmount(rfq.sellAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}
                  </span>
                </div>
                <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
                  {rfq.originatorName} · updated {timeAgo(rfq.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
