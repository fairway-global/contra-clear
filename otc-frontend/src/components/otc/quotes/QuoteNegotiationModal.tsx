import { useEffect, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import TokenIcon from '../../ui/TokenIcon';
import { formatRawAmount, getTokenSymbol } from '../../../lib/constants';
import type { Quote, RFQ } from '../../../lib/otc/types';
import { UserRole } from '../../../lib/otc/types';

interface QuoteNegotiationModalProps {
  open: boolean;
  rfq: RFQ | null;
  quote: Quote | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { price: string; buyAmount: string; note: string }) => Promise<void> | void;
}

export default function QuoteNegotiationModal({
  open, rfq, quote, submitting, onClose, onSubmit,
}: QuoteNegotiationModalProps) {
  const [price, setPrice] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !quote) return;
    setPrice(quote.price);
    setBuyAmount(rfq ? formatRawAmount(quote.buyAmount, rfq.buyToken) : quote.buyAmount);
    setNote('');
  }, [open, quote, rfq]);

  if (!rfq || !quote) return null;

  const sellSymbol = getTokenSymbol(rfq.sellToken);
  const buySymbol = getTokenSymbol(rfq.buyToken);
  const isFromOriginator = quote.submittedByRole === UserRole.RFQ_ORIGINATOR;

  return (
    <ModalShell
      open={open}
      title={`Counter — ${rfq.reference}`}
      onClose={onClose}
      widthClassName="max-w-lg"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!price || !buyAmount || submitting}
            onClick={() => void onSubmit({ price, buyAmount, note })}
          >
            {submitting ? 'Sending...' : 'Send Counter'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* Previous terms */}
        <div className="rounded border border-terminal-border bg-terminal-bg p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-terminal-dim mb-2">
            Current Terms (v{quote.version} by {isFromOriginator ? 'Originator' : 'Provider'})
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TokenIcon mint={rfq.sellToken} size={20} />
              <span className="font-mono text-sm text-terminal-text">{formatRawAmount(quote.sellAmount, rfq.sellToken)} {sellSymbol}</span>
            </div>
            <div className="font-mono text-xs text-terminal-dim">at {quote.price}</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-terminal-text">{formatRawAmount(quote.buyAmount, rfq.buyToken)} {buySymbol}</span>
              <TokenIcon mint={rfq.buyToken} size={20} />
            </div>
          </div>
        </div>

        {/* Counter offer */}
        <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-yellow-400 mb-3">Your Counter Offer</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">Revised Price</label>
              <input
                className="input-field text-lg font-bold"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">
                Revised Amount ({buySymbol})
              </label>
              <div className="flex items-center gap-2">
                <TokenIcon mint={rfq.buyToken} size={20} />
                <input
                  className="input-field flex-1 text-lg font-bold"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Diff indicator */}
        {price && quote.price && price !== quote.price && (
          <div className="rounded border border-terminal-border bg-terminal-bg p-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-terminal-dim">Price change</span>
              <span className={Number(price) > Number(quote.price) ? 'text-terminal-green' : 'text-terminal-red'}>
                {quote.price} → {price} ({((Number(price) - Number(quote.price)) / Number(quote.price) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">Negotiation Note (optional)</label>
          <textarea
            className="input-field min-h-16 resize-y text-xs"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain your counter..."
          />
        </div>
      </div>
    </ModalShell>
  );
}
