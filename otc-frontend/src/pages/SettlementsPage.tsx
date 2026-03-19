import type { AuthProfile } from '../types/platform';
import { getVisibleSettlements } from '../lib/platformService';
import { formatDateTime } from '../lib/platformFormat';
import Panel from '../components/layout/Panel';

export default function SettlementsPage({ profile }: { profile: AuthProfile }) {
  const settlements = getVisibleSettlements(profile.user);

  return (
    <Panel title="Settlement Operations">
      <div className="overflow-x-auto">
        <table className="min-w-full font-mono text-xs">
          <thead className="text-terminal-dim">
            <tr className="border-b border-terminal-border">
              <th className="px-3 py-2 text-left">Settlement</th>
              <th className="px-3 py-2 text-left">RFQ</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Policy</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Completed</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((settlement) => (
              <tr key={settlement.id} className="border-b border-terminal-border/70">
                <td className="px-3 py-3 text-terminal-text">{settlement.id}</td>
                <td className="px-3 py-3">{settlement.rfqId}</td>
                <td className="px-3 py-3">{settlement.status}</td>
                <td className="px-3 py-3">{settlement.policyStatus}</td>
                <td className="px-3 py-3 text-terminal-dim">{formatDateTime(settlement.createdAt)}</td>
                <td className="px-3 py-3 text-terminal-dim">{formatDateTime(settlement.completedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
