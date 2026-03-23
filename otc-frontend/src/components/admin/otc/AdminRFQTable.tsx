import Panel from '../../layout/Panel';
import { formatRawAmount, getTokenSymbol, timeAgo } from '../../../lib/constants';
import type { RFQ, RFQStatus } from '../../../lib/otc/types';
import RFQStatusBadge from '../../otc/rfq/RFQStatusBadge';

interface AdminRFQTableProps {
  title?: string;
  rfqs: Array<RFQ & { quoteCount?: number; activityCount?: number }>;
  onOpenRFQ?: (rfqId: string) => void;
}

export default function AdminRFQTable({ title = 'RFQ Activity', rfqs, onOpenRFQ }: AdminRFQTableProps) {
  return (
    <Panel title={title}>
      {rfqs.length === 0 ? (
        <div className="py-8 text-center font-mono text-sm text-terminal-dim">No RFQ activity in the current view.</div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr_0.7fr_0.7fr] gap-3 px-2 pb-2 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
            <span>Reference</span>
            <span>Originator</span>
            <span>Pair / Size</span>
            <span>Status</span>
            <span>Quotes</span>
            <span>Updated</span>
          </div>
          {rfqs.map((rfq) => (
            <button
              key={rfq.id}
              type="button"
              onClick={() => onOpenRFQ?.(rfq.id)}
              className="grid w-full grid-cols-[1.1fr_1fr_1fr_0.8fr_0.7fr_0.7fr] gap-3 rounded px-2 py-2 text-left hover:bg-terminal-muted/30"
            >
              <span className="font-mono text-xs text-terminal-accent">{rfq.reference}</span>
              <span className="font-mono text-xs text-terminal-text">{rfq.originatorName}</span>
              <span className="font-mono text-xs text-terminal-text">
                {getTokenSymbol(rfq.sellToken)}/{getTokenSymbol(rfq.buyToken)} {formatRawAmount(rfq.sellAmount, rfq.sellToken)}
              </span>
              <span><RFQStatusBadge status={rfq.status as RFQStatus} /></span>
              <span className="font-mono text-xs text-terminal-dim">{rfq.quoteCount ?? 0}</span>
              <span className="font-mono text-xs text-terminal-dim">{timeAgo(rfq.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
