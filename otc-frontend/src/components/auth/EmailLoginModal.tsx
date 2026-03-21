import { useEffect, useMemo, useState } from 'react';
import ModalShell from '../layout/ModalShell';
import type { User } from '../../lib/otc/types';
import { USER_ROLE_LABELS, UserRole } from '../../lib/otc/types';

interface EmailLoginModalProps {
  open: boolean;
  users: User[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { email: string; role: UserRole }) => Promise<void> | void;
}

export default function EmailLoginModal({
  open,
  users,
  submitting,
  onClose,
  onSubmit,
}: EmailLoginModalProps) {
  const [role, setRole] = useState<UserRole>(UserRole.RFQ_ORIGINATOR);
  const [email, setEmail] = useState('');

  const usersForRole = useMemo(
    () => users.filter((user) => user.role === role),
    [role, users],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setEmail(usersForRole[0]?.email || '');
  }, [open, usersForRole]);

  return (
    <ModalShell
      open={open}
      title="Email Login"
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!email || submitting} onClick={() => void onSubmit({ email, role })}>
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs leading-6 text-terminal-dim">
          Mock email access for the three dashboard roles. Select a role, choose one of the seeded emails, and continue.
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Role</label>
          <select className="select-field" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value={UserRole.RFQ_ORIGINATOR}>{USER_ROLE_LABELS[UserRole.RFQ_ORIGINATOR]}</option>
            <option value={UserRole.LIQUIDITY_PROVIDER}>{USER_ROLE_LABELS[UserRole.LIQUIDITY_PROVIDER]}</option>
            <option value={UserRole.ADMIN}>{USER_ROLE_LABELS[UserRole.ADMIN]}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Email</label>
          <input
            className="input-field"
            list="contra-role-email-options"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@contraotc.dev"
          />
          <datalist id="contra-role-email-options">
            {usersForRole.map((user) => (
              <option key={user.id} value={user.email}>{user.fullName}</option>
            ))}
          </datalist>
          {usersForRole.length > 0 ? (
            <div className="mt-2 font-mono text-xs text-terminal-dim">
              Available: {usersForRole.map((user) => `${user.fullName} (${user.email})`).join(' · ')}
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
