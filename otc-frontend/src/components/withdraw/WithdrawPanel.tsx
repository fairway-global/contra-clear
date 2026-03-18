import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { buildWithdrawTx, confirmWithdrawal } from '../../lib/api';
import { DEMO_TOKENS, CONTRA_GATEWAY_URL, getTokenSymbol } from '../../lib/constants';
import Panel from '../layout/Panel';
import { useBalances } from '../../hooks/useBalances';

export default function WithdrawPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { channelBalances, refresh } = useBalances();
  const [selectedMint, setSelectedMint] = useState(DEMO_TOKENS[0]?.mint || '');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'building' | 'signing' | 'processing' | 'confirmed'>('idle');

  const validTokens = DEMO_TOKENS.filter(t => t.mint);

  const handleWithdraw = async () => {
    if (!publicKey || !signTransaction || !selectedMint || !amount) return;

    try {
      setStatus('building');
      const { withdrawalId, transaction: txBase64 } = await buildWithdrawTx(
        publicKey.toString(), selectedMint, amount
      );

      setStatus('signing');
      const txBuffer = Buffer.from(txBase64, 'base64');
      const tx = Transaction.from(txBuffer);
      const signed = await signTransaction(tx);

      setStatus('processing');
      // Send to Contra gateway (channel burn)
      const connection = new Connection(CONTRA_GATEWAY_URL, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());

      // Confirm the withdrawal
      await confirmWithdrawal(withdrawalId, sig);

      setStatus('confirmed');
      toast.success('Withdrawal initiated! Funds will be released to your wallet.');
      setAmount('');
      refresh();

      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Withdrawal failed:', err);
      toast.error(err.message || 'Withdrawal failed');
      setStatus('idle');
    }
  };

  const selectedBalance = channelBalances.find(b => b.mint === selectedMint);

  return (
    <Panel title="Withdraw from Channel">
      <div className="space-y-4">
        {/* Token Selector */}
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Token</label>
          <select
            className="select-field"
            value={selectedMint}
            onChange={e => setSelectedMint(e.target.value)}
          >
            {validTokens.map(t => (
              <option key={t.mint} value={t.mint}>{t.symbol} — {t.name}</option>
            ))}
          </select>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Amount (raw units)</label>
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
                onClick={() => setAmount(selectedBalance.amount)}
              >
                MAX
              </button>
            )}
          </div>
          {selectedBalance && (
            <div className="text-xs font-mono text-terminal-dim mt-1">
              Channel balance: {selectedBalance.uiAmount} {getTokenSymbol(selectedMint)}
            </div>
          )}
        </div>

        {/* Withdraw Button */}
        <button
          className="btn-primary w-full"
          disabled={!publicKey || !amount || status !== 'idle'}
          onClick={handleWithdraw}
        >
          {status === 'idle' ? 'Withdraw to Wallet' : 'Processing...'}
        </button>

        {/* Status */}
        {status !== 'idle' && (
          <div className="mt-4 space-y-2">
            {[
              { key: 'building', label: 'Building burn transaction' },
              { key: 'signing', label: 'Awaiting signature' },
              { key: 'processing', label: 'Processing withdrawal' },
              { key: 'confirmed', label: 'Confirmed — releasing to wallet' },
            ].map((step, i) => {
              const steps = ['building', 'signing', 'processing', 'confirmed'];
              const stepIndex = steps.indexOf(status);
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
