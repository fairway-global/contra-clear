import { useMemo, useState } from 'react';
import type { Quote, RFQ, UserRole } from '../../types/platform';
import { formatDateTime, formatPrice, formatRelativeTime } from '../../lib/platformFormat';
import QuoteStatusBadge from './QuoteStatusBadge';
import Panel from '../layout/Panel';

interface NegotiationPanelProps {
  rfq: RFQ;
  quotes: Quote[];
  currentRole: UserRole;
  onCounter: (input: { price: string; size: string; expiresAt: string; negotiationNote: string; settlementNotes: string }) => Promise<void>;
}

export default function NegotiationPanel({ rfq, quotes, currentRole, onCounter }: NegotiationPanelProps) {
  const latestQuote = useMemo(() => [...quotes].sort((left, right) => right.version - left.version)[0] ?? null, [quotes]);
  const [form, setForm] = useState({
    price: latestQuote?.price ?? '',
    size: latestQuote?.size ?? rfq.amount,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
    negotiationNote: '',
    settlementNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onCounter({
        ...form,
        expiresAt: new Date(form.expiresAt).toISOString(),
      });
      setForm((current) => ({ ...current, negotiationNote: '', settlementNotes: '' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel title="Negotiation Panel">
      <div className="space-y-4">
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div key={quote.id} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">
                    Version {quote.version} • {quote.createdByRole}
                  </div>
                  <div className="mt-1 text-lg font-semibold">{formatPrice(quote.price, rfq.baseAsset, rfq.quoteAsset)}</div>
                  <div className="mt-1 font-mono text-xs text-terminal-dim">
                    Size {quote.size} {rfq.baseAsset} • Expires {formatDateTime(quote.expiresAt)}
                  </div>
                </div>
                <div className="text-right">
                  <QuoteStatusBadge status={quote.status} />
                  <div className="mt-2 font-mono text-xs text-terminal-dim">{formatRelativeTime(quote.createdAt)}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-terminal-dim">
                <div>{quote.negotiationNote || 'No negotiation note attached.'}</div>
                {quote.settlementNotes ? <div>Settlement: {quote.settlementNotes}</div> : null}
              </div>
            </div>
          ))}
          {quotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-terminal-border p-6 font-mono text-sm text-terminal-dim">
              No quotes yet. The bank will start the negotiation by sending the first quote.
            </div>
          ) : null}
        </div>

        {['SUBMITTED', 'QUOTED', 'NEGOTIATING'].includes(rfq.status) ? (
          <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
            <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">
              {currentRole === 'BANK' ? 'Counter As Bank' : 'Counter As Institution'}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Price</label>
                <input className="input-field" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Size</label>
                <input className="input-field" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Validity</label>
                <input className="input-field" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Negotiation Note</label>
                <input className="input-field" value={form.negotiationNote} onChange={(event) => setForm({ ...form, negotiationNote: event.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Settlement Notes</label>
                <textarea className="input-field min-h-24" value={form.settlementNotes} onChange={(event) => setForm({ ...form, settlementNotes: event.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting || !form.price || !form.size}>
                {submitting ? 'Submitting...' : currentRole === 'BANK' ? 'Send Counter' : 'Send Institution Counter'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
