import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import TokenIcon from '../../ui/TokenIcon';
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

const EXPIRY_OPTIONS = [
  { label: '15 min', value: '900' },
  { label: '30 min', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '4 hours', value: '14400' },
  { label: '24 hours', value: '86400' },
];

export default function CreateRFQModal({ open, submitting, onClose, onSubmit }: CreateRFQModalProps) {
  const tokens = useMemo(() => getAllKnownTokens(), [open]);
  const [sellToken, setSellToken] = useState('');
  const [buyToken, setBuyToken] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [indicativeBuyAmount, setIndicativeBuyAmount] = useState('');
  const [requiredTier, setRequiredTier] = useState('1');
  const [expiresInSeconds, setExpiresInSeconds] = useState('3600');

  useEffect(() => {
    if (!open) return;
    if (!sellToken && tokens[0]) setSellToken(tokens[0].mint);
    if (!buyToken || buyToken === sellToken) {
      const pref = tokens.find((t) => t.mint !== sellToken) || tokens[1] || tokens[0];
      if (pref) setBuyToken(pref.mint);
    }
  }, [buyToken, open, sellToken, tokens]);

  const resetForm = () => {
    setSellAmount('');
    setIndicativeBuyAmount('');
    setRequiredTier('1');
    setExpiresInSeconds('3600');
  };

  const handleSubmit = async () => {
    await onSubmit({
      sequence: Date.now().toString(),
      sellToken,
      sellAmount,
      indicativeBuyAmount,
      buyToken,
      requiredTier,
      expiresInSeconds,
    });
    resetForm();
  };

  const sellSymbol = getTokenSymbol(sellToken) || 'Token';
  const buySymbol = getTokenSymbol(buyToken) || 'Token';

  return (
    <ModalShell
      open={open}
      title="Create OTC RFQ"
      onClose={onClose}
      widthClassName="max-w-lg"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              !sellToken || !buyToken || !sellAmount || !indicativeBuyAmount ||
              sellToken === buyToken || Number(sellAmount) <= 0 || Number(indicativeBuyAmount) <= 0 ||
              submitting
            }
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Creating...' : 'Create RFQ'}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        {/* Sell side */}
        <div className="rounded border border-terminal-border bg-terminal-bg p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-terminal-dim mb-3">You Sell</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <TokenIcon mint={sellToken} size={28} />
              <select
                className="bg-transparent font-mono text-sm font-bold text-terminal-text border-none outline-none cursor-pointer"
                value={sellToken}
                onChange={(e) => setSellToken(e.target.value)}
              >
                {tokens.map((t) => (
                  <option key={t.mint} value={t.mint}>{t.symbol}</option>
                ))}
              </select>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              className="flex-1 bg-transparent font-mono text-xl text-right text-terminal-text border-none outline-none placeholder:text-terminal-dim/40"
              placeholder="0.00"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
            />
          </div>
          <div className="mt-1 text-right font-mono text-[10px] text-terminal-dim">
            {getTokenName(sellToken)}
          </div>
        </div>

        {/* Swap arrow */}
        <div className="flex justify-center -my-2">
          <div className="rounded-full border border-terminal-border bg-terminal-muted w-8 h-8 flex items-center justify-center text-terminal-dim">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* Buy side */}
        <div className="rounded border border-terminal-accent/30 bg-terminal-accent/5 p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-terminal-accent mb-3">You Receive (indicative)</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <TokenIcon mint={buyToken} size={28} />
              <select
                className="bg-transparent font-mono text-sm font-bold text-terminal-text border-none outline-none cursor-pointer"
                value={buyToken}
                onChange={(e) => setBuyToken(e.target.value)}
              >
                {tokens.map((t) => (
                  <option key={t.mint} value={t.mint}>{t.symbol}</option>
                ))}
              </select>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              className="flex-1 bg-transparent font-mono text-xl text-right text-terminal-accent border-none outline-none placeholder:text-terminal-dim/40"
              placeholder="0.00"
              value={indicativeBuyAmount}
              onChange={(e) => setIndicativeBuyAmount(e.target.value)}
            />
          </div>
          <div className="mt-1 text-right font-mono text-[10px] text-terminal-dim">
            {getTokenName(buyToken)}
          </div>
        </div>

        {sellToken === buyToken && (
          <div className="rounded border border-terminal-red/30 bg-terminal-red/5 p-2 font-mono text-[10px] text-terminal-red text-center">
            Sell and receive tokens must be different
          </div>
        )}

        {/* Settings row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">Min Tier</label>
            <div className="flex gap-1">
              {['1', '2', '3'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRequiredTier(t)}
                  className={`flex-1 rounded border py-1.5 font-mono text-xs transition-colors ${
                    requiredTier === t
                      ? 'border-terminal-accent bg-terminal-accent/10 text-terminal-accent'
                      : 'border-terminal-border text-terminal-dim hover:border-terminal-accent/40'
                  }`}
                >
                  Tier {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-terminal-dim">Expires</label>
            <select
              className="select-field text-xs"
              value={expiresInSeconds}
              onChange={(e) => setExpiresInSeconds(e.target.value)}
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary */}
        {sellAmount && indicativeBuyAmount && Number(sellAmount) > 0 && Number(indicativeBuyAmount) > 0 && (
          <div className="rounded border border-terminal-border bg-terminal-bg p-3 font-mono text-xs text-terminal-dim">
            <div className="flex justify-between">
              <span>Indicative Rate</span>
              <span className="text-terminal-text">
                1 {sellSymbol} = {(Number(indicativeBuyAmount) / Number(sellAmount)).toFixed(4)} {buySymbol}
              </span>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
