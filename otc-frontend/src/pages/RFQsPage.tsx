import type { AuthProfile } from '../types/platform';
import { formatAmount, formatRelativeTime } from '../lib/platformFormat';
import { getVisibleRFQs } from '../lib/platformService';
import RFQStatusBadge from '../components/platform/RFQStatusBadge';
import Panel from '../components/layout/Panel';

export default function RFQsPage({
  profile,
  onNavigate,
  onOpenCreateModal,
}: {
  profile: AuthProfile;
  onNavigate: (path: string) => void;
  onOpenCreateModal: () => void;
}) {
  const rfqs = getVisibleRFQs(profile.user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">RFQ Workflow</div>
          <h2 className="mt-1 text-2xl font-semibold">Tenant-scoped bilateral negotiations</h2>
        </div>
        {profile.user.role === 'INSTITUTION' ? (
          <button type="button" className="btn-primary" onClick={onOpenCreateModal}>
            Create RFQ
          </button>
        ) : null}
      </div>

      <Panel title="RFQs">
        <div className="overflow-x-auto">
          <table className="min-w-full font-mono text-xs">
            <thead className="text-terminal-dim">
              <tr className="border-b border-terminal-border">
                <th className="px-3 py-2 text-left">Pair</th>
                <th className="px-3 py-2 text-left">Side</th>
                <th className="px-3 py-2 text-left">Amount</th>
                <th className="px-3 py-2 text-left">Policy</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((rfq) => (
                <tr
                  key={rfq.id}
                  className="cursor-pointer border-b border-terminal-border/70 transition-colors hover:bg-terminal-muted/20"
                  onClick={() => onNavigate(`/rfqs/${rfq.id}`)}
                >
                  <td className="px-3 py-3 text-terminal-text">{rfq.baseAsset}/{rfq.quoteAsset}</td>
                  <td className="px-3 py-3">{rfq.side}</td>
                  <td className="px-3 py-3">{formatAmount(rfq.amount, rfq.baseAsset)}</td>
                  <td className="px-3 py-3">{rfq.policyStatus}</td>
                  <td className="px-3 py-3"><RFQStatusBadge status={rfq.status} /></td>
                  <td className="px-3 py-3 text-terminal-dim">{formatRelativeTime(rfq.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rfqs.length === 0 ? (
          <div className="py-8 text-center font-mono text-sm text-terminal-dim">
            No RFQs are visible in this tenant yet.
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
