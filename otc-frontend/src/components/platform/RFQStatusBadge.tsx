import type { RFQStatus } from '../../types/platform';

const statusClassNames: Record<RFQStatus, string> = {
  SUBMITTED: 'bg-terminal-amber/10 text-terminal-amber',
  QUOTED: 'bg-terminal-accent/10 text-terminal-accent',
  NEGOTIATING: 'bg-terminal-accent/10 text-terminal-accent',
  ACCEPTED: 'bg-terminal-green/10 text-terminal-green',
  ESCROW_PENDING: 'bg-terminal-amber/10 text-terminal-amber',
  SETTLING: 'bg-terminal-accent/10 text-terminal-accent',
  SETTLED: 'bg-terminal-green/10 text-terminal-green',
  CANCELLED: 'bg-terminal-red/10 text-terminal-red',
};

export default function RFQStatusBadge({ status }: { status: RFQStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${statusClassNames[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
