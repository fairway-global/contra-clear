import { formatRawAmount, getTokenSymbol, timeAgo } from '../../../lib/constants';
import type { Quote, RFQ } from '../../../lib/otc/types';
import { QuoteStatus, UserRole } from '../../../lib/otc/types';
import QuoteStatusBadge from './QuoteStatusBadge';

interface QuoteCardProps {
  rfq: RFQ;
  quote: Quote;
  history: Quote[];
  viewerRole: UserRole;
  onAccept?: (quote: Quote) => void;
  onReject?: (quote: Quote) => void;
  onCounter?: (quote: Quote) => void;
}

export default function QuoteCard({
  rfq,
  quote,
  history,
  viewerRole,
  onAccept,
  onReject,
  onCounter,
}: QuoteCardProps) {
  const canNegotiate = !rfq.selectedQuoteId && ![QuoteStatus.Rejected, QuoteStatus.Cancelled, QuoteStatus.Expired, QuoteStatus.Settled].includes(quote.status);
  const canOriginatorAccept = viewerRole === UserRole.RFQ_ORIGINATOR && quote.submittedByRole === UserRole.LIQUIDITY_PROVIDER && canNegotiate;
  const canProviderAccept = viewerRole === UserRole.LIQUIDITY_PROVIDER && quote.submittedByRole === UserRole.RFQ_ORIGINATOR && canNegotiate;
  const canAccept = canOriginatorAccept || canProviderAccept;

  return (
    <div className="rounded border border-terminal-border bg-terminal-bg p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-mono text-sm text-terminal-text">{quote.providerName}</div>
            <QuoteStatusBadge status={quote.status} />
            <span className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">v{quote.version}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono md:grid-cols-3">
            <div>
              <div className="uppercase tracking-wider text-terminal-dim">Price</div>
              <div className="mt-1 text-terminal-accent">{quote.price}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-terminal-dim">Provider Deposit</div>
              <div className="mt-1 text-terminal-text">
                {formatRawAmount(quote.buyAmount, rfq.buyToken)} {getTokenSymbol(rfq.buyToken)}
              </div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-terminal-dim">Updated</div>
              <div className="mt-1 text-terminal-text">{timeAgo(quote.updatedAt)}</div>
            </div>
          </div>
          {quote.note ? <div className="font-mono text-xs leading-6 text-terminal-dim">{quote.note}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canOriginatorAccept ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => onCounter?.(quote)}>
                Counter
              </button>
              <button type="button" className="btn-secondary" onClick={() => onReject?.(quote)}>
                Reject
              </button>
              <button type="button" className="btn-primary" onClick={() => onAccept?.(quote)}>
                Accept
              </button>
            </>
          ) : canProviderAccept ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => onCounter?.(quote)}>
                Revise
              </button>
              <button type="button" className="btn-primary" onClick={() => onAccept?.(quote)}>
                Accept Counter
              </button>
            </>
          ) : canNegotiate ? (
            <button type="button" className="btn-secondary" onClick={() => onCounter?.(quote)}>
              Revise
            </button>
          ) : null}
        </div>
      </div>
      {history.length > 0 ? (
        <details className="mt-4 rounded border border-terminal-border p-3">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-terminal-dim">
            History ({history.length})
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded bg-terminal-surface px-3 py-2 font-mono text-xs">
                <div className="text-terminal-text">
                  v{entry.version} from {entry.submittedByName}
                </div>
                <div className="text-terminal-dim">
                  {entry.price} / {formatRawAmount(entry.buyAmount, rfq.buyToken)} {getTokenSymbol(rfq.buyToken)}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
