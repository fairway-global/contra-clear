import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { buildDepositTx, confirmDeposit } from '../../lib/api';
import { DEMO_TOKENS, SOLANA_VALIDATOR_URL, getTokenSymbol } from '../../lib/constants';
import Panel from '../layout/Panel';
import { useBalances } from '../../hooks/useBalances';

export default function DepositPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { onChainBalances, refresh } = useBalances();
  const [selectedMint, setSelectedMint] = useState(DEMO_TOKENS[0]?.mint || '');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'building' | 'signing' | 'confirming' | 'credited'>('idle');

  const validTokens = DEMO_TOKENS.filter(t => t.mint);

  const handleDeposit = async () => {
    if (!publicKey || !signTransaction || !selectedMint || !amount) return;

    try {
      setStatus('building');
      // Build deposit transaction on the server
      const { transaction: txBase64 } = await buildDepositTx(publicKey.toString(), selectedMint, amount);

      setStatus('signing');
      // Deserialize and sign
      const txBuffer = Buffer.from(txBase64, 'base64');
      const tx = Transaction.from(txBuffer);
      const signed = await signTransaction(tx);

      setStatus('confirming');
      // Send to local validator
      const connection = new Connection(SOLANA_VALIDATOR_URL, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      // Record the deposit
      await confirmDeposit(publicKey.toString(), selectedMint, amount, sig);

      setStatus('credited');
      toast.success('Deposit confirmed! Waiting for channel credit...');
      setAmount('');
      refresh();

      // Reset status after a moment
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Deposit failed:', err);
      toast.error(err.message || 'Deposit failed');
      setStatus('idle');
    }
  };

  const selectedBalance = onChainBalances.find(b => b.mint === selectedMint);

  const statusSteps = [
    { key: 'building', label: 'Building transaction' },
    { key: 'signing', label: 'Awaiting signature' },
    { key: 'confirming', label: 'Confirming on-chain' },
    { key: 'credited', label: 'Credited to channel' },
  ];

  return (
    <Panel title="Deposit to Channel">
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
              Available: {selectedBalance.uiAmount} {getTokenSymbol(selectedMint)}
            </div>
          )}
        </div>

        {/* Deposit Button */}
        <button
          className="btn-primary w-full"
          disabled={!publicKey || !amount || status !== 'idle'}
          onClick={handleDeposit}
        >
          {status === 'idle' ? 'Deposit to Channel' : 'Processing...'}
        </button>

        {/* Status Timeline */}
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
