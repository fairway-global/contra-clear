import type { QuoteStatus } from '../../types/platform';

const statusClassNames: Record<QuoteStatus, string> = {
  SENT: 'bg-terminal-accent/10 text-terminal-accent',
  COUNTERED: 'bg-terminal-amber/10 text-terminal-amber',
  ACCEPTED: 'bg-terminal-green/10 text-terminal-green',
  REJECTED: 'bg-terminal-red/10 text-terminal-red',
  EXPIRED: 'bg-terminal-muted text-terminal-dim',
  SUPERSEDED: 'bg-terminal-muted text-terminal-dim',
};

export default function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${statusClassNames[status]}`}>
      {status}
    </span>
  );
}
