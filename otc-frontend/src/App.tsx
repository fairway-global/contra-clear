import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { RFQ } from './lib/api';
import { useAuth } from './hooks/useAuth';

import Header from './components/layout/Header';
import WalletConnect from './components/wallet/WalletConnect';
import BalanceCard from './components/portfolio/BalanceCard';
import TradeHistory from './components/portfolio/TradeHistory';
import DepositPanel from './components/deposit/DepositPanel';
import WithdrawPanel from './components/withdraw/WithdrawPanel';
import RFQList from './components/trading/RFQList';
import CreateRFQ from './components/trading/CreateRFQ';
import QuotePanel from './components/trading/QuotePanel';
import PendingTrades from './components/trading/PendingTrades';
import TradeTicker from './components/trading/TradeTicker';
import AdminDashboard from './components/admin/AdminDashboard';

export default function App() {
  const { publicKey } = useWallet();
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const { authenticated, loading: authLoading } = useAuth();

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-terminal-bg">
        <Header activeView={activeView} onViewChange={setActiveView} />
        <WalletConnect />
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-3 h-3 rounded-full bg-terminal-accent animate-pulse mx-auto mb-3" />
          <span className="font-mono text-sm text-terminal-dim">Authenticating wallet...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-bg flex flex-col">
      <Header activeView={activeView} onViewChange={setActiveView} />

      <main className="flex-1 p-4">
        {activeView === 'dashboard' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1"><BalanceCard /></div>
            <div className="col-span-2"><TradeHistory /></div>
          </div>
        )}

        {activeView === 'trade' && (
          <div className="space-y-4">
            <PendingTrades />
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <RFQList onSelectRFQ={setSelectedRFQ} selectedRFQId={selectedRFQ?.id} />
              </div>
              <div className="col-span-4 space-y-4">
                <CreateRFQ onCreated={() => setSelectedRFQ(null)} />
                <QuotePanel rfq={selectedRFQ} onTradeComplete={() => setSelectedRFQ(null)} />
              </div>
              <div className="col-span-4">
                <TradeTicker />
              </div>
            </div>
          </div>
        )}

        {activeView === 'deposit' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1"><DepositPanel /></div>
            <div className="col-span-2"><BalanceCard /></div>
          </div>
        )}

        {activeView === 'withdraw' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1"><WithdrawPanel /></div>
            <div className="col-span-2"><BalanceCard /></div>
          </div>
        )}

        {activeView === 'admin' && <AdminDashboard />}
      </main>

      {/* Footer status bar */}
      <footer className="border-t border-terminal-border px-6 py-2 flex items-center justify-between text-xs font-mono text-terminal-dim">
        <span>CONTRA OTC DESK — DEMO ONLY — NOT FOR PRODUCTION USE</span>
        <span>Gateway: localhost:8899 | Validator: localhost:18899</span>
      </footer>
    </div>
  );
}
