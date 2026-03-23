import { useEffect, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import type { User, UserMutationInput } from '../../../lib/otc/types';
import { USER_ROLE_LABELS, UserRole } from '../../../lib/otc/types';

interface UserFormModalProps {
  open: boolean;
  user?: User | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: UserMutationInput) => Promise<void> | void;
}

export default function UserFormModal({ open, user, saving, onClose, onSubmit }: UserFormModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Extract<UserRole, UserRole.RFQ_ORIGINATOR | UserRole.LIQUIDITY_PROVIDER>>(UserRole.RFQ_ORIGINATOR);
  const [status, setStatus] = useState<'ACTIVE' | 'INVITED' | 'SUSPENDED'>('ACTIVE');

  useEffect(() => {
    if (!open) {
      return;
    }
    setFullName(user?.fullName || '');
    setEmail(user?.email || '');
    setRole((user?.role as Extract<UserRole, UserRole.RFQ_ORIGINATOR | UserRole.LIQUIDITY_PROVIDER>) || UserRole.RFQ_ORIGINATOR);
    setStatus(user?.status || 'ACTIVE');
  }, [open, user]);

  return (
    <ModalShell
      open={open}
      title={user ? 'Edit User' : 'Create User'}
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!fullName || !email || saving}
            onClick={() => void onSubmit({ fullName, email, role, status })}
          >
            {saving ? 'Saving...' : user ? 'Save Changes' : 'Create User'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Full Name</label>
          <input className="input-field" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Email</label>
          <input className="input-field" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Role</label>
            <select className="select-field" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
              <option value={UserRole.RFQ_ORIGINATOR}>{USER_ROLE_LABELS[UserRole.RFQ_ORIGINATOR]}</option>
              <option value={UserRole.LIQUIDITY_PROVIDER}>{USER_ROLE_LABELS[UserRole.LIQUIDITY_PROVIDER]}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Status</label>
            <select className="select-field" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invited</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
