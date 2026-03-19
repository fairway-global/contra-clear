import type { Organization, Quote, RFQ } from '../../types/platform';
import { formatAmount, formatDateTime, formatPrice } from '../../lib/platformFormat';
import Modal from '../ui/Modal';

interface AcceptQuoteModalProps {
  open: boolean;
  bankOrganization: Organization;
  rfq: RFQ;
  quote: Quote | null;
  onClose: () => void;
  onAccept: () => Promise<void>;
}

export default function AcceptQuoteModal({
  open,
  bankOrganization,
  rfq,
  quote,
  onClose,
  onAccept,
}: AcceptQuoteModalProps) {
  if (!quote) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Accept Quote"
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onAccept}>
            Accept Quote and Initiate Escrow
          </button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Bank</div>
          <div className="mt-2 text-lg font-semibold">{bankOrganization.name}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Commercial Terms</div>
          <div className="mt-2 text-lg font-semibold">{formatPrice(quote.price, rfq.baseAsset, rfq.quoteAsset)}</div>
          <div className="mt-1 font-mono text-xs text-terminal-dim">Size {formatAmount(quote.size, rfq.baseAsset)}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Institution Deposit</div>
          <div className="mt-2 text-lg font-semibold">{formatAmount(rfq.institutionDepositAmount, rfq.institutionDepositAsset)}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Bank Deposit</div>
          <div className="mt-2 text-lg font-semibold">{formatAmount(rfq.bankDepositAmount, rfq.bankDepositAsset)}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Policy Conditions</div>
          <div className="mt-2 text-lg font-semibold">{rfq.policyStatus}</div>
        </div>
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Deadline</div>
          <div className="mt-2 text-lg font-semibold">{formatDateTime(quote.expiresAt)}</div>
        </div>
      </div>
    </Modal>
  );
}
