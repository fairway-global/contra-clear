import { useState, useEffect } from 'react';
import { getAdminOverview, getAdminTrades, getAdminDeposits, getAdminWithdrawals, getClients, type AdminOverview, type Client } from '../../lib/api';
import { truncateAddress, timeAgo } from '../../lib/constants';
import { useWSRefresh } from '../../hooks/useWebSocket';
import Panel from '../layout/Panel';

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const load = async () => {
    try {
      const [o, c, t, d, w] = await Promise.all([
        getAdminOverview(), getClients(), getAdminTrades(), getAdminDeposits(), getAdminWithdrawals()
      ]);
      setOverview(o); setClients(c); setTrades(t); setDeposits(d); setWithdrawals(w);
    } catch (err) { console.error('Admin load failed:', err); }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-time refresh on all events
  useWSRefresh(['rfq_created', 'quote_submitted', 'trade_completed', 'deposit_credited', 'withdrawal_confirmed'], load);

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Clients', value: overview?.clients ?? '—' },
          { label: 'Deposits', value: overview?.deposits ?? '—' },
          { label: 'Active RFQs', value: overview?.activeRFQs ?? '—' },
          { label: 'Trades', value: overview?.totalTrades ?? '—' },
          { label: 'Filled', value: overview?.completedTrades ?? '—' },
          { label: 'Contra Slot', value: overview?.contraSlot?.toLocaleString() ?? '—' },
        ].map(s => (
          <div key={s.label} className="panel p-4 text-center">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Clients */}
        <Panel title={`Registered Clients (${clients.length})`}>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {clients.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-2 py-1.5 text-xs font-mono">
                <span className="text-terminal-accent">{truncateAddress(c.walletAddress || c.wallet_address, 6)}</span>
                <span className="text-terminal-dim">{c.label || '—'}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Recent Deposits — human-readable amounts */}
        <Panel title={`Recent Deposits (${deposits.length})`}>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {deposits.slice(0, 20).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between px-2 py-1.5 text-xs font-mono">
                <span>{truncateAddress(d.wallet_address)}</span>
                <span className="text-terminal-accent">{d.amount_display || d.amount}</span>
                <span className={d.status === 'credited' ? 'text-terminal-green' : 'text-terminal-amber'}>{d.status}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* All Trades — human-readable amounts */}
      <Panel title={`All Trades (${trades.length})`}>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          <div className="grid grid-cols-7 gap-2 text-xs font-mono text-terminal-dim px-2 py-1 uppercase tracking-wider">
            <span>Party A</span><span>Party B</span><span>Sell</span><span>Buy</span><span>Price</span><span>Status</span><span>Time</span>
          </div>
          {trades.map((t: any) => (
            <div key={t.id} className="grid grid-cols-7 gap-2 text-xs font-mono px-2 py-1.5 hover:bg-terminal-muted/30 rounded">
              <span>{truncateAddress(t.party_a)}</span>
              <span>{truncateAddress(t.party_b)}</span>
              <span className="text-terminal-red">{t.sell_display || t.sell_amount}</span>
              <span className="text-terminal-green">{t.buy_display || t.buy_amount}</span>
              <span>{t.price}</span>
              <span className={t.status === 'completed' ? 'text-terminal-green' : 'text-terminal-amber'}>{t.status}</span>
              <span className="text-terminal-dim">{timeAgo(t.created_at)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Withdrawals — human-readable */}
      <Panel title={`Withdrawals (${withdrawals.length})`}>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {withdrawals.slice(0, 20).map((w: any) => (
            <div key={w.id} className="flex items-center justify-between px-2 py-1.5 text-xs font-mono">
              <span>{truncateAddress(w.wallet_address)}</span>
              <span>{w.amount_display || w.amount}</span>
              <span className={w.status === 'confirmed' ? 'text-terminal-green' : 'text-terminal-amber'}>{w.status}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
