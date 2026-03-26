import { useEffect, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import TokenIcon from '../../ui/TokenIcon';
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
    if (!open || !rfq) return;
    setPrice('');
    setBuyAmount(rfq.indicativeBuyAmount && rfq.indicativeBuyAmount !== '0' ? formatRawAmount(rfq.indicativeBuyAmount, rfq.buyToken) : '');
    setNote('');
  }, [open, rfq]);

  const sellSymbol = rfq ? getTokenSymbol(rfq.sellToken) : '';
  const buySymbol = rfq ? getTokenSymbol(rfq.buyToken) : '';
  const sellDisplay = rfq ? formatRawAmount(rfq.sellAmount, rfq.sellToken) : '0';

  // Auto-calculate price when buyAmount changes
  useEffect(() => {
    if (buyAmount && Number(buyAmount) > 0 && Number(sellDisplay) > 0) {
      setPrice((Number(buyAmount) / Number(sellDisplay)).toFixed(4));
    }
  }, [buyAmount, sellDisplay]);

  if (!rfq) return null;

  return (
    <ModalShell
      open={open}
      title="Submit Quote"
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
            {submitting ? 'Submitting...' : 'Send Quote'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {/* RFQ summary */}
        <div className="rounded border border-terminal-border bg-terminal-bg p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-terminal-dim mb-2">{rfq.reference}</div>
          <div className="flex items-center gap-3">
            <TokenIcon mint={rfq.sellToken} size={32} />
            <div className="flex-1">
              <div className="font-mono text-sm text-terminal-text">
                Originator wants to sell <span className="text-terminal-accent font-bold">{sellDisplay} {sellSymbol}</span>
              </div>
              <div className="font-mono text-[10px] text-terminal-dim mt-0.5">
                Indicative: {formatRawAmount(rfq.indicativeBuyAmount, rfq.buyToken)} {buySymbol}
              </div>
            </div>
            <TokenIcon mint={rfq.buyToken} size={32} />
          </div>
        </div>

        {/* Your offer */}
        <div className="rounded border border-terminal-accent/30 bg-terminal-accent/5 p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-terminal-accent mb-3">Your Offer</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">
                You Provide ({buySymbol})
              </label>
              <div className="flex items-center gap-2">
                <TokenIcon mint={rfq.buyToken} size={20} />
                <input
                  className="input-field flex-1 text-lg font-bold"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">
                Requested ({buySymbol})
              </label>
              <div className="flex items-center gap-2">
                <TokenIcon mint={rfq.buyToken} size={20} />
                <input
                  className="input-field flex-1 text-lg font-bold"
                  value={rfq.indicativeBuyAmount && rfq.indicativeBuyAmount !== '0' ? formatRawAmount(rfq.indicativeBuyAmount, rfq.buyToken) : '—'}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rate summary */}
        {buyAmount && Number(buyAmount) > 0 && Number(sellDisplay) > 0 && (
          <div className="rounded border border-terminal-border bg-terminal-bg p-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-terminal-dim">Your Rate</span>
              <span className="text-terminal-accent">1 {sellSymbol} = {(Number(buyAmount) / Number(sellDisplay)).toFixed(4)} {buySymbol}</span>
            </div>
            {rfq.indicativeBuyAmount && rfq.indicativeBuyAmount !== '0' && (
              <div className="flex justify-between mt-1">
                <span className="text-terminal-dim">Expected Rate</span>
                <span className="text-terminal-text">1 {sellSymbol} = {(Number(formatRawAmount(rfq.indicativeBuyAmount, rfq.buyToken)) / Number(sellDisplay)).toFixed(4)} {buySymbol}</span>
              </div>
            )}
          </div>
        )}

        {/* Hidden price field — auto-calculated */}
        <input type="hidden" value={price} />

        {/* Note */}
        <div>
          <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">Note (optional)</label>
          <textarea
            className="input-field min-h-16 resize-y text-xs"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context to your quote..."
          />
        </div>
      </div>
    </ModalShell>
  );
}
