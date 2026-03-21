import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import { getAllKnownTokens, getTokenName, getTokenSymbol } from '../../../lib/constants';

interface CreateRFQModalProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { sellToken: string; sellAmount: string; buyToken: string; notes: string }) => Promise<void> | void;
}

export default function CreateRFQModal({ open, submitting, onClose, onSubmit }: CreateRFQModalProps) {
  const tokens = useMemo(() => getAllKnownTokens(), [open]);
  const [sellToken, setSellToken] = useState('');
  const [buyToken, setBuyToken] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!sellToken && tokens[0]) {
      setSellToken(tokens[0].mint);
    }
    if (!buyToken && tokens[1]) {
      setBuyToken(tokens[1].mint);
    }
  }, [buyToken, open, sellToken, tokens]);

  const handleSubmit = async () => {
    await onSubmit({ sellToken, sellAmount, buyToken, notes });
    setSellAmount('');
    setNotes('');
  };

  return (
    <ModalShell
      open={open}
      title="Create OTC RFQ"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!sellToken || !buyToken || !sellAmount || sellToken === buyToken || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Creating...' : 'Create RFQ'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Sell Token</label>
            <select className="select-field" value={sellToken} onChange={(event) => setSellToken(event.target.value)}>
              {tokens.map((token) => (
                <option key={token.mint} value={token.mint}>
                  {token.symbol} - {getTokenName(token.mint)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Buy Token</label>
            <select className="select-field" value={buyToken} onChange={(event) => setBuyToken(event.target.value)}>
              {tokens.map((token) => (
                <option key={token.mint} value={token.mint}>
                  {token.symbol} - {getTokenName(token.mint)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">
            Sell Amount ({getTokenSymbol(sellToken) || 'Token'})
          </label>
          <input
            type="number"
            min="0"
            step="0.000001"
            className="input-field"
            placeholder="0.00"
            value={sellAmount}
            onChange={(event) => setSellAmount(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Desk Notes</label>
          <textarea
            className="input-field min-h-24 resize-y"
            placeholder="Optional instructions for providers"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
    </ModalShell>
  );
}
