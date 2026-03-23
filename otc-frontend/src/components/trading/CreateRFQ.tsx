import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { createRFQ } from '../../lib/api';
import {
  formatUiAmount,
  getAllKnownTokens,
  getTokenName,
  getTokenSymbol,
  getTokensForMints,
  toRawAmount,
} from '../../lib/constants';
import { useBalances } from '../../hooks/useBalances';
import { useDeposits } from '../../hooks/useDeposits';
import Panel from '../layout/Panel';

interface CreateRFQProps {
  onCreated: () => void;
}

export default function CreateRFQ({ onCreated }: CreateRFQProps) {
  const { publicKey } = useWallet();
  const { channelBalances, onChainBalances } = useBalances();
  const { deposits } = useDeposits();
  const [sellToken, setSellToken] = useState('');
  const [buyToken, setBuyToken] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const sellTokens = getTokensForMints(channelBalances.map(balance => balance.mint));
  const buyTokens = useMemo(() => {
    const discovered = getAllKnownTokens();
    return discovered.length ? discovered : getTokensForMints(onChainBalances.map(balance => balance.mint));
  }, [channelBalances, onChainBalances]);
  const sellBalance = channelBalances.find(b => b.mint === sellToken);
  const confirmingDeposit = deposits.find(d => d.tokenMint === sellToken && d.status === 'confirming');

  useEffect(() => {
    if (!sellTokens.length) {
      setSellToken('');
      return;
    }

    if (!sellToken || !sellTokens.some(token => token.mint === sellToken)) {
      setSellToken(sellTokens[0].mint);
    }
  }, [sellToken, sellTokens]);

  useEffect(() => {
    if (!buyTokens.length) {
      setBuyToken('');
      return;
    }

    const preferred = buyTokens.find(token => token.mint !== sellToken) || buyTokens[0];
    if (!buyToken || !buyTokens.some(token => token.mint === buyToken) || buyToken === sellToken) {
      setBuyToken(preferred.mint);
    }
  }, [buyToken, buyTokens, sellToken]);

  const handleCreate = async () => {
    if (!publicKey || !sellAmount || !sellToken || !buyToken) return;
    if (sellToken === buyToken) { toast.error('Sell and buy tokens must differ'); return; }
    setCreating(true);
    try {
      const rawAmount = toRawAmount(sellAmount, sellToken);
      await createRFQ(publicKey.toString(), sellToken, rawAmount, buyToken, 'sell');
      toast.success('RFQ posted');
      setSellAmount('');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create RFQ', { duration: 5000 });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Panel title="Create RFQ">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Sell Token</label>
          <select className="select-field" value={sellToken} onChange={e => setSellToken(e.target.value)} disabled={!sellTokens.length}>
            {sellTokens.length === 0 ? (
              <option value="">No channel SPL tokens found</option>
            ) : (
              sellTokens.map(t => <option key={t.mint} value={t.mint}>{t.symbol} - {getTokenName(t.mint)}</option>)
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Sell Amount ({getTokenSymbol(sellToken) || 'Token'})</label>
          <input type="number" className="input-field" placeholder="0.00" step="0.01" value={sellAmount} onChange={e => setSellAmount(e.target.value)} />
          {sellBalance ? (
            <div className="text-xs font-mono text-terminal-dim mt-1">
              Channel balance: <span className="text-terminal-accent">{formatUiAmount(sellBalance.uiAmount)}</span> {getTokenSymbol(sellToken)}
            </div>
          ) : confirmingDeposit ? (
            <div className="text-xs font-mono text-terminal-amber mt-1">
              Deposit detected on Solana. Waiting for Contra channel credit before RFQs can be posted.
            </div>
          ) : (
            <div className="text-xs font-mono text-terminal-red mt-1">
              No channel balance for this token yet.
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Buy Token</label>
          <select className="select-field" value={buyToken} onChange={e => setBuyToken(e.target.value)} disabled={!buyTokens.length}>
            {buyTokens.length === 0 ? (
              <option value="">No SPL tokens discovered yet</option>
            ) : (
              buyTokens.map(t => <option key={t.mint} value={t.mint}>{t.symbol} - {getTokenName(t.mint)}</option>)
            )}
          </select>
        </div>
        <button className="btn-primary w-full" disabled={!publicKey || !sellAmount || creating || !sellBalance || !buyToken || sellToken === buyToken} onClick={handleCreate}>
          {creating ? 'Posting...' : 'Post RFQ'}
        </button>
      </div>
    </Panel>
  );
}
