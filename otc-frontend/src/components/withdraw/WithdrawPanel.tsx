import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import toast from 'react-hot-toast';
import { buildWithdrawTx, confirmWithdrawal } from '../../lib/api';
import {
  SOLANA_VALIDATOR_URL,
  formatUiAmount,
  getTokenName,
  getTokenSymbol,
  getTokensForMints,
  getSolscanTxUrl,
  toRawAmount,
} from '../../lib/constants';
import Panel from '../layout/Panel';
import { useBalances } from '../../hooks/useBalances';
import { useDeposits } from '../../hooks/useDeposits';

export default function WithdrawPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { channelBalances, onChainBalances, refresh, adjustBalance } = useBalances();
  const { deposits } = useDeposits();
  const [selectedMint, setSelectedMint] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'done'>('idle');

  const confirmingDepositMints = deposits
    .filter(d => d.status === 'confirming')
    .map(d => d.tokenMint);
  const validTokens = getTokensForMints([
    ...channelBalances.map(balance => balance.mint),
    ...onChainBalances.map(balance => balance.mint),
    ...confirmingDepositMints,
  ]);
  const selectedBalance = channelBalances.find(b => b.mint === selectedMint);
  const selectedOnChainBalance = onChainBalances.find(b => b.mint === selectedMint);
  const confirmingDeposit = deposits.find(d => d.tokenMint === selectedMint && d.status === 'confirming');

  useEffect(() => {
    if (!validTokens.length) {
      setSelectedMint('');
      return;
    }

    if (!selectedMint || !validTokens.some(token => token.mint === selectedMint)) {
      setSelectedMint(validTokens[0].mint);
    }
  }, [selectedMint, validTokens]);

  const handleWithdraw = async () => {
    if (!publicKey || !signTransaction || !selectedMint || !amount) return;

    const mintForTx = selectedMint;
    const rawAmount = toRawAmount(amount, selectedMint);
    const deltaRaw = BigInt(rawAmount);

    try {
      setStatus('building');

      // Snapshot: get the latest tx on the user's ATA BEFORE the burn
      // so we can detect the operator's new ReleaseFunds tx after
      const ata = await getAssociatedTokenAddress(new PublicKey(mintForTx), publicKey, false, TOKEN_PROGRAM_ID);
      let lastKnownSig: string | null = null;
      try {
        const r = await fetch(SOLANA_VALIDATOR_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [ata.toString(), { limit: 1 }] }),
        });
        const d = await r.json();
        lastKnownSig = d.result?.[0]?.signature || null;
      } catch {}

      const { withdrawalId, transaction: txBase64 } = await buildWithdrawTx(
        publicKey.toString(), mintForTx, rawAmount
      );

      setStatus('signing');
      const tx = Transaction.from(Buffer.from(txBase64, 'base64'));
      const signed = await signTransaction(tx);

      setStatus('confirming');
      const gatewayUrl = import.meta.env.VITE_CONTRA_GATEWAY_URL;
      const connection = new Connection(gatewayUrl, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());

      await confirmWithdrawal(withdrawalId, sig);

      // Don't update balances yet — wait for the on-chain release to be detected
      setStatus('done');
      setAmount('');

      // Show pending toast, poll for operator's release, THEN update balances
      const toastId = toast.custom((t) => (
        <WithdrawToast visible={t.visible} stage="pending" onDismiss={() => toast.dismiss(t.id)} />
      ), { duration: 10000, position: 'bottom-right' });

      (async () => {
        const ataStr = ata.toString();
        const delays = [1000, 1000, 1500, 1500, 2000, 2000, 2000, 3000, 3000, 3000, 4000, 4000, 5000, 5000, 5000];
        for (let i = 0; i < delays.length; i++) {
          await new Promise(r => setTimeout(r, delays[i]));
          try {
            const r = await fetch(SOLANA_VALIDATOR_URL, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [ataStr, { limit: 1 }] }),
            });
            const d = await r.json();
            const latest = d.result?.[0];
            if (latest && !latest.err && latest.signature !== lastKnownSig) {
              // Release detected — NOW update balances + show Solscan link
              toast.dismiss(toastId);
              const releaseToastId = `release-${Date.now()}`;
              toast.custom((t) => (
                <WithdrawToast visible={t.visible} stage="released" releaseTxSig={latest.signature} onDismiss={() => toast.dismiss(releaseToastId)} />
              ), { id: releaseToastId, duration: 5000, position: 'bottom-right' });
              refresh();
              return;
            }
          } catch {}
        }
        // Timeout — refresh anyway
        toast.dismiss(toastId);
        refresh();
      })();

      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Withdrawal failed:', err);
      toast.error(err.message || 'Withdrawal failed');
      setStatus('idle');
    }
  };

  return (
    <Panel title="Withdraw from Channel">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Token</label>
          <select
            className="select-field"
            value={selectedMint}
            onChange={e => setSelectedMint(e.target.value)}
            disabled={!validTokens.length}
          >
            {validTokens.length === 0 ? (
              <option value="">No channel SPL tokens found</option>
            ) : (
              validTokens.map(t => (
                <option key={t.mint} value={t.mint}>{t.symbol} - {getTokenName(t.mint)}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Amount ({getTokenSymbol(selectedMint) || 'Token'})</label>
          <div className="relative">
            <input type="number" className="input-field pr-16" placeholder="0.00" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            {selectedBalance && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-terminal-accent hover:brightness-110" onClick={() => setAmount(selectedBalance.uiAmount.toString())}>
                MAX
              </button>
            )}
          </div>
          {selectedBalance && (
            <div className="text-xs font-mono text-terminal-dim mt-1">
              Available on Contra: {formatUiAmount(selectedBalance.uiAmount)} {getTokenSymbol(selectedMint)}
            </div>
          )}
          {!selectedBalance && selectedMint && (
            <div className="text-xs font-mono text-terminal-dim mt-1">
              Available on Contra: 0.00 {getTokenSymbol(selectedMint)}
            </div>
          )}
          {selectedOnChainBalance && (
            <div className="text-xs font-mono text-terminal-dim mt-1">
              Available on wallet: {formatUiAmount(selectedOnChainBalance.uiAmount)} {getTokenSymbol(selectedMint)}
            </div>
          )}
          {!selectedBalance && confirmingDeposit && (
            <div className="text-xs font-mono text-terminal-amber mt-1">
              Deposit detected on Solana. Waiting for Contra channel credit before withdrawal is available.
            </div>
          )}
          {!validTokens.length && (
            <div className="text-xs font-mono text-terminal-dim mt-1">
              No channel SPL balances found yet.
            </div>
          )}
        </div>

        <button className="btn-primary w-full" disabled={!publicKey || !amount || status !== 'idle' || !selectedBalance} onClick={handleWithdraw}>
          {status === 'idle' ? 'Withdraw to Wallet' : status === 'signing' ? 'Sign in wallet...' : 'Processing...'}
        </button>

        {status !== 'idle' && (
          <div className="space-y-2">
            {[
              { key: 'building', label: 'Building burn transaction' },
              { key: 'signing', label: 'Sign in your wallet' },
              { key: 'confirming', label: 'Burning tokens on channel' },
              { key: 'done', label: 'Confirmed - operator releasing from escrow' },
            ].map((step, i) => {
              const steps = ['building', 'signing', 'confirming', 'done'];
              const si = steps.indexOf(status);
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${i < si ? 'bg-terminal-green' : i === si ? 'bg-terminal-accent animate-pulse' : 'bg-terminal-muted'}`} />
                  <span className={`font-mono text-xs ${i < si ? 'text-terminal-green' : i === si ? 'text-terminal-accent' : 'text-terminal-dim'}`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

function WithdrawToast({ visible, stage, releaseTxSig, onDismiss }: { visible: boolean; stage: 'pending' | 'released'; releaseTxSig?: string; onDismiss?: () => void }) {
  const isPending = stage === 'pending';
  return (
    <div
      className={`${visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-2xl shadow-terminal-accent/10`}
      style={{ background: 'linear-gradient(135deg, #1a0d28 0%, #111111 50%, #0a1628 100%)', border: `1px solid ${isPending ? 'rgba(0, 255, 209, 0.25)' : 'rgba(57, 255, 20, 0.3)'}` }}
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isPending ? 'bg-terminal-accent/20' : 'bg-terminal-green/20'}`}>
            {isPending ? (
              <div className="h-3 w-3 rounded-full bg-terminal-accent animate-pulse" />
            ) : (
              <svg className="h-4 w-4 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            )}
          </div>
          <div>
            <div className={`font-mono text-sm font-bold ${isPending ? 'text-terminal-accent' : 'text-terminal-green'}`}>
              {isPending ? 'Withdrawal Processing' : 'Funds Released'}
            </div>
            <div className="font-mono text-[11px] text-terminal-dim">
              {isPending ? 'Channel burn confirmed. Waiting for escrow release...' : 'Tokens released from escrow to your wallet'}
            </div>
          </div>
        </div>
        {releaseTxSig && (
          <a
            href={getSolscanTxUrl(releaseTxSig)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onDismiss?.()}
            className="flex items-center justify-center gap-2 rounded-md bg-terminal-green/10 px-4 py-2 font-mono text-xs font-semibold text-terminal-green transition-all hover:bg-terminal-green/20"
          >
            View on Solscan
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        )}
        {isPending && (
          <div className="flex items-center justify-center gap-2 rounded-md bg-terminal-muted/30 px-4 py-2 font-mono text-[11px] text-terminal-dim">
            <div className="h-1.5 w-1.5 rounded-full bg-terminal-accent animate-pulse" />
            Detecting operator release transaction...
          </div>
        )}
      </div>
    </div>
  );
}
