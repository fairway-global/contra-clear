import { useEffect, useState } from 'react';
import type { CreateRFQInput, PolicyStatus, RFQSide, Tenant } from '../../types/platform';
import Modal from '../ui/Modal';

interface CreateRFQModalProps {
  open: boolean;
  tenant: Tenant;
  onClose: () => void;
  onSubmit: (input: CreateRFQInput) => Promise<void>;
}

export default function CreateRFQModal({ open, tenant, onClose, onSubmit }: CreateRFQModalProps) {
  const [form, setForm] = useState<CreateRFQInput>({
    side: 'BUY',
    baseAsset: tenant.allowedAssets[1] ?? 'SOL',
    quoteAsset: tenant.allowedAssets[0] ?? 'USD',
    amount: '',
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16),
    policyStatus: 'CLEAR',
    settlementNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      side: 'BUY',
      baseAsset: tenant.allowedAssets[1] ?? 'SOL',
      quoteAsset: tenant.allowedAssets[0] ?? 'USD',
      amount: '',
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16),
      policyStatus: 'CLEAR',
      settlementNotes: '',
    });
  }, [open, tenant.allowedAssets]);

  const updateField = <K extends keyof CreateRFQInput>(key: K, value: CreateRFQInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

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
      title="Create RFQ"
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting || !form.amount}>
            {submitting ? 'Submitting...' : 'Submit RFQ to Bank'}
          </button>
        </div>
      )}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Side</label>
          <select
            className="select-field"
            value={form.side}
            onChange={(event) => updateField('side', event.target.value as RFQSide)}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Trade Size</label>
          <input
            className="input-field"
            value={form.amount}
            onChange={(event) => updateField('amount', event.target.value)}
            placeholder="150000"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Base Asset</label>
          <select
            className="select-field"
            value={form.baseAsset}
            onChange={(event) => updateField('baseAsset', event.target.value)}
          >
            {tenant.allowedAssets.map((asset) => <option key={asset}>{asset}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Quote Asset</label>
          <select
            className="select-field"
            value={form.quoteAsset}
            onChange={(event) => updateField('quoteAsset', event.target.value)}
          >
            {tenant.allowedAssets.map((asset) => <option key={asset}>{asset}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Policy Status</label>
          <select
            className="select-field"
            value={form.policyStatus}
            onChange={(event) => updateField('policyStatus', event.target.value as PolicyStatus)}
          >
            <option value="CLEAR">CLEAR</option>
            <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
            <option value="BLOCKED">BLOCKED</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Expiry</label>
          <input
            className="input-field"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(event) => updateField('expiresAt', event.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Settlement Notes</label>
          <textarea
            className="input-field min-h-28"
            value={form.settlementNotes ?? ''}
            onChange={(event) => updateField('settlementNotes', event.target.value)}
            placeholder="Describe policy constraints, escrow requirements, or timing preferences."
          />
        </div>
      </div>
    </Modal>
  );
}
