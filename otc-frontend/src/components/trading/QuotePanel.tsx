import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { getRFQ, submitQuote, acceptQuote, rejectQuote, type RFQ, type Quote } from '../../lib/api';
import { getTokenSymbol, truncateAddress, formatRawAmount, toRawAmount } from '../../lib/constants';
import Panel from '../layout/Panel';

interface QuotePanelProps {
  rfq: RFQ | null;
  onTradeComplete?: () => void;
}

export default function QuotePanel({ rfq, onTradeComplete }: QuotePanelProps) {
  const { publicKey } = useWallet();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [rfqStatus, setRfqStatus] = useState(rfq?.status || '');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!rfq) return;
    setRfqStatus(rfq.status);
    const load = async () => {
      try {
        const d = await getRFQ(rfq.id);
        setQuotes(d.quotes || []);
        setRfqStatus(d.status);
      } catch {}
    };
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
  const isActive = rfqStatus === 'active' || rfqStatus === 'quoted';

  const handleSubmitQuote = async () => {
    if (!publicKey || !price) return;
    setSubmitting(true);
    try {
      // Price is in human terms (e.g. 0.5 wSOL per USDC). Backend calculates raw buyAmount.
      await submitQuote(rfq.id, publicKey.toString(), price, rfq.sellAmount);
      toast.success('Quote submitted');
      setPrice('');
      const d = await getRFQ(rfq.id); setQuotes(d.quotes || []);
    } catch (err: any) { toast.error(err.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleAcceptQuote = async (quote: Quote) => {
    if (!publicKey) return;
    setAccepting(true);
    try {
      await acceptQuote(rfq.id, quote.id);
      toast.success('Trade settled by OTC desk!');
      setRfqStatus('filled');
      const d = await getRFQ(rfq.id);
      setQuotes(d.quotes || []);
      setRfqStatus(d.status);
      onTradeComplete?.();
    } catch (err: any) { toast.error(err.message || 'Failed to accept'); }
    finally { setAccepting(false); }
  };

  const handleReject = async (quote: Quote) => {
    try {
      await rejectQuote(rfq.id, quote.id);
      toast.success('Quote rejected');
      const d = await getRFQ(rfq.id); setQuotes(d.quotes || []);
    } catch {}
  };

  const statusColor = rfqStatus === 'filled' ? 'bg-terminal-accent/10 text-terminal-accent'
    : isActive ? 'bg-terminal-green/10 text-terminal-green'
    : 'bg-terminal-muted text-terminal-dim';

  return (
    <Panel title="Quote / Trade">
      <div className="space-y-4">
        {/* RFQ Details */}
        <div className="bg-terminal-bg rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-medium">{getTokenSymbol(rfq.sellToken)} → {getTokenSymbol(rfq.buyToken)}</span>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${statusColor}`}>
              {rfqStatus.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div><span className="text-terminal-dim">Creator:</span> {truncateAddress(rfq.creator)}</div>
            <div><span className="text-terminal-dim">Sell:</span> <span className="text-terminal-accent">{formatRawAmount(rfq.sellAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}</span></div>
          </div>
        </div>

        {/* Filled state */}
        {rfqStatus === 'filled' && (
          <div className="bg-terminal-green/10 border border-terminal-green/30 rounded p-3 text-center">
            <span className="font-mono text-sm text-terminal-green">Trade Completed</span>
          </div>
        )}

        {/* Submit Quote (for non-creators on active RFQs) */}
        {!isCreator && isActive && (
          <div className="space-y-2">
            <div className="text-xs font-mono text-terminal-dim uppercase">Submit Quote</div>
            <div>
              <label className="block text-xs font-mono text-terminal-dim mb-1">Price ({getTokenSymbol(rfq.buyToken)} per {getTokenSymbol(rfq.sellToken)})</label>
              <input type="number" className="input-field" placeholder="0.0" step="0.0001" value={price} onChange={e => setPrice(e.target.value)} />
              {price && (() => {
                const humanSell = parseFloat(formatRawAmount(rfq.sellAmount, rfq.sellToken).replace(/,/g, ''));
                const total = humanSell * parseFloat(price);
                return <div className="text-xs font-mono text-terminal-dim mt-1">Total: {total.toFixed(4)} {getTokenSymbol(rfq.buyToken)}</div>;
              })()}
            </div>
            <button className="btn-primary w-full" disabled={!price || submitting} onClick={handleSubmitQuote}>
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </button>
          </div>
        )}

        {/* Quotes List */}
        {quotes.length > 0 && (
          <div>
            <div className="text-xs font-mono text-terminal-dim uppercase mb-2">Quotes ({quotes.length})</div>
            <div className="space-y-1">
              {quotes.map(q => (
                <div key={q.id} className="flex items-center justify-between bg-terminal-bg rounded px-3 py-2">
                  <div className="font-mono text-xs">
                    <span className="text-terminal-dim">{truncateAddress(q.quoter)}</span>
                    <span className="mx-2 text-terminal-accent">{q.price}</span>
                    <span className="text-terminal-dim">({formatRawAmount(q.buyAmount, rfq.buyToken)} {getTokenSymbol(rfq.buyToken)})</span>
                  </div>
                  {isCreator && q.status === 'pending' && isActive ? (
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1 text-xs font-mono border border-terminal-red/50 text-terminal-red rounded hover:bg-terminal-red/10 transition-colors"
                        onClick={() => handleReject(q)}
                      >
                        Reject
                      </button>
                      <button className="btn-primary text-xs py-1 px-3" disabled={accepting} onClick={() => handleAcceptQuote(q)}>
                        {accepting ? '...' : 'Accept'}
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-mono ${
                      q.status === 'accepted' ? 'text-terminal-green' :
                      q.status === 'rejected' ? 'text-terminal-red' :
                      'text-terminal-dim'
                    }`}>{q.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
