import type { ReactNode } from 'react';
import { formatRawAmount, getTokenName, getTokenSymbol, timeAgo } from '../../../lib/constants';
import type { RFQ } from '../../../lib/otc/types';
import RFQStatusBadge from './RFQStatusBadge';

interface RFQDetailsHeaderProps {
  rfq: RFQ;
  action?: ReactNode;
}

export default function RFQDetailsHeader({ rfq, action }: RFQDetailsHeaderProps) {
  const expiresLabel = rfq.expiresInSeconds ? `${rfq.expiresInSeconds}s` : timeAgo(rfq.expiresAt);

  return (
    <div className="panel p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-dim">{rfq.reference}</span>
            <RFQStatusBadge status={rfq.status} />
          </div>
          <div>
            <h2 className="font-mono text-xl text-terminal-text">
              {getTokenSymbol(rfq.sellToken)} to {getTokenSymbol(rfq.buyToken)}
            </h2>
            <p className="mt-1 font-mono text-xs text-terminal-dim">
              Base {formatRawAmount(rfq.sellAmount, rfq.sellToken)} {getTokenName(rfq.sellToken)} for indicative {formatRawAmount(rfq.indicativeBuyAmount, rfq.buyToken)} {getTokenName(rfq.buyToken)}.
            </p>
            {rfq.filledAmount && BigInt(rfq.filledAmount) > 0n ? (
              <p className="mt-1 font-mono text-xs text-terminal-accent">
                Filled: {formatRawAmount(rfq.filledAmount, rfq.sellToken)} / {formatRawAmount(rfq.sellAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}
                {BigInt(rfq.filledAmount) < BigInt(rfq.sellAmount) ? (
                  <span className="ml-2 text-terminal-dim">
                    (Remaining: {formatRawAmount((BigInt(rfq.sellAmount) - BigInt(rfq.filledAmount)).toString(), rfq.sellToken)})
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">Sequence</div>
              <div className="mt-1 font-mono text-sm text-terminal-text">{rfq.sequence || 'Auto'}</div>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">Originator</div>
              <div className="mt-1 font-mono text-sm text-terminal-text">{rfq.originatorName}</div>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">Provider</div>
              <div className="mt-1 font-mono text-sm text-terminal-text">{rfq.selectedProviderName || 'Pending'}</div>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">Required Tier</div>
              <div className="mt-1 font-mono text-sm text-terminal-text">{rfq.requiredTier ?? 1}</div>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">Expiry Window</div>
              <div className="mt-1 font-mono text-sm text-terminal-text">{expiresLabel}</div>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">Updated</div>
              <div className="mt-1 font-mono text-sm text-terminal-text">{timeAgo(rfq.updatedAt)}</div>
            </div>
          </div>
          {rfq.notes ? (
            <div className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">Desk Notes</div>
              <div className="mt-2 font-mono text-xs leading-6 text-terminal-text">{rfq.notes}</div>
            </div>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
