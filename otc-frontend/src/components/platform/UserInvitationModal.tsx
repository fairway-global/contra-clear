import { useEffect, useState } from 'react';
import type { InviteUserInput, Organization, UserRole } from '../../types/platform';
import Modal from '../ui/Modal';

interface UserInvitationModalProps {
  open: boolean;
  organization: Organization | null;
  onClose: () => void;
  onSubmit: (input: InviteUserInput) => Promise<void>;
}

export default function UserInvitationModal({ open, organization, onClose, onSubmit }: UserInvitationModalProps) {
  const [form, setForm] = useState({ email: '', fullName: '', role: 'INSTITUTION' as UserRole });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      email: '',
      fullName: '',
      role: organization?.type === 'BANK' ? 'BANK' : 'INSTITUTION',
    });
  }, [open, organization]);

  if (!organization) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        organizationId: organization.id,
        email: form.email,
        fullName: form.fullName,
        role: form.role,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Invite User to ${organization.name}`}
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting || !form.email || !form.fullName}>
            {submitting ? 'Inviting...' : 'Send Invite'}
          </button>
        </div>
      )}
    >
      <div className="grid gap-4">
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Full Name</label>
          <input className="input-field" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Email</label>
          <input className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Role</label>
          <select className="select-field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>
            <option value={organization.type === 'BANK' ? 'BANK' : 'INSTITUTION'}>{organization.type === 'BANK' ? 'BANK' : 'INSTITUTION'}</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
