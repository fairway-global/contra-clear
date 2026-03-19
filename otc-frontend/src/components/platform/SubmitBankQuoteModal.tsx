import { useEffect, useState } from 'react';
import type { SubmitQuoteInput } from '../../types/platform';
import Modal from '../ui/Modal';

interface SubmitBankQuoteModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: SubmitQuoteInput) => Promise<void>;
}

export default function SubmitBankQuoteModal({ open, onClose, onSubmit }: SubmitBankQuoteModalProps) {
  const [form, setForm] = useState({
    price: '',
    size: '',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
    settlementNotes: '',
    negotiationNote: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      price: '',
      size: '',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
      settlementNotes: '',
      negotiationNote: '',
    });
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        expiresAt: new Date(form.expiresAt).toISOString(),
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
      title="Submit Bank Quote"
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting || !form.price || !form.size}>
            {submitting ? 'Sending...' : 'Send Quote'}
          </button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Price</label>
          <input className="input-field" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="64500" />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Size</label>
          <input className="input-field" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="4" />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Validity Window</label>
          <input className="input-field" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Negotiation Note</label>
          <input className="input-field" value={form.negotiationNote} onChange={(event) => setForm({ ...form, negotiationNote: event.target.value })} placeholder="Optional desk commentary" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Settlement Notes</label>
          <textarea className="input-field min-h-28" value={form.settlementNotes} onChange={(event) => setForm({ ...form, settlementNotes: event.target.value })} placeholder="Escrow timing, policy dependencies, or operations notes." />
        </div>
      </div>
    </Modal>
  );
}
