import type { EscrowObligation } from '../../types/platform';
import { formatAmount, formatDateTime } from '../../lib/platformFormat';
import Panel from '../layout/Panel';

export default function EscrowStatusCard({
  institutionName,
  bankName,
  obligations,
}: {
  institutionName: string;
  bankName: string;
  obligations: EscrowObligation[];
}) {
  const institutionObligation = obligations.find((item) => item.partyRole === 'INSTITUTION');
  const bankObligation = obligations.find((item) => item.partyRole === 'BANK');

  const renderObligation = (label: string, obligation?: EscrowObligation) => {
    if (!obligation) {
      return (
        <div className="rounded-lg border border-dashed border-terminal-border p-4 font-mono text-xs text-terminal-dim">
          {label} obligation not created yet.
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-terminal-border bg-terminal-bg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">{label}</div>
            <div className="mt-1 text-sm font-semibold">{formatAmount(obligation.amount, obligation.asset)}</div>
          </div>
          <span className="rounded-full bg-terminal-accent/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-terminal-accent">
            {obligation.status}
          </span>
        </div>
        <div className="mt-3 grid gap-2 font-mono text-xs text-terminal-dim">
          <div className="flex items-center justify-between">
            <span>Confirmation</span>
            <span className="text-terminal-text">{obligation.confirmationState}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Contra credited</span>
            <span className="text-terminal-text">{obligation.creditedInContra ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Updated</span>
            <span className="text-terminal-text">{formatDateTime(obligation.updatedAt)}</span>
          </div>
          <div className="break-all">
            <span>Tx hash:</span>{' '}
            <span className="text-terminal-text">{obligation.txHash ?? 'Awaiting funding'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Panel title="Escrow Status">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {renderObligation(`${institutionName} deposit`, institutionObligation)}
          {renderObligation(`${bankName} deposit`, bankObligation)}
        </div>
      </div>
    </Panel>
  );
}
