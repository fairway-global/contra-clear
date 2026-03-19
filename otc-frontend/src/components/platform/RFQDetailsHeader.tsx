import type { Organization, Quote, RFQ, UserRole } from '../../types/platform';
import { formatAmount, formatDateTime, formatPrice } from '../../lib/platformFormat';
import RFQStatusBadge from './RFQStatusBadge';

interface RFQDetailsHeaderProps {
  rfq: RFQ;
  institution: Organization;
  bankOrganization: Organization;
  selectedQuote?: Quote;
  currentRole: UserRole;
  onOpenQuoteModal?: () => void;
  onOpenAcceptModal?: () => void;
}

export default function RFQDetailsHeader({
  rfq,
  institution,
  bankOrganization,
  selectedQuote,
  currentRole,
  onOpenQuoteModal,
  onOpenAcceptModal,
}: RFQDetailsHeaderProps) {
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">RFQ Detail</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {institution.name} {rfq.side} {formatAmount(rfq.amount, rfq.baseAsset)}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-terminal-dim">
            <span>Bank: {bankOrganization.name}</span>
            <span>Institution: {institution.name}</span>
            <span>Expires: {formatDateTime(rfq.expiresAt)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <RFQStatusBadge status={rfq.status} />
          <div className="flex gap-2">
            {currentRole === 'BANK' ? (
              <button type="button" className="btn-primary" onClick={onOpenQuoteModal}>
                Send Quote
              </button>
            ) : null}
            {currentRole === 'INSTITUTION' && selectedQuote && ['QUOTED', 'NEGOTIATING'].includes(rfq.status) ? (
              <button type="button" className="btn-primary" onClick={onOpenAcceptModal}>
                Accept Quote and Initiate Escrow
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Trade Size</div>
          <div className="mt-2 text-lg font-semibold">{formatAmount(rfq.amount, rfq.baseAsset)}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Quote Asset</div>
          <div className="mt-2 text-lg font-semibold">{rfq.quoteAsset}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Policy Status</div>
          <div className="mt-2 text-lg font-semibold">{rfq.policyStatus}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Selected Terms</div>
          <div className="mt-2 text-lg font-semibold">
            {selectedQuote ? formatPrice(selectedQuote.price, rfq.baseAsset, rfq.quoteAsset) : 'Awaiting quote'}
          </div>
        </div>
      </div>
    </div>
  );
}
