const workflowSteps = [
  {
    eyebrow: '01',
    title: 'Institution creates RFQ',
    description: 'Requestors submit trade intent, policy constraints, and escrow requirements inside their bank workspace.',
  },
  {
    eyebrow: '02',
    title: 'Bank submits quote',
    description: 'The quote desk responds with price, size, validity, and settlement notes for that institution only.',
  },
  {
    eyebrow: '03',
    title: 'Negotiation and price discovery',
    description: 'Both sides iterate privately with versioned terms instead of broadcasting orders to a public marketplace.',
  },
  {
    eyebrow: '04',
    title: 'Bilateral escrow deposit',
    description: 'Institution and bank fund mirrored obligations so commercial terms stay backed by explicit escrow state.',
  },
  {
    eyebrow: '05',
    title: 'Policy verification',
    description: 'KYB, policy review, and internal controls remain inside the bank-operated tenant from start to finish.',
  },
  {
    eyebrow: '06',
    title: 'Atomic settlement',
    description: 'Once both legs are ready, settlement completes through Contra on Solana with a shared operational view.',
  },
];

const platformPanels = [
  {
    title: 'For Banks',
    subtitle: 'Operate the quote desk and the tenant',
    items: [
      'Onboard institutions and their users',
      'Manage KYB, policy, and allowed assets',
      'Respond to RFQs and negotiate terms',
      'Monitor escrow and settlement operations',
    ],
  },
  {
    title: 'For Institutions',
    subtitle: 'Trade inside a private bank-operated market',
    items: [
      'Submit RFQs directly to your bank',
      'Negotiate privately with the bank desk',
      'Track escrow obligations side-by-side',
      "View only your organization's RFQs and trades",
    ],
  },
];

const contraReasons = [
  'Private execution for institutional negotiations',
  'Atomic settlement backed by bilateral escrow',
  'Bank-controlled deployment and access policies',
  'Explicit policy checkpoints before settlement release',
  'Solana-connected liquidity and operational speed',
];

const infrastructureSignals = [
  'KYB onboarding',
  'Role-gated access',
  'Policy enforcement',
  'Operational auditability',
  'Bank-operated deployment',
];

interface LandingPageProps {
  isAuthenticated: boolean;
  onPrimaryAction: () => void;
}

export default function LandingPage({ isAuthenticated, onPrimaryAction }: LandingPageProps) {
  return (
    <div className="landing-shell">
      <div className="landing-grid" />
      <div className="landing-orb landing-orb-top" />
      <div className="landing-orb landing-orb-bottom" />

      <header className="relative z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 font-mono text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
              C
            </span>
            <span>
              <span className="block font-mono text-[11px] uppercase tracking-[0.35em] text-cyan-300/80">
                ContraOTC
              </span>
              <span className="block text-sm text-white/75">Bank-operated OTC infrastructure</span>
            </span>
          </button>

          <nav className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-[0.28em] text-white/55 md:flex">
            <a href="#workflow" className="transition-colors hover:text-cyan-300">Workflow</a>
            <a href="#platform" className="transition-colors hover:text-cyan-300">Platform</a>
            <a href="#infrastructure" className="transition-colors hover:text-cyan-300">Infrastructure</a>
          </nav>

          <button type="button" className="landing-button-secondary" onClick={onPrimaryAction}>
            {isAuthenticated ? 'Open Workspace' : 'Sign In'}
          </button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8 lg:pb-32 lg:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="landing-tag mx-auto">
              Private RFQ execution for bank-operated institutional markets
            </div>
            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Private OTC execution
              <span className="block bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                for institutional markets
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
              Banks operate the node, onboard institutions, quote and negotiate privately, and
              monitor bilateral escrow through Contra on Solana. Institutions submit RFQs into
              their bank&apos;s tenant, not a public venue.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button type="button" className="landing-button-primary" onClick={onPrimaryAction}>
                {isAuthenticated ? 'Open Workspace' : 'Open Demo Workspace'}
              </button>
              <a href="#workflow" className="landing-button-secondary">
                View Workflow
              </a>
            </div>
          </div>

          <div className="relative mx-auto mt-20 max-w-5xl">
            <div className="landing-rail" />
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="landing-glass p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/80">
                      Bank Command Center
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">Aurora Bank Tenant</div>
                  </div>
                  <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">
                    Live Workflow
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-4">
                  {[
                    ['New RFQs', '12'],
                    ['Negotiations', '5'],
                    ['Awaiting Deposits', '3'],
                    ['Ready to Settle', '2'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">{label}</div>
                      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[24px] border border-white/8 bg-[#071117] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/80">
                          Negotiation Thread
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          BTC/USD sell RFQ for Northstar
                        </div>
                      </div>
                      <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-amber-200">
                        REVIEW REQUIRED
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] p-4">
                        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">
                          <span>Bank Quote v3</span>
                          <span>Valid 12m</span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-4">
                          <div>
                            <div className="text-3xl font-semibold text-white">64,600</div>
                            <div className="mt-1 text-sm text-white/55">12 BTC notional</div>
                          </div>
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-white/8">
                            <div className="landing-pulse-bar h-full w-3/4 rounded-full bg-cyan-300" />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">
                            Institution Escrow
                          </div>
                          <div className="mt-3 text-xl font-semibold text-white">USD 775,200</div>
                          <div className="mt-2 text-sm text-white/55">Pending confirmation in Contra</div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">
                            Bank Escrow
                          </div>
                          <div className="mt-3 text-xl font-semibold text-white">12 BTC</div>
                          <div className="mt-2 text-sm text-white/55">Ready after internal treasury release</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      ['Institution', 'Northstar Asset Management', 'KYB approved'],
                      ['Policy', 'Trade threshold review', 'Manual approval checkpoint'],
                      ['Settlement', 'Atomic release via Contra', 'Shared operational state'],
                    ].map(([label, value, detail]) => (
                      <div key={label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</div>
                        <div className="mt-3 text-lg font-semibold text-white">{value}</div>
                        <div className="mt-2 text-sm text-white/55">{detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  ['Tenant = Bank', 'Every RFQ, quote, policy, and escrow obligation stays bank-scoped.'],
                  ['Organization = Institution', 'Users belong to institutions inside that tenant and never see cross-client flow.'],
                  ['No Public Filler Market', 'Negotiation happens directly between the institution and the bank quote desk.'],
                ].map(([title, description]) => (
                  <div key={title} className="landing-glass p-5">
                    <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300/80">{title}</div>
                    <p className="mt-3 text-sm leading-7 text-white/65">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="landing-tag">Workflow</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                One private path from RFQ to settlement
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-white/60">
              The platform is designed for bilateral institutional execution, not open competition for fills.
              The workflow stays controlled, auditable, and bank-scoped at every stage.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <article key={step.title} className="landing-glass p-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/80">{step.eyebrow}</span>
                  <span className="landing-node">
                    <span className="landing-node-core" />
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/60">{step.description}</p>
                <div className="mt-6 h-px w-full bg-gradient-to-r from-cyan-400/50 via-cyan-400/5 to-transparent" />
                <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.28em] text-white/40">
                  Step {(index + 1).toString().padStart(2, '0')}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            {platformPanels.map((panel) => (
              <article key={panel.title} className="landing-glass p-7 sm:p-8">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/80">
                  {panel.title}
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-white">{panel.subtitle}</h3>
                <div className="mt-6 space-y-3">
                  {panel.items.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.8)]" />
                      <span className="text-sm leading-7 text-white/70">{item}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="landing-glass p-7 sm:p-8">
              <div className="landing-tag">Why Contra</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                Built for controlled institutional execution
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/60">
                Contra gives the workflow a credible settlement layer while the bank tenant keeps
                access, policy, and quoting under direct institutional control.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {contraReasons.map((reason) => (
                <div key={reason} className="landing-glass p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-300/80">
                    Contra
                  </div>
                  <div className="mt-4 text-base leading-7 text-white/75">{reason}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="landing-tag">Product UI</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Three views of the same bilateral operation
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-white/60">
              Banks and institutions share settlement context, but only through the lens their role allows.
            </p>
          </div>

          <div className="mt-12 grid gap-6 xl:grid-cols-3">
            {[
              {
                title: 'Bank command center',
                meta: 'Institutions, RFQs, policy, and exceptions',
                rows: [
                  ['New RFQs', '12'],
                  ['Escrow alerts', '03'],
                  ['Policy holds', '02'],
                ],
              },
              {
                title: 'Institution RFQ dashboard',
                meta: 'My RFQs, negotiations, and deposits',
                rows: [
                  ['Open RFQs', '05'],
                  ['Awaiting quote', '02'],
                  ['Awaiting my deposit', '01'],
                ],
              },
              {
                title: 'Escrow settlement monitor',
                meta: 'Side-by-side funding and release state',
                rows: [
                  ['Institution leg', 'Confirmed'],
                  ['Bank leg', 'Pending'],
                  ['Settlement', 'Ready'],
                ],
              },
            ].map((frame) => (
              <div key={frame.title} className="landing-browser">
                <div className="landing-browser-bar">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
                </div>
                <div className="p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-300/80">
                    {frame.title}
                  </div>
                  <div className="mt-3 text-sm leading-7 text-white/60">{frame.meta}</div>
                  <div className="mt-6 space-y-3">
                    {frame.rows.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">{label}</span>
                        <span className="text-sm font-semibold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="infrastructure" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="landing-glass p-7 sm:p-10">
            <div className="grid gap-10 xl:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="landing-tag">Infrastructure</div>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">
                  Trust is built into the workflow surface
                </h2>
                <p className="mt-5 text-sm leading-7 text-white/60">
                  The platform is designed to feel like institutional infrastructure, not consumer crypto:
                  explicit access boundaries, policy state, and operational auditability at every step.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {infrastructureSignals.map((signal) => (
                  <div key={signal} className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-6 text-center">
                    <div className="mx-auto h-12 w-12 rounded-full border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_32px_rgba(34,211,238,0.12)]" />
                    <div className="mt-4 text-sm font-medium text-white/78">{signal}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-32">
          <div className="landing-cta-panel">
            <div>
              <div className="landing-tag">Launch-ready demo</div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Build the next generation of institutional OTC on Contra
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60">
                Explore the bank workspace, institution flows, bilateral negotiation, and escrow-driven settlement model already wired into this repo.
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button type="button" className="landing-button-primary" onClick={onPrimaryAction}>
                {isAuthenticated ? 'Open Workspace' : 'Open Demo Workspace'}
              </button>
              <a href="#platform" className="landing-button-secondary">
                Explore Platform
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
