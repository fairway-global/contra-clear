import { useState, type FormEvent } from 'react';
import type { AuthProfile } from '../types/platform';
import Panel from '../components/layout/Panel';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<AuthProfile>;
  onNavigate: (path: string) => void;
}

export function LoginPage({ onLogin, onNavigate }: LoginPageProps) {
  const [email, setEmail] = useState('bank.admin@aurora.demo');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-terminal-bg px-4 py-10 text-terminal-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex justify-end">
          <button type="button" className="btn-secondary" onClick={() => onNavigate('/')}>
            Back to Home
          </button>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="panel p-8">
            <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-dim">
              Bank-operated OTC platform
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              Private institutional RFQ execution on Contra
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-terminal-dim">
              Banks operate the node, onboard institutions, receive RFQs, negotiate bilaterally,
              monitor escrow, and settle through Contra. Institutions log in with email, submit RFQs
              to their bank, and track every stage of the workflow in one tenant-scoped workspace.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ['For Banks', 'Onboard institutions, manage policy, quote, negotiate, and settle.'],
                ['For Institutions', 'Create RFQs, negotiate privately, and track bilateral escrow.'],
                ['For Ops', 'Monitor funding, policy exceptions, and settlement readiness.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-lg border border-terminal-border bg-terminal-surface p-4">
                  <div className="font-mono text-xs uppercase tracking-wider text-terminal-accent">{title}</div>
                  <div className="mt-2 text-sm leading-6 text-terminal-dim">{description}</div>
                </div>
              ))}
            </div>
          </div>

          <Panel title="Sign In">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Email</label>
                <input className="input-field" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Password</label>
                <input className="input-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              {error ? <div className="rounded-lg border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 font-mono text-xs text-terminal-red">{error}</div> : null}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 space-y-3 rounded-lg border border-terminal-border bg-terminal-bg p-4 font-mono text-xs text-terminal-dim">
              <div className="uppercase tracking-wider">Demo Accounts</div>
              <button type="button" className="block text-left text-terminal-text" onClick={() => { setEmail('bank.admin@aurora.demo'); setPassword('demo123'); }}>
                BANK: `bank.admin@aurora.demo` / `demo123`
              </button>
              <button type="button" className="block text-left text-terminal-text" onClick={() => { setEmail('trader@northstar.demo'); setPassword('demo123'); }}>
                INSTITUTION: `trader@northstar.demo` / `demo123`
              </button>
              <button type="button" className="block text-left text-terminal-text" onClick={() => onNavigate('/accept-invite?token=invite-northstar-analyst')}>
                Demo invite: `analyst@northstar.demo`
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between font-mono text-xs">
              <button type="button" className="text-terminal-accent" onClick={() => onNavigate('/forgot-password')}>
                Forgot password
              </button>
              <button type="button" className="text-terminal-accent" onClick={() => onNavigate('/accept-invite?token=invite-northstar-analyst')}>
                Accept invite
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

interface AcceptInvitePageProps {
  token: string;
  onAccept: (input: { token: string; fullName: string; password: string }) => Promise<void>;
}

export function AcceptInvitePage({ token, onAccept }: AcceptInvitePageProps) {
  const [fullName, setFullName] = useState('Dana Lee');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await onAccept({ token, fullName, password });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Unable to accept invite');
    }
  };

  return (
    <div className="min-h-screen bg-terminal-bg px-4 py-10 text-terminal-text">
      <div className="mx-auto max-w-xl">
        <Panel title="Accept Invite">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-xs text-terminal-dim">
              Invite token: {token}
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Full Name</label>
              <input className="input-field" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Set Password</label>
              <input className="input-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error ? <div className="rounded-lg border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 font-mono text-xs text-terminal-red">{error}</div> : null}
            {submitted ? <div className="rounded-lg border border-terminal-green/40 bg-terminal-green/10 px-3 py-2 font-mono text-xs text-terminal-green">Invite accepted. You are now signed in.</div> : null}
            <button type="submit" className="btn-primary w-full">Activate Account</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function ForgotPasswordPage({
  onSubmit,
}: {
  onSubmit: (email: string) => Promise<{ resetUrl: string }>;
}) {
  const [email, setEmail] = useState('trader@northstar.demo');
  const [result, setResult] = useState<{ resetUrl: string } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      setResult(await onSubmit(email));
    } catch (err: any) {
      setError(err.message || 'Unable to create reset link');
    }
  };

  return (
    <div className="min-h-screen bg-terminal-bg px-4 py-10 text-terminal-text">
      <div className="mx-auto max-w-xl">
        <Panel title="Forgot Password">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Email</label>
              <input className="input-field" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            {error ? <div className="rounded-lg border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 font-mono text-xs text-terminal-red">{error}</div> : null}
            <button type="submit" className="btn-primary w-full">Generate Reset Link</button>
          </form>
          {result ? (
            <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-bg p-4 font-mono text-xs text-terminal-dim">
              Demo reset link: <span className="text-terminal-accent">{result.resetUrl}</span>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

export function ResetPasswordPage({
  token,
  onSubmit,
}: {
  token: string;
  onSubmit: (token: string, password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('demo123');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await onSubmit(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Unable to reset password');
    }
  };

  return (
    <div className="min-h-screen bg-terminal-bg px-4 py-10 text-terminal-text">
      <div className="mx-auto max-w-xl">
        <Panel title="Reset Password">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-lg border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-xs text-terminal-dim">
              Reset token: {token}
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">New Password</label>
              <input className="input-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error ? <div className="rounded-lg border border-terminal-red/40 bg-terminal-red/10 px-3 py-2 font-mono text-xs text-terminal-red">{error}</div> : null}
            {success ? <div className="rounded-lg border border-terminal-green/40 bg-terminal-green/10 px-3 py-2 font-mono text-xs text-terminal-green">Password updated. Return to login and sign in.</div> : null}
            <button type="submit" className="btn-primary w-full">Reset Password</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
