import type { AuthProfile } from '../types/platform';
import { getVisibleUsers } from '../lib/platformService';
import { formatDateTime } from '../lib/platformFormat';
import Panel from '../components/layout/Panel';

export default function UsersPage({ profile }: { profile: AuthProfile }) {
  const users = getVisibleUsers(profile.user);

  return (
    <Panel title="User Management">
      <div className="overflow-x-auto">
        <table className="min-w-full font-mono text-xs">
          <thead className="text-terminal-dim">
            <tr className="border-b border-terminal-border">
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-terminal-border/70">
                <td className="px-3 py-3 text-terminal-text">{user.fullName}</td>
                <td className="px-3 py-3">{user.email}</td>
                <td className="px-3 py-3">{user.role}</td>
                <td className="px-3 py-3">{user.status}</td>
                <td className="px-3 py-3 text-terminal-dim">{formatDateTime(user.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
