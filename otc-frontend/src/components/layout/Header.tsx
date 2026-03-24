import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useContraHealth } from '../../hooks/useContra';
import { truncateAddress } from '../../lib/constants';
import type { User } from '../../lib/otc/types';
import { USER_ROLE_LABELS, UserRole } from '../../lib/otc/types';

interface HeaderProps {
  activePath: string;
  currentUser: User | null;
  onNavigate: (path: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

function isActivePath(activePath: string, targetPath: string): boolean {
  if (targetPath === '/') {
    return activePath === '/';
  }
  return activePath === targetPath || activePath.startsWith(`${targetPath}/`);
}

export default function Header({
  activePath,
  currentUser,
  onNavigate,
  onOpenLogin,
  onLogout,
}: HeaderProps) {
  const { publicKey } = useWallet();
  const { connected: contraConnected, slot } = useContraHealth();
  const showWalletControls = Boolean(currentUser);
  const homePath = currentUser
    ? currentUser.role === UserRole.ADMIN
      ? '/admin/otc'
      : '/otc/rfqs'
    : '/';

  const navItems = currentUser?.role === UserRole.ADMIN
    ? [
        { path: '/admin/otc', label: 'Activities' },
        { path: '/admin/rfqs', label: 'RFQs' },
        { path: '/admin/users', label: 'Users' },
        { path: '/admin/settlements', label: 'Settlements' },
        { path: '/admin/escrow', label: 'Escrow' },
      ]
    : currentUser
      ? [
          { path: '/otc/rfqs', label: 'RFQ' },
          { path: '/otc/escrow', label: 'Escrow' },
          { path: '/otc/settlements', label: 'Settlement' },
          { path: '/deposit', label: 'Deposit' },
          { path: '/withdraw', label: 'Withdraw' },
        ]
      : [
          { path: '/', label: 'Overview' },
          { path: '/login', label: 'Sign In' },
          { path: '/signup', label: 'Sign Up' },
        ];

  return (
    <header className="border-b border-terminal-border bg-terminal-surface">
      <div className="flex min-h-14 flex-col gap-3 px-6 py-3 xl:flex-row xl:items-center xl:justify-between xl:py-0">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-6">
          <button type="button" className="flex items-center gap-2 text-left" onClick={() => onNavigate(homePath)}>
            <div className="h-2 w-2 rounded-full bg-terminal-accent animate-pulse" />
            <span className="font-mono text-sm font-bold tracking-wider text-terminal-accent">
              CONTRA CLEAR
            </span>
          </button>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                  isActivePath(activePath, item.path)
                    ? 'bg-terminal-accent/10 text-terminal-accent'
                    : 'text-terminal-dim hover:text-terminal-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className={`h-1.5 w-1.5 rounded-full ${contraConnected ? 'bg-terminal-green' : 'bg-terminal-red'}`} />
            <span className="text-terminal-dim">
              {contraConnected ? `Slot ${slot.toLocaleString()}` : 'Disconnected'}
            </span>
          </div>

          {currentUser ? (
            <>
              <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 font-mono text-xs text-terminal-text">
                {currentUser.fullName}
              </div>
              <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 font-mono text-xs text-terminal-dim">
                {USER_ROLE_LABELS[currentUser.role]}
              </div>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={onOpenLogin}>
              Ready To Start
            </button>
          )}

          {showWalletControls && publicKey ? (
            <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 font-mono text-xs text-terminal-dim">
              {truncateAddress(publicKey.toString())}
            </div>
          ) : null}

          {showWalletControls ? <WalletMultiButton /> : null}
        </div>
      </div>
    </header>
  );
}
