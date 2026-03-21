import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import { getAllKnownTokens, getTokenName, getTokenSymbol } from '../../../lib/constants';

interface CreateRFQModalProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    sequence: string;
    sellToken: string;
    sellAmount: string;
    indicativeBuyAmount: string;
    buyToken: string;
    requiredTier: string;
    expiresInSeconds: string;
  }) => Promise<void> | void;
}

function makeDefaultSequence(): string {
  return Date.now().toString();
}

export default function CreateRFQModal({ open, submitting, onClose, onSubmit }: CreateRFQModalProps) {
  const tokens = useMemo(() => getAllKnownTokens(), [open]);
  const [sequence, setSequence] = useState(makeDefaultSequence);
  const [sellToken, setSellToken] = useState('');
  const [buyToken, setBuyToken] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [indicativeBuyAmount, setIndicativeBuyAmount] = useState('');
  const [requiredTier, setRequiredTier] = useState('1');
  const [expiresInSeconds, setExpiresInSeconds] = useState('3600');

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!sequence) {
      setSequence(makeDefaultSequence());
    }
    if (!sellToken && tokens[0]) {
      setSellToken(tokens[0].mint);
    }
    if (!buyToken || buyToken === sellToken) {
      const preferredBuyToken = tokens.find((token) => token.mint !== sellToken) || tokens[1] || tokens[0];
      if (preferredBuyToken) {
        setBuyToken(preferredBuyToken.mint);
      }
    }
  }, [buyToken, open, sellToken, sequence, tokens]);

  const resetForm = () => {
    setSequence(makeDefaultSequence());
    setSellAmount('');
    setIndicativeBuyAmount('');
    setRequiredTier('1');
    setExpiresInSeconds('3600');
  };

  const handleSubmit = async () => {
    await onSubmit({
      sequence,
      sellToken,
      sellAmount,
      indicativeBuyAmount,
      buyToken,
      requiredTier,
      expiresInSeconds,
    });
    resetForm();
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
            disabled={
              !sequence ||
              !sellToken ||
              !buyToken ||
              !sellAmount ||
              !indicativeBuyAmount ||
              !requiredTier ||
              !expiresInSeconds ||
              sellToken === buyToken ||
              Number(sellAmount) <= 0 ||
              Number(indicativeBuyAmount) <= 0 ||
              Number(requiredTier) <= 0 ||
              Number(expiresInSeconds) <= 0 ||
              submitting
            }
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Creating...' : 'Create RFQ'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Sequence</label>
          <input
            type="text"
            className="input-field"
            value={sequence}
            onChange={(event) => setSequence(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Base Asset</label>
          <select className="select-field" value={sellToken} onChange={(event) => setSellToken(event.target.value)}>
            {tokens.map((token) => (
              <option key={token.mint} value={token.mint}>
                {token.symbol} - {getTokenName(token.mint)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">
            Base Amount ({getTokenSymbol(sellToken) || 'Token'})
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
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">
            Quote Amount ({getTokenSymbol(buyToken) || 'Token'})
          </label>
          <input
            type="number"
            min="0"
            step="0.000001"
            className="input-field"
            placeholder="0.00"
            value={indicativeBuyAmount}
            onChange={(event) => setIndicativeBuyAmount(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Quote Asset</label>
          <select className="select-field" value={buyToken} onChange={(event) => setBuyToken(event.target.value)}>
            {tokens.map((token) => (
              <option key={token.mint} value={token.mint}>
                {token.symbol} - {getTokenName(token.mint)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Required Tier</label>
          <input
            type="number"
            min="1"
            step="1"
            className="input-field"
            value={requiredTier}
            onChange={(event) => setRequiredTier(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Expires In (seconds)</label>
          <input
            type="number"
            min="1"
            step="1"
            className="input-field"
            value={expiresInSeconds}
            onChange={(event) => setExpiresInSeconds(event.target.value)}
          />
        </div>
      </div>
    </ModalShell>
  );
}
