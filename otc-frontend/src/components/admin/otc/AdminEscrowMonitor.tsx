import Panel from '../../layout/Panel';
import { formatRawAmount, getTokenSymbol, timeAgo } from '../../../lib/constants';
import type { EscrowObligation, RFQStatus } from '../../../lib/otc/types';
import { ESCROW_STATUS_LABELS } from '../../../lib/otc/types';
import RFQStatusBadge from '../../otc/rfq/RFQStatusBadge';

interface AdminEscrowRow extends EscrowObligation {
  rfqReference: string;
  rfqStatus: RFQStatus;
}

interface AdminEscrowMonitorProps {
  escrows: AdminEscrowRow[];
  onOpenRFQ?: (rfqId: string) => void;
}

export default function AdminEscrowMonitor({ escrows, onOpenRFQ }: AdminEscrowMonitorProps) {
  return (
    <Panel title="Escrow Monitor">
      {escrows.length === 0 ? (
        <div className="py-8 text-center font-mono text-sm text-terminal-dim">No escrow obligations to monitor.</div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[0.9fr_1fr_1fr_0.8fr_0.8fr_0.7fr] gap-3 px-2 pb-2 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
            <span>RFQ</span>
            <span>Party</span>
            <span>Amount</span>
            <span>Escrow</span>
            <span>RFQ Status</span>
            <span>Updated</span>
          </div>
          {escrows.map((escrow) => (
            <button
              key={escrow.id}
              type="button"
              onClick={() => onOpenRFQ?.(escrow.rfqId)}
              className="grid w-full grid-cols-[0.9fr_1fr_1fr_0.8fr_0.8fr_0.7fr] gap-3 rounded px-2 py-2 text-left hover:bg-terminal-muted/30"
            >
              <span className="font-mono text-xs text-terminal-accent">{escrow.rfqReference}</span>
              <span className="font-mono text-xs text-terminal-text">{escrow.partyName}</span>
              <span className="font-mono text-xs text-terminal-text">
                {escrow.amount === '0' ? 'TBD' : `${formatRawAmount(escrow.amount, escrow.tokenMint)} ${getTokenSymbol(escrow.tokenMint)}`}
              </span>
              <span className="font-mono text-xs text-terminal-dim">{ESCROW_STATUS_LABELS[escrow.status]}</span>
              <span><RFQStatusBadge status={escrow.rfqStatus} /></span>
              <span className="font-mono text-xs text-terminal-dim">{timeAgo(escrow.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
