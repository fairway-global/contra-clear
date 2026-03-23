import { QUOTE_STATUS_LABELS, QuoteStatus } from '../../../lib/otc/types';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

const STATUS_STYLES: Record<QuoteStatus, string> = {
  [QuoteStatus.Draft]: 'bg-terminal-muted/40 text-terminal-dim',
  [QuoteStatus.Submitted]: 'bg-terminal-green/10 text-terminal-green',
  [QuoteStatus.Countered]: 'bg-terminal-amber/10 text-terminal-amber',
  [QuoteStatus.Negotiating]: 'bg-terminal-amber/10 text-terminal-amber',
  [QuoteStatus.Accepted]: 'bg-terminal-accent/10 text-terminal-accent',
  [QuoteStatus.Rejected]: 'bg-terminal-red/10 text-terminal-red',
  [QuoteStatus.Expired]: 'bg-terminal-muted/40 text-terminal-dim',
  [QuoteStatus.AwaitingDeposit]: 'bg-terminal-amber/10 text-terminal-amber',
  [QuoteStatus.Deposited]: 'bg-terminal-accent/10 text-terminal-accent',
  [QuoteStatus.Settled]: 'bg-terminal-green/10 text-terminal-green',
  [QuoteStatus.Cancelled]: 'bg-terminal-red/10 text-terminal-red',
};

export default function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  return (
    <span className={`rounded px-2 py-1 text-[11px] font-mono uppercase tracking-wider ${STATUS_STYLES[status]}`}>
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
