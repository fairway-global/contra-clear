import { useState } from 'react';
import type { EscrowObligation } from '../../types/platform';
import { formatAmount } from '../../lib/platformFormat';
import Modal from '../ui/Modal';

interface DepositEscrowModalProps {
  open: boolean;
  obligation: EscrowObligation | null;
  onClose: () => void;
  onSubmit: (txHash: string) => Promise<void>;
}

export default function DepositEscrowModal({ open, obligation, onClose, onSubmit }: DepositEscrowModalProps) {
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!obligation) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(txHash);
      setTxHash('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deposit Escrow"
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!txHash || submitting}>
            {submitting ? 'Confirming...' : 'Confirm Escrow Deposit'}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
          <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Required Deposit</div>
          <div className="mt-2 text-lg font-semibold">{formatAmount(obligation.amount, obligation.asset)}</div>
          <div className="mt-2 font-mono text-xs text-terminal-dim">
            Status: {obligation.status} | Contra credited: {obligation.creditedInContra ? 'Yes' : 'No'}
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-xs uppercase tracking-wider text-terminal-dim">Transaction Hash</label>
          <input className="input-field" value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." />
        </div>
      </div>
    </Modal>
  );
}
