import type { ReactNode } from 'react';
import type { AuthProfile, UserRole } from '../../types/platform';
import { initials } from '../../lib/platformFormat';

interface AppShellProps {
  profile: AuthProfile;
  activePath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onResetDemoData: () => void;
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', roles: ['BANK', 'INSTITUTION'] },
  { label: 'RFQs', path: '/rfqs', roles: ['BANK', 'INSTITUTION'] },
  { label: 'Institutions', path: '/institutions', roles: ['BANK'] },
  { label: 'Users', path: '/users', roles: ['BANK'] },
  { label: 'Escrow', path: '/escrow', roles: ['BANK', 'INSTITUTION'] },
  { label: 'Settlements', path: '/settlements', roles: ['BANK', 'INSTITUTION'] },
];

export default function AppShell({
  profile,
  activePath,
  onNavigate,
  onLogout,
  onResetDemoData,
  children,
}: AppShellProps) {
  const visibleNav = navItems.filter((item) => item.roles.includes(profile.user.role));

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-terminal-border bg-terminal-surface/95 px-5 py-6">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="flex w-full items-center gap-3 rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terminal-accent/10 font-mono text-sm font-semibold text-terminal-accent">
              {initials(profile.tenant.bankName)}
            </div>
            <div>
              <div className="font-mono text-sm font-semibold tracking-wide text-terminal-accent">
                {profile.tenant.bankName}
              </div>
              <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">
                Bank-operated OTC
              </div>
            </div>
          </button>

          <div className="mt-6 rounded-lg border border-terminal-border bg-terminal-bg px-4 py-3">
            <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Signed In</div>
            <div className="mt-2 text-sm font-semibold">{profile.user.fullName}</div>
            <div className="mt-1 font-mono text-xs text-terminal-dim">{profile.user.email}</div>
            <div className="mt-3 inline-flex rounded-full bg-terminal-accent/10 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-terminal-accent">
              {profile.user.role}
            </div>
            <div className="mt-2 font-mono text-xs text-terminal-dim">{profile.organization.name}</div>
          </div>

          <nav className="mt-6 space-y-1">
            {visibleNav.map((item) => {
              const active = activePath === item.path || activePath.startsWith(`${item.path}/`);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-mono text-sm transition-colors ${
                    active
                      ? 'bg-terminal-accent/10 text-terminal-accent'
                      : 'text-terminal-dim hover:bg-terminal-muted/30 hover:text-terminal-text'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] uppercase tracking-widest">
                    {item.roles.includes('BANK') && item.roles.includes('INSTITUTION') ? 'ALL' : item.roles[0]}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 space-y-2">
            <button type="button" onClick={onResetDemoData} className="btn-secondary w-full">
              Reset Demo Data
            </button>
            <button type="button" onClick={onLogout} className="btn-primary w-full">
              Sign Out
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="border-b border-terminal-border bg-terminal-surface/80 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.25em] text-terminal-dim">
                  {profile.user.role === 'BANK' ? 'Bank Command Center' : 'Institution Workspace'}
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  {profile.user.role === 'BANK'
                    ? 'Private bilateral OTC execution'
                    : 'Private RFQ workflow with your bank'}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-terminal-dim">
                <span className="rounded-full border border-terminal-border px-3 py-1">
                  Tenant: {profile.tenant.bankName}
                </span>
                <span className="rounded-full border border-terminal-border px-3 py-1">
                  Assets: {profile.tenant.allowedAssets.join(', ')}
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
