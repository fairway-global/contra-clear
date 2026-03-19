import { useState } from 'react';
import toast from 'react-hot-toast';
import type { AuthProfile, EscrowObligation } from '../types/platform';
import { getVisibleEscrowObligations } from '../lib/platformService';
import { formatAmount, formatDateTime } from '../lib/platformFormat';
import { usePlatform } from '../hooks/usePlatform';
import DepositEscrowModal from '../components/platform/DepositEscrowModal';
import Panel from '../components/layout/Panel';

export default function EscrowPage({ profile }: { profile: AuthProfile }) {
  const { submitEscrowDeposit } = usePlatform();
  const [selectedObligation, setSelectedObligation] = useState<EscrowObligation | null>(null);
  const obligations = getVisibleEscrowObligations(profile.user);

  const canFund = (obligation: EscrowObligation) => {
    if (obligation.status === 'CONFIRMED') return false;
    if (profile.user.role === 'BANK') return obligation.partyRole === 'BANK';
    return obligation.organizationId === profile.organization.id;
  };

  return (
    <div className="space-y-6">
      <Panel title="Escrow Monitor">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {obligations.map((obligation) => (
            <div key={obligation.id} className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">{obligation.partyRole} leg</div>
                <span className="rounded-full bg-terminal-accent/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-terminal-accent">
                  {obligation.status}
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold">{formatAmount(obligation.amount, obligation.asset)}</div>
              <div className="mt-3 grid gap-1 font-mono text-xs text-terminal-dim">
                <div>Confirmation: {obligation.confirmationState}</div>
                <div>Updated: {formatDateTime(obligation.updatedAt)}</div>
                <div className="break-all">Tx: {obligation.txHash ?? 'Awaiting funding'}</div>
              </div>
              {canFund(obligation) ? (
                <button type="button" className="btn-primary mt-4 w-full" onClick={() => setSelectedObligation(obligation)}>
                  Confirm Deposit
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      <DepositEscrowModal
        open={Boolean(selectedObligation)}
        obligation={selectedObligation}
        onClose={() => setSelectedObligation(null)}
        onSubmit={async (txHash) => {
          try {
            if (!selectedObligation) throw new Error('No obligation selected.');
            await submitEscrowDeposit(profile.user.id, selectedObligation.id, txHash);
            toast.success('Escrow updated');
          } catch (err: any) {
            toast.error(err.message || 'Unable to update escrow');
            throw err;
          }
        }}
      />
    </div>
  );
}
