import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { AuthProfile, KYBStatus, Organization } from '../types/platform';
import { getInstitutions, getVisibleUsers } from '../lib/platformService';
import { usePlatform } from '../hooks/usePlatform';
import { useAuth } from '../hooks/useAuth';
import InstitutionTable from '../components/platform/InstitutionTable';
import UserInvitationModal from '../components/platform/UserInvitationModal';
import KYBStatusCard from '../components/platform/KYBStatusCard';
import Panel from '../components/layout/Panel';

export default function InstitutionsPage({ profile }: { profile: AuthProfile }) {
  const { createInstitution } = usePlatform();
  const { inviteUser } = useAuth();
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [form, setForm] = useState({ name: '', kybStatus: 'PENDING' as KYBStatus, allowedUsers: '10', bankRelationshipManager: profile.user.fullName });

  const institutions = getInstitutions(profile.user);
  const users = getVisibleUsers(profile.user);
  const userCounts = useMemo(
    () => users.reduce<Record<string, number>>((acc, user) => {
      acc[user.organizationId] = (acc[user.organizationId] ?? 0) + 1;
      return acc;
    }, {}),
    [users]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <InstitutionTable institutions={institutions} userCounts={userCounts} onInviteUser={setSelectedOrganization} />

        <Panel title="Onboard Institution">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Institution Name</label>
              <input className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">KYB Status</label>
                <select className="select-field" value={form.kybStatus} onChange={(event) => setForm({ ...form, kybStatus: event.target.value as KYBStatus })}>
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Allowed Users</label>
                <input className="input-field" value={form.allowedUsers} onChange={(event) => setForm({ ...form, allowedUsers: event.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Relationship Manager</label>
              <input className="input-field" value={form.bankRelationshipManager} onChange={(event) => setForm({ ...form, bankRelationshipManager: event.target.value })} />
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={async () => {
                try {
                  await createInstitution(profile.user.id, {
                    name: form.name,
                    kybStatus: form.kybStatus,
                    allowedUsers: Number(form.allowedUsers),
                    bankRelationshipManager: form.bankRelationshipManager,
                  });
                  toast.success('Institution onboarded');
                  setForm({ name: '', kybStatus: 'PENDING', allowedUsers: '10', bankRelationshipManager: profile.user.fullName });
                } catch (err: any) {
                  toast.error(err.message || 'Unable to onboard institution');
                }
              }}
            >
              Create Institution
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {institutions.map((institution) => (
          <KYBStatusCard key={institution.id} organization={institution} />
        ))}
      </div>

      <UserInvitationModal
        open={Boolean(selectedOrganization)}
        organization={selectedOrganization}
        onClose={() => setSelectedOrganization(null)}
        onSubmit={async (input) => {
          try {
            const result = await inviteUser(input);
            toast.success(`Invite created: ${result.inviteUrl}`);
          } catch (err: any) {
            toast.error(err.message || 'Unable to invite user');
            throw err;
          }
        }}
      />
    </div>
  );
}
