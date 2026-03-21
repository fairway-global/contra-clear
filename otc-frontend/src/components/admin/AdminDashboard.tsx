import { useEffect, useMemo, useState } from 'react';
import {
  getAdminDeposits,
  getAdminOverview,
  getAdminTrades,
  getAdminWithdrawals,
  getClients,
  getHealth,
  type AdminDepositRow,
  type AdminOverview,
  type AdminTradeRow,
  type AdminWithdrawalRow,
  type Client,
  type HealthResponse,
} from '../../lib/api';
import { timeAgo, truncateAddress } from '../../lib/constants';
import { useWSRefresh } from '../../hooks/useWebSocket';
import Panel from '../layout/Panel';

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [trades, setTrades] = useState<AdminTradeRow[]>([]);
  const [deposits, setDeposits] = useState<AdminDepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRow[]>([]);

  const load = async () => {
    try {
      const [nextOverview, nextHealth, nextClients, nextTrades, nextDeposits, nextWithdrawals] = await Promise.all([
        getAdminOverview(),
        getHealth(),
        getClients(),
        getAdminTrades(),
        getAdminDeposits(),
        getAdminWithdrawals(),
      ]);

      setOverview(nextOverview);
      setHealth(nextHealth);
      setClients(nextClients);
      setTrades(nextTrades);
      setDeposits(nextDeposits);
      setWithdrawals(nextWithdrawals);
    } catch (error) {
      console.error('Admin operations load failed:', error);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 10000);
    return () => window.clearInterval(interval);
  }, []);

  useWSRefresh(['trade_completed', 'deposit_credited', 'withdrawal_confirmed'], load);

  const depositPendingCount = useMemo(
    () => deposits.filter((row) => row.status !== 'credited' && row.status !== 'failed').length,
    [deposits],
  );
  const depositCreditedCount = useMemo(
    () => deposits.filter((row) => row.status === 'credited').length,
    [deposits],
  );
  const withdrawalPendingCount = useMemo(
    () => withdrawals.filter((row) => row.status !== 'confirmed' && row.status !== 'failed').length,
    [withdrawals],
  );

  const stats = [
    { label: 'Contra Slot', value: (health?.contraSlot ?? overview?.contraSlot)?.toLocaleString() ?? '-' },
    { label: 'Clients', value: overview?.clients ?? '-' },
    { label: 'Pending Deposits', value: depositPendingCount },
    { label: 'Credited Deposits', value: depositCreditedCount },
    { label: 'Pending Withdrawals', value: withdrawalPendingCount },
    { label: 'Completed Trades', value: overview?.completedTrades ?? '-' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="panel p-4 text-center">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <Panel title="Contra Status">
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between rounded border border-terminal-border bg-terminal-bg px-3 py-3">
              <span className="text-terminal-dim">Gateway</span>
              <span className={health?.status === 'ok' ? 'text-terminal-green' : 'text-terminal-amber'}>
                {health?.status || 'unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border border-terminal-border bg-terminal-bg px-3 py-3">
              <span className="text-terminal-dim">Active RFQs</span>
              <span className="text-terminal-text">{overview?.activeRFQs ?? '-'}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-terminal-border bg-terminal-bg px-3 py-3">
              <span className="text-terminal-dim">Total Trades</span>
              <span className="text-terminal-text">{overview?.totalTrades ?? '-'}</span>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg p-3">
              <div className="text-[11px] uppercase tracking-wider text-terminal-dim">Registered Desks</div>
              <div className="mt-3 space-y-2">
                {clients.slice(0, 6).map((client) => (
                  <div key={client.id} className="flex items-center justify-between gap-3">
                    <span className="text-terminal-accent">{truncateAddress(client.walletAddress, 6)}</span>
                    <span className="text-terminal-dim">{client.label || 'Unlabeled'}</span>
                  </div>
                ))}
                {clients.length === 0 ? (
                  <div className="text-terminal-dim">No registered desks.</div>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Transaction Monitor">
          {trades.length === 0 ? (
            <div className="py-8 text-center font-mono text-sm text-terminal-dim">No trades recorded yet.</div>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto">
              <div className="grid grid-cols-[0.9fr_0.9fr_1fr_1fr_0.6fr_0.7fr_0.7fr] gap-2 px-2 pb-2 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
                <span>Party A</span>
                <span>Party B</span>
                <span>Sell</span>
                <span>Buy</span>
                <span>Price</span>
                <span>Status</span>
                <span>Time</span>
              </div>
              {trades.slice(0, 20).map((trade) => (
                <div
                  key={trade.id}
                  className="grid grid-cols-[0.9fr_0.9fr_1fr_1fr_0.6fr_0.7fr_0.7fr] gap-2 rounded px-2 py-2 font-mono text-xs hover:bg-terminal-muted/30"
                >
                  <span className="text-terminal-text">{truncateAddress(trade.party_a)}</span>
                  <span className="text-terminal-text">{truncateAddress(trade.party_b)}</span>
                  <span className="text-terminal-red">{trade.sell_display}</span>
                  <span className="text-terminal-green">{trade.buy_display}</span>
                  <span className="text-terminal-text">{trade.price}</span>
                  <span className={trade.status === 'completed' ? 'text-terminal-green' : 'text-terminal-amber'}>
                    {trade.status}
                  </span>
                  <span className="text-terminal-dim">{timeAgo(trade.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Deposit Progress">
          {deposits.length === 0 ? (
            <div className="py-8 text-center font-mono text-sm text-terminal-dim">No deposits recorded yet.</div>
          ) : (
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {deposits.slice(0, 14).map((deposit) => (
                <div key={deposit.id} className="grid grid-cols-[1fr_0.9fr_0.8fr_0.7fr] gap-3 rounded px-2 py-2 font-mono text-xs hover:bg-terminal-muted/30">
                  <span className="text-terminal-text">{truncateAddress(deposit.wallet_address)}</span>
                  <span className="text-terminal-accent">{deposit.amount_display}</span>
                  <span className={deposit.status === 'credited' ? 'text-terminal-green' : 'text-terminal-amber'}>
                    {deposit.status}
                  </span>
                  <span className="text-terminal-dim">{timeAgo(deposit.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Withdrawal Progress">
          {withdrawals.length === 0 ? (
            <div className="py-8 text-center font-mono text-sm text-terminal-dim">No withdrawals recorded yet.</div>
          ) : (
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {withdrawals.slice(0, 14).map((withdrawal) => (
                <div key={withdrawal.id} className="grid grid-cols-[1fr_0.9fr_0.8fr_0.7fr] gap-3 rounded px-2 py-2 font-mono text-xs hover:bg-terminal-muted/30">
                  <span className="text-terminal-text">{truncateAddress(withdrawal.wallet_address)}</span>
                  <span className="text-terminal-accent">{withdrawal.amount_display}</span>
                  <span className={withdrawal.status === 'confirmed' ? 'text-terminal-green' : 'text-terminal-amber'}>
                    {withdrawal.status}
                  </span>
                  <span className="text-terminal-dim">{timeAgo(withdrawal.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
