import { useState } from 'react';
import type { PlatformAccessRequest, PlatformAccessRequestInput, RequestedAccessRole } from '../../lib/otc/types';
import { USER_ROLE_LABELS, UserRole } from '../../lib/otc/types';

interface SignupPageProps {
  submitting: boolean;
  onSubmit: (payload: PlatformAccessRequestInput) => Promise<PlatformAccessRequest>;
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
}

const REQUESTABLE_ROLES: RequestedAccessRole[] = [
  UserRole.RFQ_ORIGINATOR,
  UserRole.LIQUIDITY_PROVIDER,
];

export default function SignupPage({
  submitting,
  onSubmit,
  onNavigateHome,
  onNavigateLogin,
}: SignupPageProps) {
  const [form, setForm] = useState<PlatformAccessRequestInput & { password: string }>({
    institutionName: '',
    contactName: '',
    email: '',
    institutionType: '',
    jurisdiction: '',
    requestedRoles: [],
    password: '',
  });
  const [submittedRequest, setSubmittedRequest] = useState<PlatformAccessRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const toggleRole = (role: RequestedAccessRole) => {
    setForm((current) => ({
      ...current,
      requestedRoles: current.requestedRoles.includes(role)
        ? current.requestedRoles.filter((value) => value !== role)
        : [...current.requestedRoles, role],
    }));
  };

  const handleChange = (field: keyof PlatformAccessRequestInput, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    try {
      const request = await onSubmit(form);
      setSubmittedRequest(request);
    } catch (error: any) {
      setErrorMessage(error.message || 'Unable to submit access request.');
    }
  };

  if (submittedRequest) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-terminal-border px-6 py-5">
            <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">Access Request Submitted</div>
            <h1 className="mt-3 font-mono text-3xl text-terminal-text">Institutional onboarding request received</h1>
            <p className="mt-4 max-w-2xl font-mono text-sm leading-7 text-terminal-dim">
              Your account request has been submitted for review. The next step is compliance verification before platform access is enabled.
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs leading-6 text-terminal-dim">
              <div><span className="text-terminal-text">Institution:</span> {submittedRequest.institutionName}</div>
              <div><span className="text-terminal-text">Primary Contact:</span> {submittedRequest.contactName}</div>
              <div><span className="text-terminal-text">Work Email:</span> {submittedRequest.email}</div>
              <div><span className="text-terminal-text">Jurisdiction:</span> {submittedRequest.jurisdiction}</div>
              <div><span className="text-terminal-text">Institution Type:</span> {submittedRequest.institutionType}</div>
              <div>
                <span className="text-terminal-text">Requested Roles:</span>{' '}
                {submittedRequest.requestedRoles.map((role) => USER_ROLE_LABELS[role]).join(', ')}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary">
                Verify And Finish KYB
              </button>
              <button type="button" className="btn-secondary" onClick={onNavigateLogin}>
                Back To Sign In
              </button>
              <button type="button" className="btn-secondary" onClick={onNavigateHome}>
                Back To Landing Page
              </button>
            </div>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-terminal-border px-6 py-5">
            <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">Next Step</div>
            <h2 className="mt-3 font-mono text-2xl text-terminal-text">Compliance verification pending</h2>
          </div>
          <div className="space-y-4 px-6 py-6 font-mono text-xs leading-7 text-terminal-dim">
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              Access remains pending until KYB is completed and your requested roles are approved on the backend.
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              The button above is intentionally a placeholder for now, so no additional workflow will be triggered yet.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
      <div className="panel overflow-hidden">
        <div className="border-b border-terminal-border px-6 py-5">
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">Institutional Signup</div>
          <h1 className="mt-3 font-mono text-3xl text-terminal-text">Request access to the OTC platform</h1>
          <p className="mt-4 max-w-2xl font-mono text-sm leading-7 text-terminal-dim">
            Submit your institutional profile for onboarding. Admin access is internal only, so signup requests are limited to RFQ Originator and Liquidity Provider roles.
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Institution Name</label>
              <input
                className="input-field"
                value={form.institutionName}
                onChange={(event) => handleChange('institutionName', event.target.value)}
                placeholder="Institution legal name"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Primary Contact</label>
              <input
                className="input-field"
                value={form.contactName}
                onChange={(event) => handleChange('contactName', event.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Work Email</label>
              <input
                className="input-field"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                placeholder="name@institution.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Password</label>
              <input
                type="password"
                className="input-field"
                value={form.password}
                onChange={(event) => setForm((c) => ({ ...c, password: event.target.value }))}
                placeholder="Min 6 characters"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Institution Type</label>
              <input
                className="input-field"
                value={form.institutionType}
                onChange={(event) => handleChange('institutionType', event.target.value)}
                placeholder="Asset manager, treasury desk, broker, OTC desk"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Jurisdiction</label>
              <input
                className="input-field"
                value={form.jurisdiction}
                onChange={(event) => handleChange('jurisdiction', event.target.value)}
                placeholder="Country or regulatory jurisdiction"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Requested Platform Roles</div>
            <div className="grid gap-3 md:grid-cols-2">
              {REQUESTABLE_ROLES.map((role) => {
                const selected = form.requestedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded border p-4 text-left transition-colors ${
                      selected
                        ? 'border-terminal-accent bg-terminal-accent/10'
                        : 'border-terminal-border bg-terminal-bg hover:border-terminal-accent/60'
                    }`}
                  >
                    <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">{USER_ROLE_LABELS[role]}</div>
                    <div className="mt-3 font-mono text-xs leading-6 text-terminal-dim">
                      {role === UserRole.RFQ_ORIGINATOR
                        ? 'Create and manage private RFQs, review quotes, and track escrow and settlement status.'
                        : 'Respond to eligible RFQs, negotiate commercial terms, and manage escrow and settlement obligations.'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded border border-terminal-red/40 bg-terminal-red/10 px-4 py-3 font-mono text-xs text-terminal-red">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={
                submitting ||
                !form.institutionName ||
                !form.contactName ||
                !form.email ||
                !form.password ||
                form.password.length < 6 ||
                !form.institutionType ||
                !form.jurisdiction ||
                form.requestedRoles.length === 0
              }
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Submitting...' : 'Submit Access Request'}
            </button>
            <button type="button" className="btn-secondary" onClick={onNavigateLogin}>
              Back To Sign In
            </button>
            <button type="button" className="btn-secondary" onClick={onNavigateHome}>
              Back To Landing Page
            </button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-terminal-border px-6 py-5">
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">Onboarding Scope</div>
          <h2 className="mt-3 font-mono text-2xl text-terminal-text">What happens after you submit</h2>
        </div>
        <div className="space-y-4 px-6 py-6 font-mono text-xs leading-7 text-terminal-dim">
          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            Your institution profile is queued for review and the requested roles are evaluated by the platform team.
          </div>
          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            Once approved, your email is activated in the backend and the login page will route you to the correct role-based workspace automatically.
          </div>
          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            KYB is the next mandatory step after submission. The follow-up button is present after submit, but it is intentionally inactive for now.
          </div>
        </div>
      </div>
    </div>
  );
}
