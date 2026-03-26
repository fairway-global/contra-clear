import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function WalletConnect() {
  const { publicKey } = useWallet();

  if (publicKey) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-terminal-accent animate-pulse" />
          <h1 className="font-mono text-2xl font-bold tracking-wider text-terminal-accent">CONTRA OTC</h1>
        </div>
        <p className="font-mono text-sm text-terminal-dim max-w-md">
          Private OTC spot trading desk built on Contra — trusted-institution execution infrastructure for Solana.
        </p>
        <p className="font-mono text-xs text-terminal-dim">
          Connect your wallet to start trading.
        </p>
      </div>
      <WalletMultiButton />
      <div className="grid grid-cols-3 gap-8 mt-12 text-center">
        {[
          { label: 'Settlement', value: '~100ms' },
          { label: 'Transaction Fees', value: 'Zero' },
          { label: 'Privacy', value: 'Full' },
        ].map(s => (
          <div key={s.label}>
            <div className="font-mono text-lg font-bold text-terminal-accent">{s.value}</div>
            <div className="font-mono text-xs text-terminal-dim mt-1 uppercase">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
