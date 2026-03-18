import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useContraHealth } from '../../hooks/useContra';
import { truncateAddress } from '../../lib/constants';

interface HeaderProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Header({ activeView, onViewChange }: HeaderProps) {
  const { publicKey } = useWallet();
  const { connected: contraConnected, slot } = useContraHealth();

  const navItems = [
    { id: 'dashboard', label: 'Portfolio' },
    { id: 'trade', label: 'Trade' },
    { id: 'deposit', label: 'Deposit' },
    { id: 'withdraw', label: 'Withdraw' },
    { id: 'admin', label: 'Admin' },
  ];

  return (
    <header className="border-b border-terminal-border bg-terminal-surface">
      <div className="flex items-center justify-between px-6 h-14">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-terminal-accent animate-pulse" />
            <span className="font-mono text-sm font-bold tracking-wider text-terminal-accent">
              CONTRA OTC
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`px-3 py-1.5 font-mono text-xs rounded transition-colors ${
                  activeView === item.id
                    ? 'bg-terminal-accent/10 text-terminal-accent'
                    : 'text-terminal-dim hover:text-terminal-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Contra status */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className={`w-1.5 h-1.5 rounded-full ${contraConnected ? 'bg-terminal-green' : 'bg-terminal-red'}`} />
            <span className="text-terminal-dim">
              {contraConnected ? `Slot ${slot.toLocaleString()}` : 'Disconnected'}
            </span>
          </div>

          {/* Connected wallet */}
          {publicKey && (
            <div className="font-mono text-xs text-terminal-dim px-2 py-1 bg-terminal-bg rounded border border-terminal-border">
              {truncateAddress(publicKey.toString())}
            </div>
          )}

          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
