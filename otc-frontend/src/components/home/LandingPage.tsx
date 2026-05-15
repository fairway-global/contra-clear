import React, { useEffect, useRef } from 'react';
import LANDING_CSS from './landing/LandingCSS';

interface LandingPageProps {
  onLaunchApp: () => void;
}

const MARQUEE_ITEMS: Array<{ type: 'img' | 'text'; src?: string; alt?: string; label?: string; round?: boolean }> = [
  { type: 'img', src: '/contra-clear-logo.png', alt: 'ContraClear', round: true },
  { type: 'text', label: 'CONTRACLEAR' },
  { type: 'text', label: 'SOLANA' },
  { type: 'text', label: 'PRIVATE OTC' },
  { type: 'text', label: 'RFQ' },
  { type: 'text', label: 'ESCROW' },
  { type: 'text', label: 'ATOMIC SETTLEMENT' },
  { type: 'text', label: 'KYB' },
  { type: 'text', label: 'INSTITUTIONAL' },
  { type: 'text', label: 'BILATERAL NEGOTIATION' },
  { type: 'text', label: 'SELF-CUSTODY' },
  { type: 'text', label: 'COMPLIANCE' },
  { type: 'text', label: 'FAIRWAY GLOBAL' },
];

const HERO_PHRASES = [
  'Private Negotiation',
  'Atomic Settlement',
  'Escrow-Backed Flows',
  'Institution-Operated',
];

const FAQ_ITEMS = [
  {
    q: 'What is ContraClear?',
    a: 'ContraClear is institutional OTC infrastructure built on Solana. Trusted host institutions operate their own RFQ desks where verified counterparties negotiate bilaterally, lock collateral in smart-contract escrow, and settle atomically with sub-second finality — all without public order books and without exposing trade intent.',
  },
  {
    q: 'How does the OTC workflow work?',
    a: 'An RFQ creator submits a structured request — asset, size, parameters. An approved trader at a trusted host institution responds with a quote. The two parties negotiate privately with a full audit trail, both deposit into bilateral escrow, automated policy checks verify KYB and compliance, and the trade settles atomically on Solana.',
  },
  {
    q: 'How is settlement atomic?',
    a: 'Collateral on both sides is locked into a Contra-managed escrow contract before execution. The trade either settles in full for both legs simultaneously, or it unwinds in full. There is no partial fill, no exposure window, and no intermediary holding the position mid-trade.',
  },
  {
    q: 'How is compliance enforced?',
    a: 'Every participant is KYB-verified before joining a host institution\'s desk. Access is role-gated — RFQ originators, approved traders, and operators each see only what their role permits. Compliance policies are configurable per host and validate automatically before settlement, with a full immutable audit trail.',
  },
  {
    q: 'Who operates a ContraClear instance?',
    a: 'ContraClear is institution-operated: each trusted host runs their own instance with full control over participant access, pricing policy, settlement parameters, and operational monitoring. There is no shared infrastructure between hosts and no global trust assumption.',
  },
  {
    q: 'Why Solana?',
    a: 'Solana provides sub-second finality, low fees, and high throughput — the right tradeoffs for institutional OTC settlement. ContraClear uses Solana-native primitives directly, with no bridges, no wrapped synthetics, and no off-chain settlement layer.',
  },
];

const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = LANDING_CSS;
    document.head.appendChild(style);

    let idx = 0;
    const iv = setInterval(() => {
      const el = rotRef.current;
      if (!el) return;
      el.style.transform = 'rotateX(-90deg)';
      el.style.opacity = '0';
      setTimeout(() => {
        idx = (idx + 1) % HERO_PHRASES.length;
        el.textContent = HERO_PHRASES[idx];
        el.style.transform = 'rotateX(90deg)';
        void el.offsetWidth;
        requestAnimationFrame(() => {
          el.style.transform = 'rotateX(0deg)';
          el.style.opacity = '1';
        });
      }, 400);
    }, 2800);

    const onScroll = () => {
      const sn = document.getElementById('cclStickyNav');
      if (sn) sn.classList.toggle('visible', window.scrollY > window.innerHeight * 0.3);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const d = (e.target as HTMLElement).dataset.delay || '0';
            setTimeout(() => e.target.classList.add('in-view'), +d);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    rootRef.current?.querySelectorAll('[data-animate]').forEach((el) => obs.observe(el));

    const cobs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const t = +(e.target as HTMLElement).dataset.target!;
            const s = performance.now();
            const a = (n: number) => {
              const p = Math.min((n - s) / 1800, 1);
              (e.target as HTMLElement).textContent = String(Math.round((1 - Math.pow(1 - p, 3)) * t));
              if (p < 1) requestAnimationFrame(a);
            };
            requestAnimationFrame(a);
            cobs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.3 },
    );
    rootRef.current?.querySelectorAll('.counter').forEach((el) => cobs.observe(el));

    const faqHandlers: Array<{ btn: Element; handler: EventListener }> = [];
    rootRef.current?.querySelectorAll('.faq-question').forEach((btn) => {
      const handler: EventListener = () => {
        const item = btn.closest('.faq-item');
        const isOpen = item?.classList.contains('expanded');
        rootRef.current?.querySelectorAll('.faq-item').forEach((i) => i.classList.remove('expanded'));
        if (!isOpen) item?.classList.add('expanded');
      };
      btn.addEventListener('click', handler);
      faqHandlers.push({ btn, handler });
    });

    return () => {
      clearInterval(iv);
      window.removeEventListener('scroll', onScroll);
      if (style.parentNode) style.parentNode.removeChild(style);
      obs.disconnect();
      cobs.disconnect();
      faqHandlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
    };
  }, []);

  const goApp = (e: React.MouseEvent) => {
    e.preventDefault();
    onLaunchApp();
  };

  const scrollToId = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const marqueeItems = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  const marquee = marqueeItems.map((item, i) =>
    item.type === 'img' ? (
      <img key={i} src={item.src} alt={item.alt} className={item.round ? 'round' : ''} />
    ) : (
      <span key={i}>{item.label}</span>
    ),
  );

  const Logo = ({ small }: { small?: boolean }) => (
    <>
      <img
        src="/contra-clear-logo.png"
        alt="ContraClear"
        className={small ? 'logo-img logo-img--small' : 'logo-img'}
      />
      <span className={small ? 'logo-text logo-text--small' : 'logo-text'}>CONTRA CLEAR</span>
    </>
  );

  return (
    <div className="klp" ref={rootRef}>
      <div className="top-banner">
        <div className="top-banner-inner">
          <span className="top-banner-text">Live on Solana · Private Institutional OTC Settlement</span>
          <a className="top-banner-link" href="#" onClick={goApp}>
            Launch App ›
          </a>
        </div>
      </div>

      <header className="header" id="header">
        <div className="nav-container">
          <a href="#" className="logo" onClick={scrollToId('top')}>
            <Logo />
          </a>
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#overview" onClick={scrollToId('overview')}>Overview</a>
            <a href="#product" onClick={scrollToId('product')}>Product</a>
            <a href="#features" onClick={scrollToId('features')}>Features</a>
            <a href="#faq" onClick={scrollToId('faq')}>FAQ</a>
          </nav>
          <a href="#" className="nav-cta" onClick={goApp}>
            Launch App
          </a>
        </div>
      </header>

      <div className="sticky-nav" id="cclStickyNav">
        <nav className="sticky-nav-inner">
          <a href="#" className="logo logo--small" onClick={scrollToId('top')}>
            <Logo small />
          </a>
          <div className="sticky-nav-links">
            <a href="#overview" onClick={scrollToId('overview')}>Overview</a>
            <a href="#product" onClick={scrollToId('product')}>Product</a>
            <a href="#features" onClick={scrollToId('features')}>Features</a>
            <a href="#faq" onClick={scrollToId('faq')}>FAQ</a>
          </div>
          <a href="#" className="nav-cta nav-cta--small" onClick={goApp}>
            Launch App
          </a>
        </nav>
      </div>

      <section className="hero" id="top">
        <div className="hero-bg">
          <video className="hero-video" autoPlay muted loop playsInline preload="auto">
            <source src="/hero.mp4" type="video/mp4" />
          </video>
          <div className="hero-video-overlay" />
          <div className="hero-video-gradient" />
        </div>
        <div className="hero-content">
          <div className="hero-text-block">
            <h1 className="hero-title" data-animate="fade-up">
              <span className="hero-rotating-wrapper">
                <span className="hero-rotating-text" ref={rotRef}>
                  {HERO_PHRASES[0]}
                </span>
              </span>
              <span className="hero-static-text">
                Private OTC for <span className="accent-text">Institutional Markets.</span>
              </span>
            </h1>
            <p className="hero-subtitle" data-animate="fade-up" data-delay="400">
              Trusted-institution-operated RFQ infrastructure on{' '}
              <strong style={{ color: '#fff', fontWeight: 600 }}>Solana</strong>. Bilateral negotiation,
              escrow-backed collateral, and{' '}
              <strong style={{ color: '#fff', fontWeight: 600 }}>atomic settlement</strong> — with KYB enforcement and a
              full audit trail built in.
            </p>
            <div className="hero-actions" data-animate="fade-up" data-delay="700">
              <a href="#" className="btn btn-primary" onClick={goApp}>
                Launch App
              </a>
              <a href="#overview" className="btn btn-ghost" onClick={scrollToId('overview')}>
                How it Works
              </a>
            </div>
          </div>
        </div>
        <div className="hero-partners">
          <div className="marquee">
            <div className="marquee-track">{marquee}</div>
          </div>
        </div>
      </section>

      <section className="stats-section" id="overview">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-block" data-animate="fade-up">
              <div className="stat-bg-text">$846T</div>
              <p className="stat-label">The Market</p>
              <div className="stat-value">
                $<span className="counter" data-target="846">0</span>T
              </div>
              <p className="stat-desc">
                in annual notional across global OTC markets — bilateral, institutional, and almost entirely off-chain.
                ContraClear brings the rails on-chain.
              </p>
            </div>
            <div className="stat-block" data-animate="fade-up" data-delay="200">
              <div className="stat-bg-text">&lt;1s</div>
              <p className="stat-label">Solana Finality</p>
              <div className="stat-value">
                &lt;<span className="counter" data-target="1">0</span>s
              </div>
              <p className="stat-desc">
                settlement finality on Solana, with throughput that lets institutional flow clear at desk-grade latency
                — without giving up custody or compliance.
              </p>
            </div>
          </div>

          <div className="pillars" data-animate="fade-up" data-delay="400">
            <div className="pillar-card">
              <p className="pillar-fig">01</p>
              <div className="pillar-icon-area">
                <svg viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="28" stroke="rgba(0,255,209,0.3)" strokeWidth="1.5" />
                  <circle cx="32" cy="32" r="18" stroke="rgba(0,255,209,0.5)" strokeWidth="1.5" />
                  <circle cx="32" cy="32" r="6" fill="rgba(0,255,209,0.8)" />
                </svg>
              </div>
              <h3 className="pillar-title">Private Bilateral Negotiation</h3>
              <p className="pillar-desc">
                Structured RFQs, direct counterparty negotiation, no public order books, no front-running, no
                information leakage. Every interaction is logged with a durable audit trail.
              </p>
            </div>
            <div className="pillar-card">
              <p className="pillar-fig">02</p>
              <div className="pillar-icon-area">
                <svg viewBox="0 0 64 64" fill="none">
                  <rect x="8" y="8" width="48" height="48" rx="8" stroke="rgba(0,255,209,0.3)" strokeWidth="1.5" />
                  <path
                    d="M20 44 L32 20 L44 44"
                    stroke="rgba(0,255,209,0.8)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="pillar-title">Escrow-Backed Atomic Settlement</h3>
              <p className="pillar-desc">
                Collateral is locked in a Contra-managed escrow contract before execution. The trade settles in full for
                both legs simultaneously, or it unwinds — never anything in between.
              </p>
            </div>
            <div className="pillar-card">
              <p className="pillar-fig">03</p>
              <div className="pillar-icon-area">
                <svg viewBox="0 0 64 64" fill="none">
                  <path
                    d="M32 4 L60 18 L60 46 L32 60 L4 46 L4 18Z"
                    stroke="rgba(0,255,209,0.3)"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <circle cx="32" cy="32" r="10" stroke="rgba(0,255,209,0.8)" strokeWidth="1.5" />
                </svg>
              </div>
              <h3 className="pillar-title">Operator-Controlled Access</h3>
              <p className="pillar-desc">
                Each trusted host institution runs its own instance with full control over participant onboarding,
                pricing policy, KYB enforcement, and settlement parameters — no shared infrastructure.
              </p>
            </div>
          </div>

          <div className="section-bridge" data-animate="fade-up">
            <div className="bridge-line" style={{ transform: 'scaleX(1)' }} />
            <p className="bridge-text" style={{ opacity: 1 }}>
              Institutional OTC. Settled atomically. On Solana.
            </p>
          </div>
        </div>
      </section>

      <section className="product-section" id="product">
        <div className="container">
          <div className="product-header">
            <p className="section-tag" data-animate="fade-up">
              The Platform
            </p>
            <h2 className="section-title" data-animate="fade-up" data-delay="100">
              Built for Both Sides of the Desk
            </h2>
            <p className="section-desc" data-animate="fade-up" data-delay="200">
              Purpose-built interfaces for trusted institutions operating OTC desks and for participants seeking private
              execution. Six steps from request to atomic settlement — fully role-gated and audited end-to-end.
            </p>
          </div>
          <div className="product-cards">
            <div className="product-card" data-animate="fade-up" data-delay="300">
              <h3>For Host Institutions</h3>
              <p>
                Onboard approved traders with KYB. Manage quote desk operations, monitor escrow and settlement, and
                enforce compliance policies — all from a single command center.
              </p>
            </div>
            <div className="product-card" data-animate="fade-up" data-delay="400">
              <h3>For RFQ Creators</h3>
              <p>
                Submit structured RFQs, negotiate directly with approved traders, track escrow and settlement, and access
                private hosted markets without exposing trade intent to a public order book.
              </p>
            </div>
            <div className="product-card" data-animate="fade-up" data-delay="500">
              <h3>For Approved Traders</h3>
              <p>
                Respond with pricing and execution terms, manage active quotes, track collateral deposits, and clear
                trades through a Contra-managed escrow workflow — all from inside your host institution's desk.
              </p>
            </div>
          </div>

          <div className="vault-card" data-animate="fade-up" data-delay="300">
            <div className="vault-card-inner">
              <div className="vault-header">
                <div>
                  <h3 className="vault-name">Eligible Counterparty Framework</h3>
                  <p className="vault-subtitle">Granular Regulatory & Operational Controls</p>
                </div>
              </div>
              <div className="vault-divider" />
              <div className="vault-params">
                <div className="vault-param">
                  <div className="vault-param-label">FINMA</div>
                  <div className="vault-param-value">Swiss Banks ✓</div>
                </div>
                <div className="vault-param">
                  <div className="vault-param-label">EU MiCA</div>
                  <div className="vault-param-value">CASP Licensed ✓</div>
                </div>
                <div className="vault-param">
                  <div className="vault-param-label">UK FCA</div>
                  <div className="vault-param-value">AML/CTF Reg ✓</div>
                </div>
                <div className="vault-param">
                  <div className="vault-param-label">HK SFC</div>
                  <div className="vault-param-value">Type 1 / 7 ✓</div>
                </div>
              </div>
              <div className="vault-divider" />
              <div className="vault-metrics">
                <div className="vault-metric">
                  <div className="vault-metric-value">USDC · EUR · CHF</div>
                  <div className="vault-metric-label">Supported Stablecoins</div>
                </div>
                <div className="vault-metric">
                  <div className="vault-metric-value">Atomic</div>
                  <div className="vault-metric-label">Settlement</div>
                </div>
                <div className="vault-metric">
                  <div className="vault-metric-value">KYB</div>
                  <div className="vault-metric-label">Enforced at Onboarding</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="container">
          <div className="features-header">
            <p className="section-tag" data-animate="fade-up">
              Why ContraClear
            </p>
            <h2 className="section-title" data-animate="fade-up" data-delay="100">
              Infrastructure-Grade OTC
            </h2>
            <p className="section-desc" data-animate="fade-up" data-delay="200">
              Purpose-built for the requirements of institutional over-the-counter markets — private execution,
              all-or-nothing settlement, escrow-backed flows, operator control, and Solana-native liquidity. No public
              order books, no front-running, no shared infrastructure.
            </p>
          </div>
          <div className="features-stats" data-animate="fade-up" data-delay="300">
            <div className="feature-stat">
              <div className="feature-stat-value">
                <span className="counter" data-target="100">0</span>%
              </div>
              <div className="feature-stat-label">Self-Custody</div>
            </div>
            <div className="feature-stat">
              <div className="feature-stat-value">
                <span className="counter" data-target="0">0</span>
              </div>
              <div className="feature-stat-label">Counterparty Default Risk</div>
            </div>
            <div className="feature-stat">
              <div className="feature-stat-value">
                <span className="counter" data-target="6">0</span>
              </div>
              <div className="feature-stat-label">Step RFQ Workflow</div>
            </div>
            <div className="feature-stat">
              <div className="feature-stat-value">
                &lt;<span className="counter" data-target="1">0</span>s
              </div>
              <div className="feature-stat-label">Settlement Finality</div>
            </div>
          </div>

          <div className="cta-block" data-animate="fade-up">
            <div className="cta-bg">
              <video className="cta-video" autoPlay muted loop playsInline preload="auto">
                <source src="/hero.mp4" type="video/mp4" />
              </video>
              <div className="cta-video-overlay" />
            </div>
            <div className="cta-content">
              <h2>Execute Your First Private OTC Trade</h2>
              <p>
                Submit an RFQ, negotiate bilaterally, deposit into escrow, settle atomically on Solana. Trusted-institution-operated,
                KYB-enforced, audit-logged end-to-end.
              </p>
              <a href="#" className="btn btn-white btn-glow" onClick={goApp}>
                Launch App
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="powered-section">
        <div className="container">
          <div className="powered-card" data-animate="fade-up">
            <div className="powered-left">
              <h2 className="powered-title">Built on Solana</h2>
              <p className="powered-desc">
                ContraClear settles natively on Solana — high throughput, sub-second finality, low fees. No bridges, no
                wrapped synthetics, no off-chain settlement layer. Direct access to institutional-grade on-chain
                liquidity with the operational characteristics regulated desks require.
              </p>
              <a
                href="https://solana.com"
                target="_blank"
                rel="noreferrer"
                className="powered-btn"
              >
                Learn more <span className="powered-btn-arrow">→</span>
              </a>
            </div>
            <div className="powered-right">
              <div className="powered-globe">
                <div className="powered-globe-ring powered-globe-ring--1" />
                <div className="powered-globe-ring powered-globe-ring--2" />
                <div className="powered-globe-ring powered-globe-ring--3" />
                <img src="/contra-clear-logo.png" alt="ContraClear" className="powered-globe-logo" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="container">
          <div className="faq-layout">
            <div className="faq-header-col">
              <h2 className="faq-heading">
                Frequently Asked
                <br />
                Questions
              </h2>
              <figure className="faq-lore" data-animate="fade-up" data-delay="200">
                <span className="faq-lore-aurora" aria-hidden="true" />
                <span className="faq-lore-corner faq-lore-corner--tl" aria-hidden="true" />
                <span className="faq-lore-corner faq-lore-corner--tr" aria-hidden="true" />
                <span className="faq-lore-corner faq-lore-corner--bl" aria-hidden="true" />
                <span className="faq-lore-corner faq-lore-corner--br" aria-hidden="true" />
                <header className="faq-lore-header">
                  <span className="faq-lore-tag">
                    <svg className="faq-lore-glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M2 8 L14 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".9" />
                      <path d="M5 5 L11 11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".6" />
                      <circle cx="3" cy="8" r="1.2" fill="currentColor" opacity=".8" />
                      <circle cx="13" cy="8" r="1.2" fill="currentColor" opacity=".8" />
                    </svg>
                    Architecture · Institutional
                  </span>
                  <span className="faq-lore-rule" aria-hidden="true" />
                </header>
                <div>
                  <span className="faq-lore-quote" aria-hidden="true">"</span>
                  ContraClear is the OTC rail for institutions that need{' '}
                  <em className="faq-lore-accent">private execution</em>,{' '}
                  <em className="faq-lore-accent">atomic settlement</em>, and{' '}
                  <em className="faq-lore-accent">operator control</em> — without trusting a shared exchange, without
                  exposing flow to a public order book, and without surrendering custody to a counterparty.
                </div>
              </figure>
            </div>
            <div className="faq-list-col">
              {FAQ_ITEMS.map((f, i) => (
                <div className="faq-item" key={i}>
                  <button className="faq-question" aria-expanded="false">
                    <span className="faq-toggle" />
                    <h3>{f.q}</h3>
                  </button>
                  <div className="faq-answer">
                    <p>{f.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="newsletter-section">
        <div className="container">
          <div className="newsletter-block">
            <div className="newsletter-text">
              <p className="newsletter-tagline">
                Onboard your institution. Operate a private OTC desk on Solana.
              </p>
            </div>
            <form
              className="newsletter-form"
              onSubmit={(e) => {
                e.preventDefault();
                const btn = (e.target as HTMLFormElement).querySelector('.newsletter-btn') as HTMLButtonElement;
                btn.textContent = 'Subscribed ✓';
                btn.style.background = '#22c55e';
                setTimeout(() => {
                  btn.textContent = 'Notify Me →';
                  btn.style.background = '';
                }, 3000);
              }}
            >
              <p className="newsletter-form-label">Work email</p>
              <div className="newsletter-input-row">
                <input type="email" placeholder="you@institution.com" required />
                <button type="submit" className="newsletter-btn">
                  Notify Me →
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-left">
              <a href="#" className="logo" onClick={scrollToId('top')}>
                <Logo />
              </a>
              <p className="footer-desc">
                Trusted-institution-operated OTC infrastructure on Solana. Private bilateral negotiation, escrow-backed
                collateral, atomic settlement, KYB-enforced access, and a full audit trail.
              </p>
            </div>
            <div className="footer-right">
              <div className="footer-col">
                <p className="footer-col-title">Platform</p>
                <ul>
                  <li>
                    <a href="#overview" onClick={scrollToId('overview')}>Overview</a>
                  </li>
                  <li>
                    <a href="#product" onClick={scrollToId('product')}>Product</a>
                  </li>
                  <li>
                    <a href="#features" onClick={scrollToId('features')}>Features</a>
                  </li>
                  <li>
                    <a href="#faq" onClick={scrollToId('faq')}>FAQ</a>
                  </li>
                </ul>
              </div>
              <div className="footer-col">
                <p className="footer-col-title">Workflow</p>
                <ul>
                  <li>
                    <a href="#" onClick={goApp}>Launch App</a>
                  </li>
                  <li>
                    <a href="mailto:hello@fairway.global">Contact Sales</a>
                  </li>
                </ul>
              </div>
              <div className="footer-col">
                <p className="footer-col-title">Company</p>
                <ul>
                  <li>
                    <a href="https://fairway.global" target="_blank" rel="noreferrer">Fairway Global</a>
                  </li>
                  <li>
                    <a href="#">Privacy</a>
                  </li>
                  <li>
                    <a href="#">Terms</a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 ContraClear · Fairway Global. Institutional OTC infrastructure on Solana.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
