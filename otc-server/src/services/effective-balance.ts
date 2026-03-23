import { getDb } from '../db/store.js';
import { getChannelBalance, getMintDecimals } from './contra.js';

// Calculate trade adjustments for a wallet.
// Only trades need adjustment — they settle at the application level, not on-chain.
// Deposits and withdrawals are real on-chain operations reflected in the channel balance directly.
export function getAdjustments(walletAddress: string): Map<string, bigint> {
  const db = getDb();
  const adjustments = new Map<string, bigint>();

  const trades = db.prepare(
    "SELECT * FROM trades WHERE status = 'completed' AND (party_a = ? OR party_b = ?)"
  ).all(walletAddress, walletAddress) as any[];

  for (const trade of trades) {
    const isPartyA = trade.party_a === walletAddress;
    if (isPartyA) {
      const sellAdj = adjustments.get(trade.sell_token) || 0n;
      adjustments.set(trade.sell_token, sellAdj - BigInt(trade.sell_amount));
      const buyAdj = adjustments.get(trade.buy_token) || 0n;
      adjustments.set(trade.buy_token, buyAdj + BigInt(trade.buy_amount));
    } else {
      const buyAdj = adjustments.get(trade.buy_token) || 0n;
      adjustments.set(trade.buy_token, buyAdj - BigInt(trade.buy_amount));
      const sellAdj = adjustments.get(trade.sell_token) || 0n;
      adjustments.set(trade.sell_token, sellAdj + BigInt(trade.sell_amount));
    }
  }

  return adjustments;
}

// Get effective balance = real channel balance + trade adjustments
export async function getEffectiveBalance(walletAddress: string, tokenMint: string): Promise<bigint> {
  const channelBal = await getChannelBalance(walletAddress, tokenMint);
  const rawChannel = BigInt(channelBal?.amount || '0');
  const adjustments = getAdjustments(walletAddress);
  const adj = adjustments.get(tokenMint) || 0n;
  const effective = rawChannel + adj;
  return effective < 0n ? 0n : effective;
}

export async function getDecimals(mint: string): Promise<number> {
  return getMintDecimals(mint);
}
