import Panel from '../../layout/Panel';
import { timeAgo } from '../../../lib/constants';
import type { User } from '../../../lib/otc/types';
import { USER_ROLE_LABELS } from '../../../lib/otc/types';

interface UserManagementTableProps {
  users: User[];
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: 'ALL' | 'RFQ_ORIGINATOR' | 'LIQUIDITY_PROVIDER';
  onRoleFilterChange: (value: 'ALL' | 'RFQ_ORIGINATOR' | 'LIQUIDITY_PROVIDER') => void;
  onCreate: () => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export default function UserManagementTable({
  users,
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  onCreate,
  onEdit,
  onDelete,
}: UserManagementTableProps) {
  return (
    <Panel
      title="User Management"
      action={<button type="button" className="btn-primary" onClick={onCreate}>Create User</button>}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            className="input-field md:w-80"
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <select className="select-field md:w-56" value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value as typeof roleFilter)}>
            <option value="ALL">All Roles</option>
            <option value="RFQ_ORIGINATOR">RFQ Originators</option>
            <option value="LIQUIDITY_PROVIDER">Liquidity Providers</option>
          </select>
        </div>
        <div className="font-mono text-xs text-terminal-dim">{users.length} user records</div>
      </div>
      {users.length === 0 ? (
        <div className="py-8 text-center font-mono text-sm text-terminal-dim">No users match this filter.</div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1.2fr_1.2fr_0.9fr_0.7fr_0.7fr_0.8fr] gap-3 px-2 pb-2 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>
          {users.map((user) => (
            <div key={user.id} className="grid grid-cols-[1.2fr_1.2fr_0.9fr_0.7fr_0.7fr_0.8fr] gap-3 rounded px-2 py-2 hover:bg-terminal-muted/30">
              <span className="font-mono text-xs text-terminal-text">{user.fullName}</span>
              <span className="font-mono text-xs text-terminal-dim">{user.email}</span>
              <span className="font-mono text-xs text-terminal-text">{USER_ROLE_LABELS[user.role]}</span>
              <span className="font-mono text-xs text-terminal-dim">{user.status}</span>
              <span className="font-mono text-xs text-terminal-dim">{timeAgo(user.createdAt)}</span>
              <span className="flex justify-end gap-2">
                <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => onEdit(user)}>Edit</button>
                <button type="button" className="btn-secondary px-3 py-1 text-xs text-terminal-red hover:border-terminal-red" onClick={() => onDelete(user)}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
