import { useEffect, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import { formatRawAmount } from '../../../lib/constants';
import type { Quote, RFQ } from '../../../lib/otc/types';

interface QuoteNegotiationModalProps {
  open: boolean;
  rfq: RFQ | null;
  quote: Quote | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { price: string; buyAmount: string; note: string }) => Promise<void> | void;
}

export default function QuoteNegotiationModal({
  open,
  rfq,
  quote,
  submitting,
  onClose,
  onSubmit,
}: QuoteNegotiationModalProps) {
  const [price, setPrice] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !quote) {
      return;
    }
    setPrice(quote.price);
    setBuyAmount(rfq ? formatRawAmount(quote.buyAmount, rfq.buyToken) : quote.buyAmount);
    setNote('');
  }, [open, quote, rfq]);

  return (
    <ModalShell
      open={open}
      title={rfq ? `Counter ${rfq.reference}` : 'Counter Quote'}
      onClose={onClose}
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
        <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs text-terminal-dim">
          Revise the latest commercial terms. Once a quote is accepted, negotiation becomes read-only.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Price</label>
            <input className="input-field" value={price} onChange={(event) => setPrice(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Counter Amount</label>
            <input className="input-field" value={buyAmount} onChange={(event) => setBuyAmount(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Negotiation Note</label>
          <textarea className="input-field min-h-24 resize-y" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>
    </ModalShell>
  );
}
