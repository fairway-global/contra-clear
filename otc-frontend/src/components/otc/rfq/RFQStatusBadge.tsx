import { RFQ_STATUS_LABELS, RFQStatus } from '../../../lib/otc/types';

interface RFQStatusBadgeProps {
  status: RFQStatus;
}

const STATUS_STYLES: Record<RFQStatus, string> = {
  [RFQStatus.Draft]: 'bg-terminal-muted/40 text-terminal-dim',
  [RFQStatus.OpenForQuotes]: 'bg-terminal-green/10 text-terminal-green',
  [RFQStatus.Negotiating]: 'bg-terminal-amber/10 text-terminal-amber',
  [RFQStatus.QuoteSelected]: 'bg-terminal-accent/10 text-terminal-accent',
  [RFQStatus.AwaitingOriginatorDeposit]: 'bg-terminal-amber/10 text-terminal-amber',
  [RFQStatus.AwaitingProviderDeposit]: 'bg-terminal-amber/10 text-terminal-amber',
  [RFQStatus.ReadyToSettle]: 'bg-terminal-accent/10 text-terminal-accent',
  [RFQStatus.Settling]: 'bg-terminal-accent/10 text-terminal-accent',
  [RFQStatus.Settled]: 'bg-terminal-green/10 text-terminal-green',
  [RFQStatus.Expired]: 'bg-terminal-muted/40 text-terminal-dim',
  [RFQStatus.Cancelled]: 'bg-terminal-red/10 text-terminal-red',
  [RFQStatus.Defaulted]: 'bg-terminal-red/10 text-terminal-red',
};

export default function RFQStatusBadge({ status }: RFQStatusBadgeProps) {
  return (
    <span className={`rounded px-2 py-1 text-[11px] font-mono uppercase tracking-wider ${STATUS_STYLES[status]}`}>
      {RFQ_STATUS_LABELS[status]}
    </span>
  );
}
