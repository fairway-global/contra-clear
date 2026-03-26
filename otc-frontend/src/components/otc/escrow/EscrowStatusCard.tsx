import { formatRawAmount, getTokenSymbol } from '../../../lib/constants';
import type { EscrowObligation } from '../../../lib/otc/types';
import { ESCROW_STATUS_LABELS, EscrowStatus, USER_ROLE_LABELS } from '../../../lib/otc/types';

interface EscrowStatusCardProps {
  escrows: EscrowObligation[];
}

const STATUS_STYLES: Record<EscrowStatus, string> = {
  [EscrowStatus.NotStarted]: 'text-terminal-dim',
  [EscrowStatus.DepositRequested]: 'text-terminal-amber',
  [EscrowStatus.PendingOnChain]: 'text-terminal-amber',
  [EscrowStatus.ConfirmedOnChain]: 'text-terminal-accent',
  [EscrowStatus.CreditedInContra]: 'text-terminal-accent',
  [EscrowStatus.LockedForSettlement]: 'text-terminal-accent',
  [EscrowStatus.Released]: 'text-terminal-green',
  [EscrowStatus.Withdrawn]: 'text-terminal-green',
  [EscrowStatus.Failed]: 'text-terminal-red',
  [EscrowStatus.Expired]: 'text-terminal-red',
};

export default function EscrowStatusCard({ escrows }: EscrowStatusCardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {escrows.map((escrow) => (
        <div key={escrow.id} className="rounded border border-terminal-border bg-terminal-bg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-terminal-dim">
                {USER_ROLE_LABELS[escrow.partyRole]} Escrow
              </div>
              <div className="mt-1 font-mono text-sm text-terminal-text">{escrow.partyName || 'Pending assignment'}</div>
            </div>
            <span className={`text-xs font-mono uppercase tracking-wider ${STATUS_STYLES[escrow.status]}`}>
              {ESCROW_STATUS_LABELS[escrow.status]}
            </span>
          </div>
          <div className="mt-4 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-terminal-dim">Required Amount</span>
              <span className="text-terminal-accent">
                {escrow.amount === '0' ? 'TBD' : `${formatRawAmount(escrow.amount, escrow.tokenMint)} ${getTokenSymbol(escrow.tokenMint)}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-terminal-dim">Token</span>
              <span className="text-terminal-text">{getTokenSymbol(escrow.tokenMint)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-terminal-dim">Status</span>
              <span className={`${escrow.status === EscrowStatus.Released ? 'text-terminal-green' : 'text-terminal-dim'}`}>
                {escrow.status === EscrowStatus.Released ? 'Settled via Contra channel' : escrow.status === EscrowStatus.LockedForSettlement ? 'Pending settlement signature' : ESCROW_STATUS_LABELS[escrow.status]}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
