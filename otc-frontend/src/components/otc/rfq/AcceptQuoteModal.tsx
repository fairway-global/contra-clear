import { useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import { formatRawAmount, getTokenSymbol } from '../../../lib/constants';
import type { Quote, RFQ } from '../../../lib/otc/types';
import { UserRole } from '../../../lib/otc/types';

interface AcceptQuoteModalProps {
  open: boolean;
  rfq: RFQ | null;
  quote: Quote | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (fillAmount?: string) => Promise<void> | void;
}

export default function AcceptQuoteModal({
  open,
  rfq,
  quote,
  submitting,
  onClose,
  onConfirm,
}: AcceptQuoteModalProps) {
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [fillInput, setFillInput] = useState('');

  const isOriginatorCounter = quote?.submittedByRole === UserRole.RFQ_ORIGINATOR;
  const title = isOriginatorCounter ? 'Accept Counter Terms' : 'Accept Commercial Terms';
  const actionLabel = isOriginatorCounter ? 'Accept Counter' : 'Accept Quote';

  const handleClose = () => {
    setPartialEnabled(false);
    setFillInput('');
    onClose();
  };

  const handleConfirm = () => {
    const fillAmount = partialEnabled && fillInput.trim() ? fillInput.trim() : undefined;
    void onConfirm(fillAmount);
  };

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={handleClose}
      widthClassName="max-w-xl"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!rfq || !quote || submitting} onClick={handleConfirm}>
            {submitting ? 'Accepting...' : actionLabel}
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
                  {formatRawAmount(quote.sellAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}
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

          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={partialEnabled}
                onChange={(e) => {
                  setPartialEnabled(e.target.checked);
                  if (!e.target.checked) setFillInput('');
                }}
                className="accent-terminal-accent"
              />
              <span className="text-terminal-text">Partial fill (accept only a portion)</span>
            </label>
            {partialEnabled ? (
              <div className="mt-3">
                <label className="block text-[11px] uppercase tracking-wider text-terminal-dim">
                  Fill Amount (raw {getTokenSymbol(rfq.sellToken)})
                </label>
                <input
                  type="text"
                  value={fillInput}
                  onChange={(e) => setFillInput(e.target.value)}
                  placeholder={`Max: ${rfq.sellAmount}`}
                  className="mt-1 w-full rounded border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-sm text-terminal-text placeholder:text-terminal-dim/50 focus:border-terminal-accent focus:outline-none"
                />
                {rfq.filledAmount && BigInt(rfq.filledAmount) > 0n ? (
                  <div className="mt-1 text-[11px] text-terminal-dim">
                    Already filled: {formatRawAmount(rfq.filledAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="text-xs leading-6 text-terminal-dim">
            Accepting locks the commercial terms, disables further price edits, and starts the bilateral escrow funding workflow.
          </p>
        </div>
      ) : null}
    </ModalShell>
  );
}
