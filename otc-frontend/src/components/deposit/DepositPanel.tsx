import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { buildDepositTx, confirmDeposit } from '../../lib/api';
import {
  SOLANA_VALIDATOR_URL,
  formatUiAmount,
  getTokenName,
  getTokenInfo,
  getTokenSymbol,
  getTokensForMints,
  toRawAmount,
  truncateAddress,
  getSolscanTxUrl,
} from '../../lib/constants';
import Panel from '../layout/Panel';
import TokenIcon from '../ui/TokenIcon';
import { useBalances } from '../../hooks/useBalances';

function getFriendlyDepositError(message: string, tokenLabel: string): string {
  if (message.includes('has no token account for mint')) {
    return `Your wallet does not have a ${tokenLabel} token account on Solana devnet yet. Import the token in your wallet and receive some ${tokenLabel} first, then retry the deposit.`;
  }

  if (message.includes('is not allowed on escrow instance')) {
    return `${tokenLabel} is not enabled on the current escrow instance yet. Ask the Contra admin to allow this mint before retrying.`;
  }

  return message || 'Deposit failed';
}

export default function DepositPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { onChainBalances, refresh, adjustBalance } = useBalances();
  const [selectedMint, setSelectedMint] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'credited'>('idle');

  const validTokens = getTokensForMints(onChainBalances.map(balance => balance.mint));
  const selectedBalance = onChainBalances.find(b => b.mint === selectedMint);
  const selectedToken = getTokenInfo(selectedMint);
  const tokenLabel = selectedToken?.symbol || getTokenSymbol(selectedMint);
  const missingTokenAccount = Boolean(publicKey && selectedMint && !selectedBalance);

  useEffect(() => {
    if (!validTokens.length) {
      setSelectedMint('');
      return;
    }

    if (!selectedMint || !validTokens.some(token => token.mint === selectedMint)) {
      setSelectedMint(validTokens[0].mint);
    }
  }, [selectedMint, validTokens]);

  const handleDeposit = async () => {
    if (!publicKey || !signTransaction || !selectedMint || !amount || missingTokenAccount) return;

    // Capture values before any state changes
    const mintForTx = selectedMint;
    const rawAmount = toRawAmount(amount, selectedMint);
    const deltaRaw = BigInt(rawAmount);

    try {
      setStatus('building');
      const { transaction: txBase64 } = await buildDepositTx(publicKey.toString(), mintForTx, rawAmount);

      setStatus('signing');
      const txBuffer = Buffer.from(txBase64, 'base64');
      const tx = Transaction.from(txBuffer);
      const signed = await signTransaction(tx);

      setStatus('confirming');
      const connection = new Connection(SOLANA_VALIDATOR_URL, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      await confirmDeposit(publicKey.toString(), mintForTx, rawAmount, sig);

      // Optimistic: immediately update displayed balances
      adjustBalance('onChain', mintForTx, -deltaRaw);
      adjustBalance('channel', mintForTx, deltaRaw);

      setStatus('credited');
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-2xl shadow-terminal-accent/10`}
          style={{ background: 'linear-gradient(135deg, #0d2818 0%, #111111 50%, #0a1628 100%)', border: '1px solid rgba(0, 255, 209, 0.25)' }}
        >
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-terminal-green/20">
                <svg className="h-4 w-4 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <div className="font-mono text-sm font-bold text-terminal-green">Deposit Confirmed</div>
                <div className="font-mono text-[11px] text-terminal-dim">Tokens locked in escrow. Press Refresh to see updated balances.</div>
              </div>
            </div>
            <a
              href={getSolscanTxUrl(sig)}
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
      ), { duration: 6000, position: 'bottom-right' });
      setAmount('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Deposit failed:', err);
      toast.error(getFriendlyDepositError(err.message || '', tokenLabel));
      setStatus('idle');
    }
  };

  const statusSteps = [
    { key: 'building', label: 'Building transaction' },
    { key: 'signing', label: 'Awaiting signature' },
    { key: 'confirming', label: 'Confirming on-chain' },
    { key: 'credited', label: 'Credited to channel' },
  ];

  return (
    <Panel title="Deposit to Channel">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Token</label>
          <div className="flex items-center gap-2">
            {selectedMint && <TokenIcon mint={selectedMint} size={24} />}
            <select
              className="select-field flex-1"
              value={selectedMint}
              onChange={e => setSelectedMint(e.target.value)}
              disabled={!validTokens.length}
            >
              {validTokens.length === 0 ? (
                <option value="">No wallet SPL tokens found</option>
              ) : (
                validTokens.map(t => (
                  <option key={t.mint} value={t.mint}>{t.symbol} - {getTokenName(t.mint)}</option>
                ))
              )}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Amount ({tokenLabel || 'Token'})</label>
          <div className="relative">
            <input
              type="number"
              className="input-field pr-16"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            {selectedBalance && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-terminal-accent hover:brightness-110"
                onClick={() => setAmount(selectedBalance.uiAmount.toString())}
              >
                MAX
              </button>
            )}
          </div>
          {selectedBalance && (
            <div className="text-xs font-mono text-terminal-dim mt-1">
              Available: {formatUiAmount(selectedBalance.uiAmount)} {tokenLabel}
            </div>
          )}
          {missingTokenAccount && (
            <div className="mt-3 rounded border border-yellow-700/60 bg-yellow-950/20 p-3 text-xs font-mono text-yellow-200">
              <div className="font-semibold uppercase tracking-wide text-yellow-300">Token account required</div>
              <div className="mt-2">
                This wallet does not have a {tokenLabel} token account on Solana devnet yet.
              </div>
              <div className="mt-2">
                Mint: {selectedMint}
              </div>
              <div className="mt-2">
                Switch your wallet to devnet, import this token mint, then receive some {tokenLabel} to create the token account.
              </div>
              <div className="mt-2">
                Wallet: {truncateAddress(publicKey!.toString(), 6)}
              </div>
            </div>
          )}
          {!validTokens.length && (
            <div className="mt-3 rounded border border-terminal-border bg-terminal-muted/20 p-3 text-xs font-mono text-terminal-dim">
              No SPL token balances found in this wallet on Solana yet. Receive a token first, then it will appear here for deposit.
            </div>
          )}
        </div>

        <button
          className="btn-primary w-full"
          disabled={!publicKey || !amount || status !== 'idle' || missingTokenAccount || !selectedMint}
          onClick={handleDeposit}
        >
          {status === 'idle'
            ? missingTokenAccount
              ? 'Create Token Account First'
              : 'Deposit to Channel'
            : 'Processing...'}
        </button>

        {status !== 'idle' && (
          <div className="mt-4 space-y-2">
            {statusSteps.map((step, i) => {
              const stepIndex = statusSteps.findIndex(s => s.key === status);
              const isActive = i === stepIndex;
              const isDone = i < stepIndex;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    isDone ? 'bg-terminal-green' : isActive ? 'bg-terminal-accent animate-pulse' : 'bg-terminal-muted'
                  }`} />
                  <span className={`font-mono text-xs ${
                    isDone ? 'text-terminal-green' : isActive ? 'text-terminal-accent' : 'text-terminal-dim'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
