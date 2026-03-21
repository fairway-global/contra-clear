import type { ReactNode } from 'react';
import Panel from '../../layout/Panel';
import { timeAgo } from '../../../lib/constants';
import type { ActivityEvent } from '../../../lib/otc/types';

interface QuoteNegotiationThreadProps {
  events: ActivityEvent[];
  action?: ReactNode;
}

export default function QuoteNegotiationThread({ events, action }: QuoteNegotiationThreadProps) {
  return (
    <Panel title="Negotiation Thread" action={action}>
      {events.length === 0 ? (
        <div className="py-8 text-center font-mono text-sm text-terminal-dim">
          Negotiation history will appear here once counterparties start responding.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded border border-terminal-border bg-terminal-bg px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm text-terminal-text">{event.summary}</div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-terminal-dim">{timeAgo(event.createdAt)}</div>
              </div>
              <div className="mt-1 font-mono text-xs text-terminal-dim">{event.actorName}</div>
              {event.detail ? <div className="mt-2 font-mono text-xs leading-6 text-terminal-text">{event.detail}</div> : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
