import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { buildWithdrawTx, confirmWithdrawal } from '../../lib/api';
import {
  formatUiAmount,
  getTokenName,
  getTokenSymbol,
  getTokensForMints,
  toRawAmount,
} from '../../lib/constants';
import Panel from '../layout/Panel';
import { useBalances } from '../../hooks/useBalances';
import { useDeposits } from '../../hooks/useDeposits';

export default function WithdrawPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { channelBalances, onChainBalances, refresh } = useBalances();
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

    try {
      setStatus('building');
      const rawAmount = toRawAmount(amount, selectedMint);
      const { withdrawalId, transaction: txBase64 } = await buildWithdrawTx(
        publicKey.toString(), selectedMint, rawAmount
      );

      setStatus('signing');
      const tx = Transaction.from(Buffer.from(txBase64, 'base64'));
      const signed = await signTransaction(tx);

      setStatus('confirming');
      // Send burn to Contra gateway
      const gatewayUrl = import.meta.env.VITE_CONTRA_GATEWAY_URL;
      const connection = new Connection(gatewayUrl, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());

      await confirmWithdrawal(withdrawalId, sig);

      setStatus('done');
      toast.success('Withdrawal confirmed! Tokens burned on channel.');
      setAmount('');
      // Wait for channel to settle before refreshing
      setTimeout(() => refresh(), 2000);
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
