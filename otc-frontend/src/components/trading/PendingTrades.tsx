import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { getPendingTrades, submitTradeLeg, type PendingTrade } from '../../lib/api';
import { CONTRA_GATEWAY_URL, formatRawAmount, getTokenSymbol, truncateAddress } from '../../lib/constants';
import Panel from '../layout/Panel';

export default function PendingTrades() {
  const { publicKey, signTransaction } = useWallet();
  const [pending, setPending] = useState<PendingTrade[]>([]);
  const [signing, setSigning] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    const load = async () => {
      try {
        setPending(await getPendingTrades(publicKey.toString()));
      } catch {}
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleSign = async (trade: PendingTrade) => {
    if (!publicKey || !signTransaction) return;
    setSigning(trade.id);
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(trade.myTx, 'base64'));
      const signed = await signTransaction(tx);

      toast('Submitting to Contra channel...', { icon: '⚡' });
      const connection = new Connection(CONTRA_GATEWAY_URL, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());

      await submitTradeLeg(trade.rfqId, trade.id, trade.myLeg, sig);
      toast.success('Trade leg signed and submitted! Trade complete.');

      // Remove from pending
      setPending(prev => prev.filter(p => p.id !== trade.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign');
    } finally {
      setSigning(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <Panel title={`Pending Signatures (${pending.length})`}>
      <div className="space-y-2">
        {pending.map(trade => (
          <div key={trade.id} className="bg-terminal-amber/10 border border-terminal-amber/30 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm font-medium">
                {getTokenSymbol(trade.sellToken)} → {getTokenSymbol(trade.buyToken)}
              </span>
              <span className="text-xs font-mono text-terminal-amber">LEG {trade.myLeg}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
              <div>
                <span className="text-terminal-dim">Sell:</span>{' '}
                <span className="text-terminal-red">{formatRawAmount(trade.sellAmount, trade.sellToken)} {getTokenSymbol(trade.sellToken)}</span>
              </div>
              <div>
                <span className="text-terminal-dim">Buy:</span>{' '}
                <span className="text-terminal-green">{formatRawAmount(trade.buyAmount, trade.buyToken)} {getTokenSymbol(trade.buyToken)}</span>
              </div>
              <div>
                <span className="text-terminal-dim">Price:</span> {trade.price}
              </div>
              <div>
                <span className="text-terminal-dim">Counterparty:</span>{' '}
                {truncateAddress(trade.myLeg === 'A' ? trade.partyB : trade.partyA)}
              </div>
            </div>
            <button
              className="btn-primary w-full"
              disabled={signing === trade.id}
              onClick={() => handleSign(trade)}
            >
              {signing === trade.id ? 'Signing...' : `Sign & Submit Leg ${trade.myLeg}`}
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
