import Panel from '../../layout/Panel';
import type { Quote, RFQ } from '../../../lib/otc/types';
import { UserRole } from '../../../lib/otc/types';
import QuoteCard from '../quotes/QuoteCard';

interface QuoteTableProps {
  rfq: RFQ;
  quotes: Quote[];
  viewerRole: UserRole;
  onAcceptQuote?: (quote: Quote) => void;
  onRejectQuote?: (quote: Quote) => void;
  onCounterQuote?: (quote: Quote) => void;
}

export default function QuoteTable({
  rfq,
  quotes,
  viewerRole,
  onAcceptQuote,
  onRejectQuote,
  onCounterQuote,
}: QuoteTableProps) {
  const grouped = new Map<string, Quote[]>();
  quotes.forEach((quote) => {
    const bucket = grouped.get(quote.providerId) || [];
    bucket.push(quote);
    grouped.set(quote.providerId, bucket);
  });

  const threads = Array.from(grouped.values())
    .map((entries) => entries.sort((left, right) => right.version - left.version))
    .sort((left, right) => new Date(right[0].updatedAt).getTime() - new Date(left[0].updatedAt).getTime());

  return (
    <Panel title={`Quotes (${threads.length})`}>
      {threads.length === 0 ? (
        <div className="py-8 text-center font-mono text-sm text-terminal-dim">
          {viewerRole === UserRole.LIQUIDITY_PROVIDER
            ? 'No quote version submitted yet for this RFQ.'
            : 'No inbound quotes yet. Providers will appear here once they respond.'}
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map(([latest, ...history]) => (
            <QuoteCard
              key={latest.id}
              rfq={rfq}
              quote={latest}
              history={history}
              viewerRole={viewerRole}
              onAccept={onAcceptQuote}
              onReject={onRejectQuote}
              onCounter={onCounterQuote}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
