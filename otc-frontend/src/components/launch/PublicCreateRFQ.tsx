import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Panel from '../layout/Panel';
import TokenIcon from '../ui/TokenIcon';
import AuthGateModal from '../auth/AuthGateModal';
import { getAllKnownTokens, getTokenName, getTokenSymbol, toRawAmount } from '../../lib/constants';
import { createRFQ } from '../../lib/otc/api';
import type { User } from '../../lib/otc/types';
import { UserRole } from '../../lib/otc/types';

interface PublicCreateRFQProps {
  currentUser: User | null;
  loginByEmail: (email: string, password: string) => Promise<User>;
  onNavigate: (path: string) => void;
}

const EXPIRY_OPTIONS = [
  { label: '15 min', value: '900' },
  { label: '30 min', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '4 hours', value: '14400' },
  { label: '24 hours', value: '86400' },
];

export default function PublicCreateRFQ({ currentUser, loginByEmail, onNavigate }: PublicCreateRFQProps) {
  const tokens = useMemo(() => getAllKnownTokens(), []);
  const [sellToken, setSellToken] = useState(() => tokens[0]?.mint || '');
  const [buyToken, setBuyToken] = useState(() => tokens.find((t) => t.mint !== tokens[0]?.mint)?.mint || tokens[1]?.mint || '');
  const [sellAmount, setSellAmount] = useState('');
  const [indicativeBuyAmount, setIndicativeBuyAmount] = useState('');
  const [requiredTier, setRequiredTier] = useState('1');
  const [expiresInSeconds, setExpiresInSeconds] = useState('3600');
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sellSymbol = getTokenSymbol(sellToken) || 'Token';
  const buySymbol = getTokenSymbol(buyToken) || 'Token';

  useEffect(() => {
    if (sellToken && buyToken && sellToken === buyToken) {
      const alt = tokens.find((t) => t.mint !== sellToken);
      if (alt) setBuyToken(alt.mint);
    }
  }, [sellToken, buyToken, tokens]);

  const validate = (): string | null => {
    if (!sellToken || !buyToken) return 'Select both tokens.';
    if (sellToken === buyToken) return 'Sell and receive tokens must be different.';
    if (!sellAmount || Number(sellAmount) <= 0) return 'Enter a sell amount greater than 0.';
    if (!indicativeBuyAmount || Number(indicativeBuyAmount) <= 0) return 'Enter an indicative receive amount greater than 0.';
    return null;
  };

  const validationError = validate();

  const buildPayload = () => ({
    sequence: Date.now().toString(),
    sellToken,
    sellAmount: toRawAmount(sellAmount, sellToken),
    buyToken,
    indicativeBuyAmount: toRawAmount(indicativeBuyAmount, buyToken),
    requiredTier: Number(requiredTier),
    expiresInSeconds: Number(expiresInSeconds),
  });

  const submitRFQ = async (user: User) => {
    setSubmitting(true);
    try {
      const next = await createRFQ({
        originatorId: user.id,
        ...buildPayload(),
      });
      toast.success('RFQ created');
      onNavigate(`/otc/rfqs/${next.id}`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create RFQ.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClickCreate = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!currentUser) {
      setAuthOpen(true);
      return;
    }
    if (currentUser.role === UserRole.LIQUIDITY_PROVIDER) {
      toast.error('Approved Trader accounts cannot originate RFQs. Sign in with an RFQ Originator account.');
      return;
    }
    await submitRFQ(currentUser);
  };

  const handleAuthed = async (user: User) => {
    setAuthOpen(false);
    if (user.role === UserRole.ADMIN) {
      toast.error('Admin accounts cannot originate RFQs.');
      return;
    }
    await submitRFQ(user);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel
        title="Compose RFQ"
        action={(
          <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => onNavigate('/launch')}>
            ← Back
          </button>
        )}
      >
        <div className="space-y-2 px-2 pb-3 font-mono text-xs leading-6 text-terminal-dim">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-terminal-accent">
            Originator Workspace · Deferred Auth
          </div>
          Fill in the trade you want quoted. You will be asked to sign in only when you click <span className="text-terminal-text">Create RFQ</span>.
        </div>

        <div className="space-y-5">
          {/* Sell side */}
          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-terminal-dim">You Sell</div>
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
                <TokenIcon mint={sellToken} size={28} />
                <select
                  className="cursor-pointer border-none bg-transparent font-mono text-sm font-bold text-terminal-text outline-none"
                  value={sellToken}
                  onChange={(event) => setSellToken(event.target.value)}
                >
                  {tokens.map((token) => (
                    <option key={token.mint} value={token.mint}>{token.symbol}</option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                className="flex-1 border-none bg-transparent text-right font-mono text-xl text-terminal-text outline-none placeholder:text-terminal-dim/40"
                placeholder="0.00"
                value={sellAmount}
                onChange={(event) => setSellAmount(event.target.value)}
              />
            </div>
          </div>

          <div className="-my-2 flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-terminal-border bg-terminal-muted text-terminal-dim">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>

          {/* Buy side */}
          <div className="rounded border border-terminal-accent/30 bg-terminal-accent/5 p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-terminal-accent">
              You Receive (indicative)
            </div>
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
                <TokenIcon mint={buyToken} size={28} />
                <select
                  className="cursor-pointer border-none bg-transparent font-mono text-sm font-bold text-terminal-text outline-none"
                  value={buyToken}
                  onChange={(event) => setBuyToken(event.target.value)}
                >
                  {tokens.map((token) => (
                    <option key={token.mint} value={token.mint}>{token.symbol}</option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                className="flex-1 border-none bg-transparent text-right font-mono text-xl text-terminal-accent outline-none placeholder:text-terminal-dim/40"
                placeholder="0.00"
                value={indicativeBuyAmount}
                onChange={(event) => setIndicativeBuyAmount(event.target.value)}
              />
            </div>
            <div className="mt-1 text-right font-mono text-[10px] text-terminal-dim">{getTokenName(buyToken)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-terminal-dim">
                Min Tier
              </label>
              <div className="flex gap-1">
                {['1', '2', '3'].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setRequiredTier(tier)}
                    className={`flex-1 rounded border py-1.5 font-mono text-xs transition-colors ${
                      requiredTier === tier
                        ? 'border-terminal-accent bg-terminal-accent/10 text-terminal-accent'
                        : 'border-terminal-border text-terminal-dim hover:border-terminal-accent/40'
                    }`}
                  >
                    Tier {tier}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-terminal-dim">
                Expires
              </label>
              <select
                className="select-field text-xs"
                value={expiresInSeconds}
                onChange={(event) => setExpiresInSeconds(event.target.value)}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

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

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              className="btn-primary"
              disabled={Boolean(validationError) || submitting}
              onClick={() => void handleClickCreate()}
            >
              {submitting ? 'Creating...' : currentUser ? 'Create RFQ' : 'Sign In & Create RFQ'}
            </button>
            <span className="font-mono text-[11px] text-terminal-dim">
              {currentUser ? 'Signed in. One click to publish.' : 'Login is requested only after you click Create.'}
            </span>
          </div>
        </div>
      </Panel>

      <AuthGateModal
        open={authOpen}
        intent="rfq"
        pendingActionLabel="Create RFQ"
        loginByEmail={loginByEmail}
        onClose={() => setAuthOpen(false)}
        onAuthed={handleAuthed}
      />
    </div>
  );
}
