import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletTrades } from '../../hooks/useTrades';
import { getTokenSymbol, truncateAddress, timeAgo, formatRawAmount } from '../../lib/constants';
import Panel from '../layout/Panel';

export default function TradeHistory() {
  const { publicKey } = useWallet();
  const { trades, loading } = useWalletTrades();

  return (
    <Panel title="Your Trade History">
      {trades.length === 0 ? (
        <div className="text-center py-8 text-terminal-dim font-mono text-sm">
          {loading ? 'Loading...' : 'No trades yet'}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-6 gap-2 text-xs font-mono text-terminal-dim px-2 py-1 uppercase tracking-wider">
            <span>Pair</span>
            <span>Side</span>
            <span className="text-right">Sold</span>
            <span className="text-right">Received</span>
            <span>Counterparty</span>
            <span className="text-right">Time</span>
          </div>
          {trades.map(trade => {
            const isPartyA = publicKey?.toString() === trade.partyA;
            const side = isPartyA ? 'SELL' : 'BUY';
            const counterparty = isPartyA ? trade.partyB : trade.partyA;
            const soldAmount = isPartyA
              ? `${formatRawAmount(trade.sellAmount, trade.sellToken)} ${getTokenSymbol(trade.sellToken)}`
              : `${formatRawAmount(trade.buyAmount, trade.buyToken)} ${getTokenSymbol(trade.buyToken)}`;
            const receivedAmount = isPartyA
              ? `${formatRawAmount(trade.buyAmount, trade.buyToken)} ${getTokenSymbol(trade.buyToken)}`
              : `${formatRawAmount(trade.sellAmount, trade.sellToken)} ${getTokenSymbol(trade.sellToken)}`;

            return (
              <div
                key={trade.id}
                className={`grid grid-cols-6 gap-2 text-xs font-mono px-2 py-2 rounded hover:bg-terminal-muted/30 transition-colors ${
                  trade.status === 'completed' ? '' : 'opacity-50'
                }`}
              >
                <span>{getTokenSymbol(trade.sellToken)}/{getTokenSymbol(trade.buyToken)}</span>
                <span className={isPartyA ? 'text-terminal-red' : 'text-terminal-green'}>{side}</span>
                <span className="text-right text-terminal-red">{soldAmount}</span>
                <span className="text-right text-terminal-green">{receivedAmount}</span>
                <span className="text-terminal-dim">{truncateAddress(counterparty)}</span>
                <span className="text-right text-terminal-dim" title={trade.createdAt}>
                  {timeAgo(trade.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
