import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { User } from '../../lib/otc/types';
import { UserRole } from '../../lib/otc/types';

interface SASAttestationResult {
  exists: boolean;
  attestationPda: string;
  data: { accreditationLevel: string; jurisdiction: string; complianceTier: number; provider: string; isAccredited: boolean } | null;
  signer: string | null;
  expiry: number | null;
  expired: boolean;
}

type KYCStep = 'idle' | 'initiating' | 'awaiting_zyphe' | 'polling' | 'attesting' | 'complete';
type VerificationType = 'kyc' | 'kyb';
type Jurisdiction = 'CH' | 'US' | 'EU' | 'UK' | 'SG' | 'AE' | 'HK';

const JURISDICTIONS: { code: Jurisdiction; name: string }[] = [
  { code: 'CH', name: 'Switzerland' },
  { code: 'US', name: 'United States' },
  { code: 'EU', name: 'European Union' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'UAE' },
  { code: 'HK', name: 'Hong Kong' },
];

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;

interface KYCVerificationPageProps {
  onNavigate: (path: string) => void;
  currentUser?: User | null;
  authLoading?: boolean;
  forceType?: VerificationType;
}

export default function KYCVerificationPage({ onNavigate, currentUser, authLoading, forceType }: KYCVerificationPageProps) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toString() || '';
  const isInstitution = forceType === 'kyb' || currentUser?.role === UserRole.LIQUIDITY_PROVIDER;
  const vType: VerificationType = forceType || (isInstitution ? 'kyb' : 'kyc');
  const vLabel = isInstitution ? 'KYB' : 'KYC';

  const [attestation, setAttestation] = useState<SASAttestationResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [kycStep, setKycStep] = useState<KYCStep>('idle');
  const [error, setError] = useState('');
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>('CH');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const checkAttestation = useCallback(async () => {
    if (!wallet) return;
    setChecking(true);
    try {
      // First check backend DB — only read on-chain if backend says verified
      const statusRes = await fetch(`/api/otc/kyc/status?wallet=${wallet}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.kycStatus !== 'verified') {
          setAttestation(null);
          setChecking(false);
          return;
        }
      }
      // Backend says verified — now read on-chain attestation for display
      const { readAttestation } = await import('../../lib/sas/client');
      const result = await readAttestation(wallet);
      setAttestation(result);
    } catch {
      setAttestation(null);
    }
    setChecking(false);
  }, [wallet]);

  useEffect(() => { checkAttestation(); }, [checkAttestation]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const pollKycStatus = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/otc/kyc/status?wallet=${wallet}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.kycStatus === 'verified') {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setKycStep('attesting');
        await new Promise(r => setTimeout(r, 2000));
        await checkAttestation();
        setKycStep('complete');
      } else if (data.kycStatus === 'rejected') {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setError('KYC verification was rejected.');
        setKycStep('idle');
      }
    } catch { /* retry */ }
    pollCountRef.current += 1;
    if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setError('Timed out. Check back later.');
      setKycStep('idle');
    }
  }, [wallet, checkAttestation]);

  const startPolling = useCallback(() => {
    pollCountRef.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollKycStatus, POLL_INTERVAL_MS);
    pollKycStatus();
  }, [pollKycStatus]);

  const handleInitiateKYC = async () => {
    if (!wallet) return;
    setError('');
    setKycStep('initiating');
    try {
      const res = await fetch('/api/otc/kyc/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet, jurisdiction, type: vType }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || 'Failed to initiate KYC');
      }
      const data = await res.json() as any;
      if (!data.sessionUrl) throw new Error('No verification URL returned');
      setKycStep('awaiting_zyphe');
      window.open(data.sessionUrl, '_blank', 'noopener,noreferrer');
      setKycStep('polling');
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate KYC');
      setKycStep('idle');
    }
  };

  const isVerified = attestation?.exists && attestation.data && !attestation.expired;

  // Wait for auth to resolve before rendering (prevents KYC→KYB flicker)
  if (authLoading) {
    return (
      <div className="panel p-8 text-center">
        <div className="font-mono text-sm text-terminal-dim">Loading...</div>
      </div>
    );
  }

  // ── Right panel content ─────────────────────────────────────────────────

  const rightPanel = (
    <div className="panel overflow-hidden">
      <div className="border-b border-terminal-border px-6 py-5">
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">How It Works</div>
        <h2 className="mt-3 font-mono text-2xl text-terminal-text">{vLabel} Verification Flow</h2>
      </div>
      <div className="space-y-4 px-6 py-6">
        {[
          { step: '1', title: 'Select Jurisdiction', desc: 'Choose your regulatory region to determine compliance tier and accreditation level.' },
          { step: '2', title: `Zyphe ${vLabel} Verification`, desc: isInstitution ? 'Submit company documents and complete business verification through Zyphe.' : 'Complete document upload and biometric verification through Zyphe.' },
          { step: '3', title: 'SAS On-Chain Attestation', desc: 'Once verified, an immutable attestation is written to Solana via the Solana Attestation Service.' },
          { step: '4', title: 'OTC Access Unlocked', desc: 'Your verified identity enables trading, escrow, and settlement on the ContraClear OTC platform.' },
        ].map((s, i) => (
          <div key={s.step} className="rounded border border-terminal-border bg-terminal-bg p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-terminal-border font-mono text-xs font-bold text-terminal-accent">
                {s.step}
              </div>
              <div>
                <div className="font-mono text-xs font-semibold text-terminal-text">{s.title}</div>
                <div className="mt-1 font-mono text-[10px] leading-5 text-terminal-dim">{s.desc}</div>
              </div>
            </div>
            {i < 3 && <div className="ml-3.5 mt-2 h-3 w-px bg-terminal-border" />}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Not connected ───────────────────────────────────────────────────────

  if (!wallet) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="panel p-8 text-center">
          <div className="font-mono text-lg text-terminal-text">Connect Wallet</div>
          <p className="mt-3 font-mono text-sm text-terminal-dim">Connect your Solana wallet to begin identity verification.</p>
          <div className="mt-6 flex justify-center"><WalletMultiButton /></div>
        </div>
        {rightPanel}
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="panel p-8 text-center">
          <div className="font-mono text-sm text-terminal-dim">Checking on-chain attestation...</div>
        </div>
        {rightPanel}
      </div>
    );
  }

  // ── Verified (on-chain attestation found OR kycStep completed) ──────────

  if (kycStep === 'complete' || (isVerified && attestation?.data)) {
    // Refresh kycVerified in parent so OTC routes unlock
    if (kycStep === 'complete' && !attestation?.data) {
      return (
        <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="panel overflow-hidden">
            <div className="border-b border-terminal-border px-6 py-5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-terminal-green" />
                <span className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-green">{vLabel} Verified</span>
              </div>
              <h1 className="mt-3 font-mono text-2xl text-terminal-text">Verification Complete</h1>
              <p className="mt-3 font-mono text-sm text-terminal-dim">
                Your {isInstitution ? 'institution' : 'identity'} has been verified. You can now access the OTC trading platform.
              </p>
            </div>
            <div className="px-6 py-6 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => { window.location.href = '/otc/rfqs'; }}>Go To OTC Trading</button>
              <button type="button" className="btn-secondary" onClick={() => onNavigate('/')}>Back To Home</button>
            </div>
          </div>
          {rightPanel}
        </div>
      );
    }
  }

  if (isVerified && attestation?.data) {
    const d = attestation.data;
    return (
      <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-terminal-border px-6 py-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-terminal-green" />
              <span className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-green">Identity Verified</span>
            </div>
            <h1 className="mt-3 font-mono text-2xl text-terminal-text">On-Chain KYC Attestation</h1>
          </div>
          <div className="space-y-4 px-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Tier', value: `Tier ${d.complianceTier}` },
                { label: 'Accreditation', value: d.accreditationLevel },
                { label: 'Jurisdiction', value: d.jurisdiction },
                { label: 'Provider', value: d.provider },
              ].map(item => (
                <div key={item.label} className="rounded border border-terminal-border bg-terminal-bg px-3 py-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-terminal-dim">{item.label}</div>
                  <div className="mt-1 font-mono text-sm capitalize text-terminal-text">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-terminal-dim mb-3">On-Chain Attestation (SAS)</div>
              <div className="space-y-2 font-mono text-xs">
                {[
                  ['Attestation PDA', attestation.attestationPda],
                  ['Signer', attestation.signer],
                  ['Expires', attestation.expiry ? new Date(attestation.expiry * 1000).toLocaleDateString() : 'Never'],
                  ['Program', '22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-terminal-dim shrink-0">{k}</span>
                    <span className="text-terminal-text truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => onNavigate('/otc/rfqs')}>Go To OTC Trading</button>
              <button type="button" className="btn-secondary" onClick={() => onNavigate('/')}>Back To Home</button>
            </div>
          </div>
        </div>
        {rightPanel}
      </div>
    );
  }

  // ── In progress ─────────────────────────────────────────────────────────

  if (kycStep !== 'idle') {
    const progress =
      kycStep === 'initiating' ? 15 : kycStep === 'awaiting_zyphe' ? 30 :
      kycStep === 'polling' ? 50 : kycStep === 'attesting' ? 80 :
      kycStep === 'complete' ? 100 : 0;

    return (
      <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-terminal-border px-6 py-5">
            <div className="flex items-center gap-2">
              {kycStep === 'complete'
                ? <span className="h-2 w-2 rounded-full bg-terminal-green" />
                : <span className="h-2 w-2 rounded-full bg-terminal-accent animate-pulse" />
              }
              <span className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-text">Verification In Progress</span>
            </div>
          </div>
          <div className="space-y-4 px-6 py-6">
            <div className="space-y-3">
              <StepItem label="Register DID" done={kycStep !== 'initiating'} active={kycStep === 'initiating'} />
              <StepItem
                label="Zyphe Verification"
                done={kycStep === 'attesting' || kycStep === 'complete'}
                active={kycStep === 'awaiting_zyphe' || kycStep === 'polling'}
                sublabel={kycStep === 'polling' ? `Polling every ${POLL_INTERVAL_MS / 1000}s...` : undefined}
              />
              <StepItem label="On-Chain Attestation" done={kycStep === 'complete'} active={kycStep === 'attesting'} />
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-terminal-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-terminal-accent transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {kycStep === 'polling' && (
              <div className="rounded border border-yellow-700/40 bg-yellow-950/20 p-3 font-mono text-xs text-yellow-200">
                Complete verification in the Zyphe window. This page updates automatically.
              </div>
            )}

            {error && (
              <div className="rounded border border-terminal-red/40 bg-terminal-red/10 p-3 font-mono text-xs text-terminal-red">
                {error}
              </div>
            )}
          </div>
        </div>
        {rightPanel}
      </div>
    );
  }

  // ── Idle / Form ─────────────────────────────────────────────────────────

  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[1.02fr_0.98fr]">
      <div className="panel overflow-hidden">
        <div className="border-b border-terminal-border px-6 py-5">
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">{isInstitution ? 'Institution Verification' : 'Identity Verification'}</div>
          <h1 className="mt-3 font-mono text-3xl text-terminal-text">{isInstitution ? 'Verify your institution' : 'Verify your identity'}</h1>
          <p className="mt-4 font-mono text-sm leading-7 text-terminal-dim">
            {isInstitution ? 'Complete KYB verification through Zyphe. Your institution will be attested on Solana via the Solana Attestation Service.' : 'Complete KYC verification through Zyphe. Your wallet address will be attested on Solana via the Solana Attestation Service.'}
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded border border-terminal-red/40 bg-terminal-red/10 p-3 font-mono text-xs text-terminal-red">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Jurisdiction</label>
            <div className="grid grid-cols-4 gap-2">
              {JURISDICTIONS.map(j => (
                <button
                  key={j.code}
                  type="button"
                  onClick={() => setJurisdiction(j.code)}
                  className={`rounded border p-2.5 text-center transition-colors ${
                    jurisdiction === j.code
                      ? 'border-terminal-accent bg-terminal-accent/10 text-terminal-accent'
                      : 'border-terminal-border text-terminal-dim hover:border-terminal-accent/60 hover:text-terminal-text'
                  }`}
                >
                  <div className="font-mono text-sm font-bold">{j.code}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-terminal-dim">{j.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            <div className="font-mono text-xs font-semibold text-terminal-text">Powered by Zyphe</div>
            <p className="mt-1 font-mono text-[10px] text-terminal-dim">
              Document verification + biometric checks. Your wallet address will be attested on Solana upon success.
            </p>
          </div>

          {/* Wallet display */}
          <div>
            <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Wallet Address</label>
            <input className="input-field text-terminal-dim" value={wallet} readOnly />
          </div>

          <button
            type="button"
            className="btn-primary w-full py-3"
            onClick={() => void handleInitiateKYC()}
          >
            {`Start ${vLabel} Verification`}
          </button>

          <p className="font-mono text-[9px] text-terminal-dim text-center">
            Verified by Zyphe. Attested on Solana via SAS program 22zoJMt...
          </p>
        </div>
      </div>
      {rightPanel}
    </div>
  );
}

function StepItem({ label, done, active, sublabel }: { label: string; done: boolean; active: boolean; sublabel?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        {done ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-terminal-green/20">
            <svg className="h-3 w-3 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        ) : active ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-terminal-accent/20">
            <span className="h-2 w-2 rounded-full bg-terminal-accent animate-pulse" />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border border-terminal-border" />
        )}
      </div>
      <div>
        <p className={`font-mono text-xs ${done ? 'text-terminal-green' : active ? 'text-terminal-text' : 'text-terminal-dim'}`}>{label}</p>
        {sublabel && <p className="mt-0.5 font-mono text-[10px] text-terminal-dim">{sublabel}</p>}
      </div>
    </div>
  );
}
