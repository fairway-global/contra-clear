import { useEffect, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import { formatRawAmount, getTokenSymbol } from '../../../lib/constants';
import type { RFQ } from '../../../lib/otc/types';

interface SubmitQuoteModalProps {
  open: boolean;
  rfq: RFQ | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { price: string; buyAmount: string; note: string }) => Promise<void> | void;
}

export default function SubmitQuoteModal({ open, rfq, submitting, onClose, onSubmit }: SubmitQuoteModalProps) {
  const [price, setPrice] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !rfq) {
      return;
    }
    setPrice('');
    setBuyAmount(rfq.indicativeBuyAmount && rfq.indicativeBuyAmount !== '0' ? formatRawAmount(rfq.indicativeBuyAmount, rfq.buyToken) : '');
    setNote('');
  }, [open, rfq]);

  return (
    <ModalShell
      open={open}
      title="Submit Quote"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!rfq || !price || !buyAmount || submitting}
            onClick={() => void onSubmit({ price, buyAmount, note })}
          >
            {submitting ? 'Submitting...' : 'Send Quote'}
          </button>
        </>
      )}
    >
      {rfq ? (
        <div className="space-y-4">
          <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs">
            Quote {rfq.reference} to buy {formatRawAmount(rfq.sellAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Price</label>
              <input className="input-field" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.0480" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">
                Provider Deposit ({getTokenSymbol(rfq.buyToken)})
              </label>
              <input className="input-field" value={buyAmount} onChange={(event) => setBuyAmount(event.target.value)} placeholder="48.00" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Quote Note</label>
            <textarea className="input-field min-h-24 resize-y" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}
