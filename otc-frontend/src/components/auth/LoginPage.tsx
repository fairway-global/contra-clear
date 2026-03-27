import { useState } from 'react';

interface LoginPageProps {
  submitting: boolean;
  onSubmit: (payload: { email: string; password: string }) => Promise<void> | void;
  onNavigateHome: () => void;
  onNavigateSignup: () => void;
}

export default function LoginPage({
  submitting,
  onSubmit,
  onNavigateHome,
  onNavigateSignup,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="panel overflow-hidden">
        <div className="border-b border-terminal-border px-6 py-5">
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">Platform Access</div>
          <h1 className="mt-3 font-mono text-3xl text-terminal-text">Sign in to the OTC platform</h1>
          <p className="mt-4 max-w-2xl font-mono text-sm leading-7 text-terminal-dim">
            Enter your work email and password to access the platform. Your role is assigned on the backend and the
            dashboard will open with the permissions tied to your account.
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">Backend-Assigned Roles</div>
              <div className="mt-3 font-mono text-xs leading-6 text-terminal-dim">
                RFQ Originator, Liquidity Provider, and Admin access are inferred from your approved account record after sign in.
              </div>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">Institutional Access</div>
              <div className="mt-3 font-mono text-xs leading-6 text-terminal-dim">
                If you do not yet have an account, submit an institutional signup request and complete KYB before activation.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={onNavigateHome}>
              Back To Landing Page
            </button>
            <button type="button" className="btn-secondary" onClick={onNavigateSignup}>
              Go To Sign Up
            </button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-terminal-border px-6 py-5">
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">Platform Login</div>
          <h2 className="mt-3 font-mono text-2xl text-terminal-text">Email and password sign in</h2>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Work Email</label>
            <input
              className="input-field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@institution.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Password</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="button"
            className="btn-primary w-full"
            disabled={!email || !password || submitting}
            onClick={() => void onSubmit({ email, password })}
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>

          <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs leading-6 text-terminal-dim">
            No account yet?
            <div className="mt-2">Submit your access request and complete KYC/KYB onboarding.</div>
            <button type="button" className="btn-secondary mt-4" onClick={onNavigateSignup}>
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
