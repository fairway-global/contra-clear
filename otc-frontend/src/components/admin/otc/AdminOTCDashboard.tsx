import Panel from '../../layout/Panel';
import { timeAgo } from '../../../lib/constants';
import type { ActivityEvent, OTCAdminOverview, RFQ } from '../../../lib/otc/types';
import AdminEscrowMonitor from './AdminEscrowMonitor';
import AdminRFQTable from './AdminRFQTable';

interface AdminOTCDashboardProps {
  overview: OTCAdminOverview | null;
  rfqs: Array<RFQ & { quoteCount?: number; activityCount?: number }>;
  escrows: any[];
  activities: ActivityEvent[];
  onOpenRFQ?: (rfqId: string) => void;
}

export default function AdminOTCDashboard({
  overview,
  rfqs,
  escrows,
  activities,
  onOpenRFQ,
}: AdminOTCDashboardProps) {
  const stats = [
    { label: 'Total RFQs', value: overview?.totalRFQs ?? '-' },
    { label: 'Open', value: overview?.openRFQs ?? '-' },
    { label: 'Negotiating', value: overview?.negotiatingRFQs ?? '-' },
    { label: 'Awaiting Deposit', value: overview?.awaitingDeposits ?? '-' },
    { label: 'Ready / Settling', value: overview?.readyToSettle ?? '-' },
    { label: 'Settled', value: overview?.settledRFQs ?? '-' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="panel p-4 text-center">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <AdminRFQTable rfqs={rfqs.slice(0, 6)} onOpenRFQ={onOpenRFQ} />
        <Panel title="Operations Feed">
          {activities.length === 0 ? (
            <div className="py-8 text-center font-mono text-sm text-terminal-dim">No operations events yet.</div>
          ) : (
            <div className="space-y-3">
              {activities.slice(0, 8).map((event) => (
                <div key={event.id} className="rounded border border-terminal-border bg-terminal-bg px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-sm text-terminal-text">{event.summary}</div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-terminal-dim">{timeAgo(event.createdAt)}</div>
                  </div>
                  <div className="mt-1 font-mono text-xs text-terminal-dim">{event.actorName}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <AdminEscrowMonitor escrows={escrows.slice(0, 8)} onOpenRFQ={onOpenRFQ} />
    </div>
  );
}
