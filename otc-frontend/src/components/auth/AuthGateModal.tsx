import { useEffect, useState } from 'react';
import ModalShell from '../layout/ModalShell';
import { submitPlatformAccessRequest } from '../../lib/otc/api';
import type { User } from '../../lib/otc/types';
import { UserRole } from '../../lib/otc/types';

type AuthIntent = 'rfq' | 'lq';

interface AuthGateModalProps {
  open: boolean;
  intent: AuthIntent;
  pendingActionLabel: string;
  loginByEmail: (email: string, password: string) => Promise<User>;
  onClose: () => void;
  onAuthed: (user: User) => Promise<void> | void;
}

type Mode = 'signin' | 'signup';

export default function AuthGateModal({
  open,
  intent,
  pendingActionLabel,
  loginByEmail,
  onClose,
  onAuthed,
}: AuthGateModalProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isLiquidity = intent === 'lq';
  const roleLabel = isLiquidity ? 'Approved Trader' : 'RFQ Originator';
  const intentBlurb = isLiquidity
    ? 'Approved traders propose quotes against open RFQs and clear collateral through Contra escrow.'
    : 'RFQ originators submit private requests and route them to approved liquidity providers.';

  useEffect(() => {
    if (!open) {
      setMode('signin');
      setEmail('');
      setPassword('');
      setFullName('');
      setInstitutionName('');
      setInstitutionType('');
      setJurisdiction('');
      setSubmitting(false);
      setErrorMessage('');
    }
  }, [open]);

  const handleSignIn = async () => {
    setErrorMessage('');
    setSubmitting(true);
    try {
      const user = await loginByEmail(email.trim(), password);
      await onAuthed(user);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async () => {
    setErrorMessage('');
    setSubmitting(true);
    try {
      const role = isLiquidity ? UserRole.LIQUIDITY_PROVIDER : UserRole.RFQ_ORIGINATOR;
      await submitPlatformAccessRequest({
        institutionName: isLiquidity ? institutionName.trim() : fullName.trim(),
        contactName: fullName.trim(),
        email: email.trim(),
        institutionType: isLiquidity ? institutionType.trim() : 'Individual',
        jurisdiction: isLiquidity ? jurisdiction.trim() : 'N/A',
        requestedRoles: [role],
        password,
      } as any);
      const user = await loginByEmail(email.trim(), password);
      await onAuthed(user);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Sign up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const disableSignIn = !email || !password || submitting;
  const disableSignUp =
    !email ||
    !password ||
    password.length < 6 ||
    !fullName ||
    (isLiquidity && (!institutionName || !institutionType || !jurisdiction)) ||
    submitting;

  return (
    <ModalShell
      open={open}
      title={mode === 'signin' ? `Sign in to ${pendingActionLabel.toLowerCase()}` : `Create account to ${pendingActionLabel.toLowerCase()}`}
      onClose={onClose}
      widthClassName="max-w-lg"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          {mode === 'signin' ? (
            <button type="button" className="btn-primary" disabled={disableSignIn} onClick={() => void handleSignIn()}>
              {submitting ? 'Signing In...' : `Sign In & ${pendingActionLabel}`}
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={disableSignUp} onClick={() => void handleSignUp()}>
              {submitting ? 'Creating Account...' : `Create Account & ${pendingActionLabel}`}
            </button>
          )}
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs leading-6 text-terminal-dim">
          Continuing as a <span className="text-terminal-accent">{roleLabel}</span>. {intentBlurb}
        </div>

        <div className="flex items-center gap-2 border-b border-terminal-border">
          <button
            type="button"
            className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              mode === 'signin' ? 'border-b-2 border-terminal-accent text-terminal-accent' : 'text-terminal-dim hover:text-terminal-text'
            }`}
            onClick={() => setMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              mode === 'signup' ? 'border-b-2 border-terminal-accent text-terminal-accent' : 'text-terminal-dim hover:text-terminal-text'
            }`}
            onClick={() => setMode('signup')}
          >
            Create Account
          </button>
        </div>

        {mode === 'signup' ? (
          <>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">
                {isLiquidity ? 'Primary Contact Name' : 'Full Name'}
              </label>
              <input
                className="input-field"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>
            {isLiquidity ? (
              <>
                <div>
                  <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">
                    Host Institution Name
                  </label>
                  <input
                    className="input-field"
                    value={institutionName}
                    onChange={(event) => setInstitutionName(event.target.value)}
                    placeholder="Host institution legal name"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">
                      Host Institution Type
                    </label>
                    <input
                      className="input-field"
                      value={institutionType}
                      onChange={(event) => setInstitutionType(event.target.value)}
                      placeholder="OTC desk, market maker, broker"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">
                      Jurisdiction
                    </label>
                    <input
                      className="input-field"
                      value={jurisdiction}
                      onChange={(event) => setJurisdiction(event.target.value)}
                      placeholder="Country or regulator"
                    />
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Work Email</label>
          <input
            className="input-field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@organization.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Password</label>
          <input
            className="input-field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        {errorMessage ? (
          <div className="rounded border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 font-mono text-xs text-terminal-red">
            {errorMessage}
          </div>
        ) : null}

        <div className="rounded border border-terminal-border bg-terminal-bg p-3 font-mono text-[11px] leading-6 text-terminal-dim">
          {mode === 'signin'
            ? 'New here? Create an account — your draft stays right where you left it.'
            : 'Already have access? Switch to Sign In above to keep your draft intact.'}
        </div>
      </div>
    </ModalShell>
  );
}
