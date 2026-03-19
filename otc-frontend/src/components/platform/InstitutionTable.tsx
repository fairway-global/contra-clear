import type { Organization } from '../../types/platform';
import { formatRelativeTime } from '../../lib/platformFormat';
import Panel from '../layout/Panel';

interface InstitutionTableProps {
  institutions: Organization[];
  userCounts: Record<string, number>;
  onInviteUser: (organization: Organization) => void;
}

export default function InstitutionTable({
  institutions,
  userCounts,
  onInviteUser,
}: InstitutionTableProps) {
  return (
    <Panel title="Institutions">
      <div className="overflow-x-auto">
        <table className="min-w-full font-mono text-xs">
          <thead className="text-terminal-dim">
            <tr className="border-b border-terminal-border">
              <th className="px-3 py-2 text-left">Institution</th>
              <th className="px-3 py-2 text-left">KYB</th>
              <th className="px-3 py-2 text-left">Onboarding</th>
              <th className="px-3 py-2 text-left">Users</th>
              <th className="px-3 py-2 text-left">Relationship</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {institutions.map((institution) => (
              <tr key={institution.id} className="border-b border-terminal-border/70">
                <td className="px-3 py-3 text-terminal-text">{institution.name}</td>
                <td className="px-3 py-3">{institution.kybStatus ?? 'PENDING'}</td>
                <td className="px-3 py-3">{institution.onboardingStatus}</td>
                <td className="px-3 py-3">
                  {userCounts[institution.id] ?? 0}/{institution.allowedUsers}
                </td>
                <td className="px-3 py-3">{institution.bankRelationshipManager ?? 'Unassigned'}</td>
                <td className="px-3 py-3 text-right">
                  <button type="button" className="btn-secondary" onClick={() => onInviteUser(institution)}>
                    Invite User
                  </button>
                </td>
              </tr>
            ))}
            {institutions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-terminal-dim">
                  No institutions are onboarded in this tenant yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
        Updated live in this mock workspace and scoped per bank tenant.
      </div>
    </Panel>
  );
}
