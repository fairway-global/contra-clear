import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { PlatformAccessRequest, PlatformAccessRequestInput, RequestedAccessRole } from '../../lib/otc/types';
import { UserRole } from '../../lib/otc/types';

interface SignupPageProps {
  submitting: boolean;
  onSubmit: (payload: PlatformAccessRequestInput) => Promise<PlatformAccessRequest>;
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
  onNavigateKyc?: () => void;
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
  onNavigateKyc,
}: SignupPageProps) {
  const { publicKey } = useWallet();
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

  const selectRole = (role: RequestedAccessRole) => {
    setForm((current) => ({
      ...current,
      requestedRoles: [role],
    }));
  };

  const selectedRole = form.requestedRoles[0] || null;
  const isInstitution = selectedRole === UserRole.LIQUIDITY_PROVIDER;
  const walletAddress = publicKey?.toString() || '';

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

  // ── Submitted confirmation ────────────────────────────────────────────

  if (submittedRequest) {
    return (
      <div className="mx-auto grid max-w-5xl gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-terminal-border px-6 py-5">
            <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">Access Request Submitted</div>
            <h1 className="mt-3 font-mono text-3xl text-terminal-text">
              {isInstitution ? 'Institutional onboarding request received' : 'KYC verification request received'}
            </h1>
            <p className="mt-4 max-w-2xl font-mono text-sm leading-7 text-terminal-dim">
              {isInstitution
                ? 'Your institution profile has been submitted for review. The next step is compliance verification before platform access is enabled.'
                : 'Your account request has been submitted. Complete KYC verification to activate your access.'}
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs leading-6 text-terminal-dim">
              {isInstitution ? (
                <>
                  <div><span className="text-terminal-text">Institution:</span> {submittedRequest.institutionName}</div>
                  <div><span className="text-terminal-text">Primary Contact:</span> {submittedRequest.contactName}</div>
                  <div><span className="text-terminal-text">Work Email:</span> {submittedRequest.email}</div>
                  <div><span className="text-terminal-text">Jurisdiction:</span> {submittedRequest.jurisdiction}</div>
                  <div><span className="text-terminal-text">Institution Type:</span> {submittedRequest.institutionType}</div>
                </>
              ) : (
                <>
                  <div><span className="text-terminal-text">Name:</span> {submittedRequest.contactName}</div>
                  <div><span className="text-terminal-text">Email:</span> {submittedRequest.email}</div>
                </>
              )}
              {walletAddress ? (
                <div><span className="text-terminal-text">Wallet:</span> {walletAddress}</div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={onNavigateKyc}>
                {isInstitution ? 'Verify And Finish KYB' : 'Complete KYC Verification'}
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
            <h2 className="mt-3 font-mono text-2xl text-terminal-text">
              {isInstitution ? 'Compliance verification pending' : 'Identity verification pending'}
            </h2>
          </div>
          <div className="space-y-4 px-6 py-6 font-mono text-xs leading-7 text-terminal-dim">
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              {isInstitution
                ? 'Access remains pending until KYB is completed and your requested roles are approved by the platform team.'
                : 'Access remains pending until KYC is completed and your identity is verified.'}
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              The verification button above is a placeholder for now. No additional workflow will be triggered yet.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Header text based on selected role ────────────────────────────────

  const headerLabel = isInstitution ? 'Institutional Signup' : selectedRole ? 'KYC Signup' : 'Platform Signup';
  const headerTitle = isInstitution
    ? 'Register your institution on the OTC platform'
    : selectedRole
      ? 'Create your OTC trading account'
      : 'Request access to the OTC platform';
  const headerDescription = isInstitution
    ? 'Submit your institutional profile for onboarding. Once approved, your institution can respond to RFQs, negotiate terms, and manage escrow obligations as a liquidity provider.'
    : selectedRole
      ? 'Create an account to start placing private RFQs, reviewing quotes from liquidity providers, and managing escrow settlement.'
      : 'Select your account type below to get started. KYC users create and manage RFQs, while institutions provide liquidity.';

  // ── Right panel text based on selected role ───────────────────────────

  const rightPanelTitle = isInstitution ? 'Institutional onboarding' : selectedRole ? 'KYC onboarding' : 'What happens after you submit';
  const rightPanelItems = isInstitution
    ? [
        'Your institution profile is queued for review and the requested roles are evaluated by the platform team.',
        'Once approved, your work email is activated and the login page will route you to the liquidity provider workspace.',
        'KYB is the next mandatory step after submission. The verification button will be active once the review process is in place.',
      ]
    : selectedRole
      ? [
          'Your account details are submitted and queued for identity verification.',
          'Once KYC is approved, your email is activated and you can log in to the RFQ originator workspace.',
          'You will be able to create private RFQs, review quotes, accept terms, and fund escrow directly from your wallet.',
        ]
      : [
          'Your profile is queued for review and the requested roles are evaluated by the platform team.',
          'Once approved, your email is activated in the backend and the login page will route you to the correct role-based workspace automatically.',
          'Compliance verification is the next mandatory step after submission.',
        ];

  // ── Signup form ───────────────────────────────────────────────────────

  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
      <div className="panel overflow-hidden">
        <div className="border-b border-terminal-border px-6 py-5">
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">{headerLabel}</div>
          <h1 className="mt-3 font-mono text-3xl text-terminal-text">{headerTitle}</h1>
          <p className="mt-4 max-w-2xl font-mono text-sm leading-7 text-terminal-dim">{headerDescription}</p>
        </div>

        <div className="space-y-4 px-6 py-6">
          {/* Role selector — first */}
          <div>
            <div className="mb-2 block font-mono text-xs uppercase tracking-wider text-terminal-dim">I am signing up as</div>
            <div className="grid gap-3 md:grid-cols-2">
              {REQUESTABLE_ROLES.map((role) => {
                const selected = selectedRole === role;
                const isOriginator = role === UserRole.RFQ_ORIGINATOR;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => selectRole(role)}
                    className={`rounded border p-4 text-left transition-colors ${
                      selected
                        ? 'border-terminal-accent bg-terminal-accent/10'
                        : 'border-terminal-border bg-terminal-bg hover:border-terminal-accent/60'
                    }`}
                  >
                    <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">
                      {isOriginator ? 'KYC User' : 'Institution'}
                    </div>
                    <div className="mt-3 font-mono text-xs leading-6 text-terminal-dim">
                      {isOriginator
                        ? 'Individual or entity that creates private RFQs, reviews quotes, and tracks escrow settlement.'
                        : 'Liquidity provider that responds to eligible RFQs, negotiates terms, and fulfills escrow obligations.'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRole ? (
            <>
              {/* Common fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">
                    {isInstitution ? 'Institution Name' : 'Full Name'}
                  </label>
                  <input
                    className="input-field"
                    value={isInstitution ? form.institutionName : form.contactName}
                    onChange={(event) => {
                      if (isInstitution) {
                        handleChange('institutionName', event.target.value);
                      } else {
                        handleChange('contactName', event.target.value);
                      }
                    }}
                    placeholder={isInstitution ? 'Institution legal name' : 'Your full name'}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">
                    {isInstitution ? 'Primary Contact' : 'Email'}
                  </label>
                  <input
                    className="input-field"
                    value={isInstitution ? form.contactName : form.email}
                    onChange={(event) => {
                      if (isInstitution) {
                        handleChange('contactName', event.target.value);
                      } else {
                        handleChange('email', event.target.value);
                      }
                    }}
                    placeholder={isInstitution ? 'Contact full name' : 'you@email.com'}
                    autoComplete={isInstitution ? undefined : 'email'}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {isInstitution ? (
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
                ) : null}
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

              {/* Institution-only fields */}
              {isInstitution ? (
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
              ) : null}

              {/* Wallet address — auto-fetched from Phantom */}
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Wallet Address</label>
                {walletAddress ? (
                  <input
                    className="input-field text-terminal-dim"
                    value={walletAddress}
                    readOnly
                  />
                ) : (
                  <div className="flex items-center gap-3 rounded border border-terminal-border bg-terminal-bg px-3 py-2">
                    <span className="font-mono text-xs text-terminal-dim">No wallet connected</span>
                    <WalletMultiButton />
                  </div>
                )}
              </div>
            </>
          ) : null}

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
                !selectedRole ||
                !form.email ||
                !form.password ||
                form.password.length < 6 ||
                (isInstitution && (!form.institutionName || !form.contactName || !form.institutionType || !form.jurisdiction)) ||
                (!isInstitution && !form.contactName)
              }
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Submitting...' : isInstitution ? 'Submit Institutional Access Request' : 'Create Account'}
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
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">
            {isInstitution ? 'Institutional Onboarding' : selectedRole ? 'KYC Onboarding' : 'Onboarding Scope'}
          </div>
          <h2 className="mt-3 font-mono text-2xl text-terminal-text">{rightPanelTitle}</h2>
        </div>
        <div className="space-y-4 px-6 py-6 font-mono text-xs leading-7 text-terminal-dim">
          {rightPanelItems.map((text, i) => (
            <div key={i} className="rounded border border-terminal-border bg-terminal-bg p-4">
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
