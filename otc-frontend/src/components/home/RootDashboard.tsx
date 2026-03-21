import type { User } from '../../lib/otc/types';
import { USER_ROLE_LABELS } from '../../lib/otc/types';

interface RootDashboardProps {
  currentUser: User | null;
  onReadyToStart: () => void;
  onNavigate: (path: string) => void;
}

const workflowSteps = [
  {
    id: '01',
    title: 'Institution creates RFQ',
    description: 'Submit a structured request for quote with asset, size, and parameters.',
  },
  {
    id: '02',
    title: 'Bank submits quote',
    description: 'The operating bank responds with pricing, terms, and execution parameters.',
  },
  {
    id: '03',
    title: 'Negotiation and discovery',
    description: 'Private bilateral negotiation between counterparties with full audit trail.',
  },
  {
    id: '04',
    title: 'Bilateral escrow deposit',
    description: 'Both parties lock collateral into a Contra-managed escrow contract.',
  },
  {
    id: '05',
    title: 'Policy verification',
    description: 'Automated policy checks validate KYB, limits, and compliance rules.',
  },
  {
    id: '06',
    title: 'Atomic settlement',
    description: 'Trade settles atomically on Solana with all-or-nothing execution.',
  },
];

const whyContraItems = [
  {
    title: 'Private execution',
    description: 'Trades are negotiated bilaterally with no public order books, no front-running, and no information leakage.',
  },
  {
    title: 'Atomic settlement',
    description: 'All-or-nothing settlement on Solana ensures both legs execute simultaneously or not at all.',
  },
  {
    title: 'Escrow-backed flows',
    description: 'Collateral is locked in smart-contract escrow before execution, reducing counterparty default risk.',
  },
  {
    title: 'Institutional control',
    description: 'Banks retain control over counterparty access, pricing policies, settlement parameters, and compliance.',
  },
  {
    title: 'Solana-native liquidity',
    description: 'Direct access to high-throughput settlement with sub-second finality and low fees.',
  },
];

const trustItems = [
  {
    title: 'KYB onboarding',
    description: 'Every counterparty is verified before accessing the platform.',
  },
  {
    title: 'Role-gated access',
    description: 'Granular permissions ensure only authorized users touch sensitive operations.',
  },
  {
    title: 'Policy enforcement',
    description: 'Configurable compliance policies validate automatically before settlement.',
  },
  {
    title: 'Full auditability',
    description: 'Every quote, negotiation, and settlement is logged with a durable audit trail.',
  },
  {
    title: 'Bank-operated model',
    description: 'Banks deploy and operate their own instance with no shared-infrastructure risk.',
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="font-mono text-xs uppercase tracking-[0.35em] text-terminal-accent">{eyebrow}</div>
      <h2 className="mt-3 font-mono text-3xl leading-tight text-terminal-text md:text-4xl">{title}</h2>
      <p className="mt-4 font-mono text-sm leading-7 text-terminal-dim">{description}</p>
    </div>
  );
}

function ShowcasePanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-terminal-border px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-terminal-border" />
          <div className="h-2.5 w-2.5 rounded-full bg-terminal-border" />
          <div className="h-2.5 w-2.5 rounded-full bg-terminal-border" />
        </div>
        <div className="flex-1 text-center font-mono text-[10px] uppercase tracking-wider text-terminal-dim">
          app.contraotc.io/{title.toLowerCase().replace(/\s+/g, '-')}
        </div>
        {badge ? (
          <div className="rounded border border-terminal-accent/30 bg-terminal-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-terminal-accent">
            {badge}
          </div>
        ) : null}
      </div>
      <div className="space-y-3 p-5">{children}</div>
    </div>
  );
}

export default function RootDashboard({ currentUser, onReadyToStart, onNavigate }: RootDashboardProps) {
  return (
    <div className="space-y-10">
      <section className="panel overflow-hidden" id="top">
        <div className="relative border-b border-terminal-border px-6 py-10 md:px-10 md:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,209,0.08),transparent_45%)]" />
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded border border-terminal-accent/30 bg-terminal-accent/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.35em] text-terminal-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-terminal-accent animate-pulse" />
              Built on Contra + Solana
            </div>
            <h1 className="mt-8 font-mono text-4xl leading-tight text-terminal-text md:text-6xl">
              Private OTC execution
              <br />
              for institutional markets
            </h1>
            <p className="mx-auto mt-6 max-w-3xl font-mono text-base leading-8 text-terminal-dim">
              Bank-operated RFQ infrastructure enabling private negotiation, escrow-backed settlement, and atomic execution on Solana.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" className="btn-primary min-w-52" onClick={onReadyToStart}>
                Ready To Start
              </button>
              <button type="button" className="btn-secondary min-w-52" onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>
                View Workflow
              </button>
            </div>
            {currentUser ? (
              <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-2 rounded border border-terminal-border bg-terminal-bg px-4 py-3 font-mono text-xs text-terminal-dim">
                Signed in as
                <span className="text-terminal-text">{currentUser.fullName}</span>
                <span className="text-terminal-accent">({USER_ROLE_LABELS[currentUser.role]})</span>
                <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => onNavigate(currentUser.role === 'ADMIN' ? '/admin/otc' : '/otc/rfqs')}>
                  Open Workspace
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section id="workflow" className="space-y-6">
        <SectionHeading
          eyebrow="How It Works"
          title="Negotiate privately. Settle atomically."
          description="A complete RFQ-to-settlement workflow designed for institutional counterparties."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          {workflowSteps.map((step) => (
            <div key={step.id} className="panel p-5">
              <div className="flex gap-4">
                <div className="font-mono text-sm text-terminal-accent">{step.id}</div>
                <div>
                  <div className="font-mono text-sm text-terminal-text">{step.title}</div>
                  <div className="mt-2 font-mono text-xs leading-6 text-terminal-dim">{step.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="platform" className="space-y-6">
        <SectionHeading
          eyebrow="Platform"
          title="Built for both sides of the desk"
          description="Purpose-built interfaces for banks operating quote desks and institutions seeking private execution."
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="panel p-6">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">For Banks</div>
            <h3 className="mt-3 font-mono text-xl text-terminal-text">Operate your own private OTC desk</h3>
            <p className="mt-3 font-mono text-xs leading-6 text-terminal-dim">
              Full control over counterparty access, pricing, settlement policy, and operational monitoring.
            </p>
            <div className="mt-5 space-y-3 font-mono text-xs text-terminal-text">
              <div>Onboard institutions with KYB</div>
              <div>Manage quote desk operations</div>
              <div>Monitor escrow and settlement</div>
              <div>Enforce compliance policies</div>
            </div>
          </div>
          <div className="panel p-6">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">For Institutions</div>
            <h3 className="mt-3 font-mono text-xl text-terminal-text">Access bank-operated markets privately</h3>
            <p className="mt-3 font-mono text-xs leading-6 text-terminal-dim">
              Structured RFQ workflows, direct negotiation, escrow-backed execution, and controlled settlement.
            </p>
            <div className="mt-5 space-y-3 font-mono text-xs text-terminal-text">
              <div>Submit structured RFQs</div>
              <div>Negotiate directly with banks</div>
              <div>Track escrow and settlement</div>
              <div>Access private bank-operated markets</div>
            </div>
          </div>
        </div>
      </section>

      <section id="why-contra" className="space-y-6">
        <SectionHeading
          eyebrow="Why Contra"
          title="Infrastructure-grade OTC"
          description="Purpose-built for the requirements of institutional over-the-counter markets."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {whyContraItems.map((item) => (
            <div key={item.title} className="panel p-5">
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">{item.title}</div>
              <div className="mt-3 font-mono text-xs leading-6 text-terminal-dim">{item.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="space-y-6">
        <SectionHeading
          eyebrow="Product"
          title="Designed for the trading floor"
          description="Professional-grade interfaces for every participant in the OTC workflow."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          <ShowcasePanel title="Command Center" badge="Live">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-terminal-text">Bank Command Center</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-terminal-accent">Live</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Active RFQs', value: '24' },
                { label: 'Open Quotes', value: '18' },
                { label: 'Escrowed', value: '$42.8M' },
                { label: 'Settled 24h', value: '$128M' },
              ].map((item) => (
                <div key={item.label} className="rounded border border-terminal-border bg-terminal-bg p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-terminal-dim">{item.label}</div>
                  <div className="mt-1 font-mono text-sm text-terminal-text">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {['INST-A -> 500 SOL @ $148.20', 'INST-B -> 1,200 ETH @ $3,420'].map((line) => (
                <div key={line} className="rounded border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-[10px] text-terminal-dim">
                  {line}
                </div>
              ))}
            </div>
          </ShowcasePanel>

          <ShowcasePanel title="RFQ Dashboard" badge="3 Active">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-terminal-text">RFQ Dashboard</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-terminal-accent">3 Active</span>
            </div>
            <div className="space-y-2">
              {[
                { pair: 'SOL/USDC', size: '50,000 SOL', status: 'Quoted' },
                { pair: 'ETH/USDC', size: '2,000 ETH', status: 'Negotiating' },
                { pair: 'BTC/USDC', size: '100 BTC', status: 'In Escrow' },
              ].map((row) => (
                <div key={row.pair} className="flex items-center justify-between rounded border border-terminal-border bg-terminal-bg px-3 py-3">
                  <div>
                    <div className="font-mono text-xs text-terminal-text">{row.pair}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-terminal-dim">{row.size}</div>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-terminal-accent">{row.status}</div>
                </div>
              ))}
            </div>
          </ShowcasePanel>

          <ShowcasePanel title="Settlement Monitor" badge="On Chain">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-terminal-text">Escrow Monitor</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-terminal-dim">Block #248,391,204</span>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-terminal-dim">Total Escrowed</span>
                <span className="font-mono text-sm text-terminal-text">$42,800,000</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-terminal-surface">
                <div className="h-full w-3/4 rounded-full bg-terminal-accent" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-terminal-dim">
                <span>74% locked</span>
                <span>26% settling</span>
              </div>
            </div>
            <div className="space-y-2">
              {['Settlement #4821 - Complete', 'Settlement #4822 - Validating'].map((line) => (
                <div key={line} className="rounded border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-[10px] text-terminal-dim">
                  {line}
                </div>
              ))}
            </div>
          </ShowcasePanel>
        </div>
      </section>

      <section id="infrastructure" className="space-y-6">
        <SectionHeading
          eyebrow="Infrastructure"
          title="Enterprise-grade trust architecture"
          description="Built to meet the compliance, security, and operational requirements of regulated institutions."
        />
        <div className="space-y-3">
          {trustItems.map((item) => (
            <div key={item.title} className="panel p-5">
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-terminal-accent">{item.title}</div>
              <div className="mt-2 font-mono text-xs leading-6 text-terminal-dim">{item.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="panel overflow-hidden">
        <div className="border-b border-terminal-border px-6 py-4">
          <SectionHeading
            eyebrow="Demo"
            title="Build the next generation of institutional OTC on Contra"
            description="Join the institutions and banks building private, compliant, and atomic OTC infrastructure on Solana."
          />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 sm:flex-row">
          <button type="button" className="btn-primary min-w-52" onClick={onReadyToStart}>
            Ready To Start
          </button>
          <button type="button" className="btn-secondary min-w-52" onClick={() => window.location.href = 'mailto:sales@contraotc.dev'}>
            Contact Sales
          </button>
        </div>
      </section>
    </div>
  );
}
