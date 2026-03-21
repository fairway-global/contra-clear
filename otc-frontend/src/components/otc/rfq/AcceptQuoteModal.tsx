import ModalShell from '../../layout/ModalShell';
import { formatRawAmount, getTokenSymbol } from '../../../lib/constants';
import type { Quote, RFQ } from '../../../lib/otc/types';

interface AcceptQuoteModalProps {
  open: boolean;
  rfq: RFQ | null;
  quote: Quote | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function AcceptQuoteModal({
  open,
  rfq,
  quote,
  submitting,
  onClose,
  onConfirm,
}: AcceptQuoteModalProps) {
  return (
    <ModalShell
      open={open}
      title="Accept Commercial Terms"
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!rfq || !quote || submitting} onClick={() => void onConfirm()}>
            {submitting ? 'Accepting...' : 'Accept Quote'}
          </button>
        </>
      )}
    >
      {rfq && quote ? (
        <div className="space-y-4 font-mono text-sm">
          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Provider</div>
                <div className="mt-1 text-terminal-text">{quote.providerName}</div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Price</div>
                <div className="mt-1 text-terminal-accent">{quote.price}</div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Originator Deposit</div>
                <div className="mt-1 text-terminal-text">
                  {formatRawAmount(rfq.sellAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Provider Deposit</div>
                <div className="mt-1 text-terminal-text">
                  {formatRawAmount(quote.buyAmount, rfq.buyToken)} {getTokenSymbol(rfq.buyToken)}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs leading-6 text-terminal-dim">
            Accepting locks the commercial terms, disables further price edits, and starts the bilateral escrow funding workflow.
          </p>
        </div>
      ) : null}
    </ModalShell>
  );
}
