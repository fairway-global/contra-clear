import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { getRFQ, submitQuote, acceptQuote, submitTradeLeg, type RFQ, type Quote } from '../../lib/api';
import { getTokenSymbol, truncateAddress, CONTRA_GATEWAY_URL } from '../../lib/constants';
import Panel from '../layout/Panel';

interface QuotePanelProps { rfq: RFQ | null; }

export default function QuotePanel({ rfq }: QuotePanelProps) {
  const { publicKey, signTransaction } = useWallet();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  // Pending trade that needs the other party to sign
  const [pendingTrade, setPendingTrade] = useState<{ tradeId: string; legB: string } | null>(null);

  useEffect(() => {
    if (!rfq) return;
    const load = async () => { try { const d = await getRFQ(rfq.id); setQuotes(d.quotes || []); } catch {} };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [rfq?.id]);

  if (!rfq) {
    return (
      <Panel title="Quote / Trade">
        <div className="text-center py-12 text-terminal-dim font-mono text-sm">Select an RFQ to view details and submit a quote</div>
      </Panel>
    );
  }

  const isCreator = publicKey?.toString() === rfq.creator;

  const handleSubmitQuote = async () => {
    if (!publicKey || !price) return;
    setSubmitting(true);
    try {
      await submitQuote(rfq.id, publicKey.toString(), price, rfq.sellAmount);
      toast.success('Quote submitted');
      setPrice('');
      const d = await getRFQ(rfq.id); setQuotes(d.quotes || []);
    } catch (err: any) { toast.error(err.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleAcceptQuote = async (quote: Quote) => {
    if (!publicKey || !signTransaction) return;
    setAccepting(true);
    try {
      const result = await acceptQuote(rfq.id, quote.id);

      if (result.settled) {
        toast.success('Trade settled!');
      } else if (result.transactions) {
        // Sign our leg of the trade (creator signs leg A — the sell side)
        const isPartyA = publicKey.toString() === result.trade.partyA;
        const myLeg = isPartyA ? result.transactions.legA : result.transactions.legB;
        const myLegId = isPartyA ? 'A' as const : 'B' as const;

        toast('Signing your transfer on Contra channel...', { icon: '🔐' });
        const tx = Transaction.from(Buffer.from(myLeg.transaction, 'base64'));
        const signed = await signTransaction(tx);

        // Submit to Contra gateway
        const connection = new Connection(CONTRA_GATEWAY_URL, 'confirmed');
        const sig = await connection.sendRawTransaction(signed.serialize());
        await submitTradeLeg(rfq.id, result.trade.id, myLegId, sig);
        toast.success(`Your leg submitted! ${isPartyA ? 'Counterparty needs to sign leg B.' : 'Trade executing...'}`);

        // If we're the creator, store the pending trade so the other party can sign
        if (isPartyA) {
          setPendingTrade({ tradeId: result.trade.id, legB: result.transactions.legB.transaction });
        }
      }
      const d = await getRFQ(rfq.id); setQuotes(d.quotes || []);
    } catch (err: any) { toast.error(err.message || 'Failed to accept'); }
    finally { setAccepting(false); }
  };

  // Counterparty signs their leg
  const handleSignLegB = async () => {
    if (!publicKey || !signTransaction || !pendingTrade) return;
    setAccepting(true);
    try {
      const tx = Transaction.from(Buffer.from(pendingTrade.legB, 'base64'));
      const signed = await signTransaction(tx);
      const connection = new Connection(CONTRA_GATEWAY_URL, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());
      await submitTradeLeg(rfq.id, pendingTrade.tradeId, 'B', sig);
      toast.success('Trade completed on Contra channel!');
      setPendingTrade(null);
    } catch (err: any) { toast.error(err.message || 'Failed to sign'); }
    finally { setAccepting(false); }
  };

  return (
    <Panel title="Quote / Trade">
      <div className="space-y-4">
        <div className="bg-terminal-bg rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-medium">{getTokenSymbol(rfq.sellToken)} → {getTokenSymbol(rfq.buyToken)}</span>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${(rfq.status === 'active' || rfq.status === 'quoted') ? 'bg-terminal-green/10 text-terminal-green' : 'bg-terminal-muted text-terminal-dim'}`}>
              {rfq.status.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div><span className="text-terminal-dim">Creator:</span> {truncateAddress(rfq.creator)}</div>
            <div><span className="text-terminal-dim">Sell:</span> <span className="text-terminal-accent">{rfq.sellAmount} {getTokenSymbol(rfq.sellToken)}</span></div>
          </div>
        </div>

        {!isCreator && (rfq.status === 'active' || rfq.status === 'quoted') && (
          <div className="space-y-2">
            <div className="text-xs font-mono text-terminal-dim uppercase">Submit Quote</div>
            <div>
              <label className="block text-xs font-mono text-terminal-dim mb-1">Price ({getTokenSymbol(rfq.buyToken)} per {getTokenSymbol(rfq.sellToken)})</label>
              <input type="number" className="input-field" placeholder="0.0" step="0.0001" value={price} onChange={e => setPrice(e.target.value)} />
              {price && <div className="text-xs font-mono text-terminal-dim mt-1">Total: {(parseFloat(rfq.sellAmount) * parseFloat(price)).toFixed(0)} {getTokenSymbol(rfq.buyToken)}</div>}
            </div>
            <button className="btn-primary w-full" disabled={!price || submitting} onClick={handleSubmitQuote}>
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </button>
          </div>
        )}

        {quotes.length > 0 && (
          <div>
            <div className="text-xs font-mono text-terminal-dim uppercase mb-2">Quotes ({quotes.length})</div>
            <div className="space-y-1">
              {quotes.map(q => (
                <div key={q.id} className="flex items-center justify-between bg-terminal-bg rounded px-3 py-2">
                  <div className="font-mono text-xs">
                    <span className="text-terminal-dim">{truncateAddress(q.quoter)}</span>
                    <span className="mx-2 text-terminal-accent">{q.price}</span>
                    <span className="text-terminal-dim">({q.buyAmount} {getTokenSymbol(rfq.buyToken)})</span>
                  </div>
                  {isCreator && q.status === 'pending' ? (
                    <button className="btn-primary text-xs py-1 px-3" disabled={accepting} onClick={() => handleAcceptQuote(q)}>
                      {accepting ? '...' : 'Accept & Sign'}
                    </button>
                  ) : (
                    <span className={`text-xs font-mono ${q.status === 'accepted' ? 'text-terminal-green' : 'text-terminal-dim'}`}>{q.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending trade — counterparty needs to sign */}
        {pendingTrade && (
          <div className="bg-terminal-amber/10 border border-terminal-amber/30 rounded p-3">
            <div className="text-xs font-mono text-terminal-amber uppercase mb-2">Pending — Counterparty Leg</div>
            <p className="text-xs font-mono text-terminal-dim mb-2">
              Your leg A is submitted. Switch to the counterparty wallet and sign leg B to complete the trade on the Contra channel.
            </p>
            <button className="btn-primary w-full text-xs" disabled={accepting} onClick={handleSignLegB}>
              {accepting ? 'Signing...' : 'Sign Leg B (Counterparty)'}
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}
