import { useEffect, useState } from 'react';
import ModalShell from '../../layout/ModalShell';
import { formatRawAmount, getTokenSymbol } from '../../../lib/constants';
import type { EscrowObligation, RFQ } from '../../../lib/otc/types';

interface DepositEscrowModalProps {
  open: boolean;
  rfq: RFQ | null;
  obligation: EscrowObligation | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (txHash: string) => Promise<void> | void;
}

export default function DepositEscrowModal({
  open,
  rfq,
  obligation,
  submitting,
  onClose,
  onSubmit,
}: DepositEscrowModalProps) {
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    if (open) {
      setTxHash('');
    }
  }, [open]);

  return (
    <ModalShell
      open={open}
      title={rfq ? `Submit Escrow Reference - ${rfq.reference}` : 'Submit Escrow Reference'}
      onClose={onClose}
      widthClassName="max-w-xl"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!txHash || submitting} onClick={() => void onSubmit(txHash)}>
            {submitting ? 'Submitting...' : 'Confirm Escrow Deposit'}
          </button>
        </>
      )}
    >
      {obligation ? (
        <div className="space-y-4">
          <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs">
            Deposit {formatRawAmount(obligation.amount, obligation.tokenMint)} {getTokenSymbol(obligation.tokenMint)} and record the tx hash below.
          </div>
          <div>
            <label className="mb-1 block text-xs font-mono uppercase tracking-wider text-terminal-dim">Escrow Tx Hash</label>
            <input className="input-field" value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="Paste on-chain or Contra reference" />
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}
