import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { createRFQ } from '../../lib/api';
import { DEMO_TOKENS } from '../../lib/constants';
import Panel from '../layout/Panel';

interface CreateRFQProps {
  onCreated: () => void;
}

export default function CreateRFQ({ onCreated }: CreateRFQProps) {
  const { publicKey } = useWallet();
  const [sellToken, setSellToken] = useState(DEMO_TOKENS[0]?.mint || '');
  const [buyToken, setBuyToken] = useState(DEMO_TOKENS[1]?.mint || '');
  const [sellAmount, setSellAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const validTokens = DEMO_TOKENS.filter(t => t.mint);

  const handleCreate = async () => {
    if (!publicKey || !sellAmount || !sellToken || !buyToken) return;
    if (sellToken === buyToken) { toast.error('Sell and buy tokens must differ'); return; }
    setCreating(true);
    try {
      await createRFQ(publicKey.toString(), sellToken, sellAmount, buyToken, 'sell');
      toast.success('RFQ posted');
      setSellAmount('');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create RFQ');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Panel title="Create RFQ">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Sell Token</label>
          <select className="select-field" value={sellToken} onChange={e => setSellToken(e.target.value)}>
            {validTokens.map(t => <option key={t.mint} value={t.mint}>{t.symbol}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Sell Amount (raw)</label>
          <input type="number" className="input-field" placeholder="0" value={sellAmount} onChange={e => setSellAmount(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-mono text-terminal-dim mb-1 uppercase">Buy Token</label>
          <select className="select-field" value={buyToken} onChange={e => setBuyToken(e.target.value)}>
            {validTokens.map(t => <option key={t.mint} value={t.mint}>{t.symbol}</option>)}
          </select>
        </div>
        <button className="btn-primary w-full" disabled={!publicKey || !sellAmount || creating} onClick={handleCreate}>
          {creating ? 'Posting...' : 'Post RFQ'}
        </button>
      </div>
    </Panel>
  );
}
