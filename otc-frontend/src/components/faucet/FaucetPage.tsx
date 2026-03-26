import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import toast from 'react-hot-toast';
import Panel from '../layout/Panel';
import { getSolscanTxUrl } from '../../lib/constants';

const TOKENS = [
  { symbol: 'USDC', name: 'USD Coin', mint: '5L9sUJJHL73YjaJ66MSD1BtNqZo1pgidPtcNKBvVdQ2J', flag: '🇺🇸', color: '#2775CA' },
  { symbol: 'USDT', name: 'Tether USD', mint: '7mqJuABCcbrk4UYJJtE4d3GZwR5n2a8BpaSURCq752hu', flag: '🇺🇸', color: '#50AF95' },
  { symbol: 'EURC', name: 'Euro Coin', mint: '42k8yVzBkueqEf1cPPhVHxipvUufg5Z9PpV3DRZJxq1h', flag: '🇪🇺', color: '#2F73DA' },
  { symbol: 'PYUSD', name: 'PayPal USD', mint: '7D3ePHxhAzg1RAoCXwNLvCsgPo91NiVwE2BVm1vX9Loi', flag: '🇺🇸', color: '#003087' },
  { symbol: 'USDG', name: 'Global Dollar', mint: 'azTaDSr4bbhqsxFao8jUH2yz52r1sy5ihKu4XHHBkoE', flag: '🌐', color: '#1A1A2E' },
  { symbol: 'USX', name: 'USX Stablecoin', mint: '7UAwp1VTSJyhuhHF3DQifyebNey9DnCcyADcvmkky4pC', flag: '🇺🇸', color: '#6366F1' },
  { symbol: 'CHF', name: 'Swiss Franc', mint: '8sKLVxMHswSVUXwR5sPox8cR4f88z49WtvmYY6J1URGd', flag: '🇨🇭', color: '#D52B1E' },
  { symbol: 'GBP', name: 'British Pound', mint: '2CMNySecfv9V9kA7LS2VsWzvTv7Kp35Y3jXKGKTH6qv3', flag: '🇬🇧', color: '#012169' },
  { symbol: 'JPY', name: 'Japanese Yen', mint: 'FnTA78B6wp9i3tZG3NxFXZdd85rQtqzHEwpmwWkbx8PB', flag: '🇯🇵', color: '#BC002D' },
  { symbol: 'SGD', name: 'Singapore Dollar', mint: 'DnDP4L3mEztefrhq1UedBkGbnhzmeKLxqJ7AYtiawL4f', flag: '🇸🇬', color: '#EF3340' },
  { symbol: 'AED', name: 'UAE Dirham', mint: 'BSCwHCEkNUAgW3uXWEnrgNH2NsSqhiwgmd9dVQLkbshC', flag: '🇦🇪', color: '#00732F' },
];

export default function FaucetPage() {
  const { publicKey } = useWallet();
  const [selectedMint, setSelectedMint] = useState(TOKENS[0].mint);
  const [amount, setAmount] = useState('100');
  const [minting, setMinting] = useState(false);

  const selectedToken = TOKENS.find(t => t.mint === selectedMint)!;

  const handleMint = async () => {
    if (!publicKey || !selectedMint || !amount) return;
    setMinting(true);
    try {
      const res = await fetch('/api/faucet/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          mint: selectedMint,
          amount: Number(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-2xl shadow-terminal-accent/10`}
          style={{ background: 'linear-gradient(135deg, #0d2818 0%, #111111 50%, #0a1628 100%)', border: '1px solid rgba(0, 255, 209, 0.25)' }}
        >
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-terminal-green/20 text-lg">
                {selectedToken.flag}
              </div>
              <div>
                <div className="font-mono text-sm font-bold text-terminal-green">Minted {data.amount} {data.token}</div>
                <div className="font-mono text-[11px] text-terminal-dim">Tokens sent to your wallet on Solana Devnet</div>
              </div>
            </div>
            <a
              href={getSolscanTxUrl(data.signature)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => toast.dismiss(t.id)}
              className="flex items-center justify-center gap-2 rounded-md bg-terminal-accent/10 px-4 py-2 font-mono text-xs font-semibold text-terminal-accent transition-all hover:bg-terminal-accent/20"
            >
              View on Solscan
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        </div>
      ), { duration: 8000, position: 'bottom-right' });
    } catch (err: any) {
      toast.error(err.message || 'Mint failed');
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Panel title="Token Faucet">
        <div className="space-y-6">
          <p className="font-mono text-xs text-terminal-dim">
            Mint devnet stablecoins to your wallet for testing. Max 1,000 tokens per request.
          </p>

          {!publicKey ? (
            <div className="rounded border border-terminal-border bg-terminal-bg p-8 text-center">
              <p className="font-mono text-sm text-terminal-dim mb-4">Connect your wallet to mint tokens</p>
              <div className="flex justify-center"><WalletMultiButton /></div>
            </div>
          ) : (
            <>
              {/* Token grid */}
              <div>
                <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Select Token</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {TOKENS.map(t => (
                    <button
                      key={t.mint}
                      type="button"
                      onClick={() => setSelectedMint(t.mint)}
                      className={`rounded border p-3 text-left transition-all ${
                        selectedMint === t.mint
                          ? 'border-terminal-accent bg-terminal-accent/10 shadow-lg shadow-terminal-accent/5'
                          : 'border-terminal-border bg-terminal-bg hover:border-terminal-accent/40 hover:bg-terminal-muted/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-base shrink-0"
                          style={{ background: `${t.color}20`, border: `1px solid ${t.color}40` }}
                        >
                          {t.flag}
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold text-terminal-text">{t.symbol}</div>
                          <div className="font-mono text-[9px] text-terminal-dim truncate">{t.name}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected token + amount */}
              <div className="rounded border border-terminal-accent/20 bg-terminal-accent/5 p-4">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-2xl shrink-0"
                    style={{ background: `${selectedToken.color}25`, border: `2px solid ${selectedToken.color}50` }}
                  >
                    {selectedToken.flag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-lg font-bold text-terminal-text">{selectedToken.symbol}</div>
                    <div className="font-mono text-xs text-terminal-dim">{selectedToken.name}</div>
                  </div>
                  <div className="shrink-0 w-32">
                    <input
                      type="number"
                      className="input-field text-right text-lg font-bold"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min="1"
                      max="1000"
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>

              {/* Wallet */}
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Recipient Wallet</label>
                <input className="input-field text-terminal-dim text-xs" value={publicKey.toString()} readOnly />
              </div>

              {/* Mint button */}
              <button
                type="button"
                className="btn-primary w-full py-3 text-base"
                disabled={minting || !amount || Number(amount) <= 0 || Number(amount) > 1000}
                onClick={() => void handleMint()}
              >
                {minting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-terminal-bg border-t-transparent animate-spin" />
                    Minting...
                  </span>
                ) : (
                  `Mint ${amount || '0'} ${selectedToken.symbol}`
                )}
              </button>

              {/* Info */}
              <div className="rounded border border-terminal-border bg-terminal-bg p-3 font-mono text-[10px] text-terminal-dim text-center">
                Token-2022 stablecoins on Solana Devnet. After minting, deposit to Contra channel via the Deposit tab to start trading.
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
