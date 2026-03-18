import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { buildWithdrawTx } from '../../lib/api';
import { DEMO_TOKENS, getTokenSymbol, toRawAmount, formatUiAmount } from '../../lib/constants';
import Panel from '../layout/Panel';
import { useBalances } from '../../hooks/useBalances';

export default function WithdrawPanel() {
  const { publicKey } = useWallet();
  const { channelBalances, refresh } = useBalances();
  const [selectedMint, setSelectedMint] = useState(DEMO_TOKENS[0]?.mint || '');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const validTokens = DEMO_TOKENS.filter(t => t.mint);
  const selectedBalance = channelBalances.find(b => b.mint === selectedMint);

  const handleWithdraw = async () => {
    if (!publicKey || !selectedMint || !amount) return;
    setProcessing(true);
    try {
      const rawAmount = toRawAmount(amount, selectedMint);
      await buildWithdrawTx(publicKey.toString(), selectedMint, rawAmount);
      toast.success('Withdrawal submitted! OTC desk will release funds to your wallet.');
      setAmount('');
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Withdrawal failed');
    } finally {
      setProcessing(false);
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
          >
            {validTokens.map(t => (
              <option key={t.mint} value={t.mint}>{t.symbol} — {t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Amount ({getTokenSymbol(selectedMint)})</label>
          <div className="relative">
            <input
              type="number"
              className="input-field pr-16"
              placeholder="0.00"
              step="0.01"
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
              Channel balance: {formatUiAmount(selectedBalance.uiAmount)} {getTokenSymbol(selectedMint)}
            </div>
          )}
        </div>

        <button
          className="btn-primary w-full"
          disabled={!publicKey || !amount || processing}
          onClick={handleWithdraw}
        >
          {processing ? 'Processing...' : 'Withdraw to Wallet'}
        </button>

        <div className="text-xs font-mono text-terminal-dim bg-terminal-bg rounded p-2">
          Withdrawals are processed by the OTC desk. Funds will be released from the escrow to your on-chain wallet.
        </div>
      </div>
    </Panel>
  );
}
