import type { AuthProfile } from '../types/platform';
import { getDashboardOverview, getVisibleEscrowObligations, getVisibleRFQs } from '../lib/platformService';
import { formatAmount, formatRelativeTime } from '../lib/platformFormat';
import BankDashboardOverview from '../components/platform/BankDashboardOverview';
import InstitutionDashboardOverview from '../components/platform/InstitutionDashboardOverview';
import RFQStatusBadge from '../components/platform/RFQStatusBadge';
import Panel from '../components/layout/Panel';

export default function DashboardPage({
  profile,
  onNavigate,
}: {
  profile: AuthProfile;
  onNavigate: (path: string) => void;
}) {
  const overview = getDashboardOverview(profile.user);
  const rfqs = getVisibleRFQs(profile.user).slice(0, 5);
  const obligations = getVisibleEscrowObligations(profile.user).slice(0, 4);

  return (
    <div className="space-y-6">
      {profile.user.role === 'BANK' ? (
        <BankDashboardOverview overview={overview as any} />
      ) : (
        <InstitutionDashboardOverview overview={overview as any} />
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title={profile.user.role === 'BANK' ? 'RFQs Awaiting Action' : 'Recent RFQs'}>
          <div className="space-y-3">
            {rfqs.map((rfq) => (
              <button
                key={rfq.id}
                type="button"
                onClick={() => onNavigate(`/rfqs/${rfq.id}`)}
                className="w-full rounded-lg border border-terminal-border bg-terminal-bg p-4 text-left transition-colors hover:border-terminal-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">
                      {rfq.side} {rfq.baseAsset}/{rfq.quoteAsset}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{formatAmount(rfq.amount, rfq.baseAsset)}</div>
                  </div>
                  <RFQStatusBadge status={rfq.status} />
                </div>
                <div className="mt-3 font-mono text-xs text-terminal-dim">
                  Updated {formatRelativeTime(rfq.updatedAt)}
                </div>
              </button>
            ))}
            {rfqs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-terminal-border p-6 font-mono text-sm text-terminal-dim">
                No RFQs are visible in this workspace yet.
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Escrow Watchlist">
          <div className="space-y-3">
            {obligations.map((obligation) => (
              <div key={obligation.id} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">
                    {obligation.partyRole} escrow
                  </div>
                  <span className="rounded-full bg-terminal-accent/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-terminal-accent">
                    {obligation.status}
                  </span>
                </div>
                <div className="mt-2 text-lg font-semibold">{formatAmount(obligation.amount, obligation.asset)}</div>
                <div className="mt-2 font-mono text-xs text-terminal-dim">
                  {obligation.creditedInContra ? 'Credited in Contra' : 'Awaiting funding'}
                </div>
              </div>
            ))}
            {obligations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-terminal-border p-6 font-mono text-sm text-terminal-dim">
                No escrow obligations are active right now.
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
