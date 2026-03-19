import type { Organization } from '../../types/platform';
import Panel from '../layout/Panel';

const kybStyles = {
  PENDING: 'text-terminal-amber bg-terminal-amber/10',
  APPROVED: 'text-terminal-green bg-terminal-green/10',
  REJECTED: 'text-terminal-red bg-terminal-red/10',
};

export default function KYBStatusCard({ organization }: { organization: Organization }) {
  const kyb = organization.kybStatus ?? 'PENDING';

  return (
    <Panel title={organization.name}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-terminal-dim">KYB Status</span>
          <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${kybStyles[kyb]}`}>
            {kyb}
          </span>
        </div>
        <div className="grid gap-2 font-mono text-xs text-terminal-dim">
          <div className="flex items-center justify-between">
            <span>Onboarding</span>
            <span className="text-terminal-text">{organization.onboardingStatus}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Allowed users</span>
            <span className="text-terminal-text">{organization.allowedUsers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Relationship manager</span>
            <span className="text-terminal-text">{organization.bankRelationshipManager ?? 'Unassigned'}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}
