import { getDb } from '../db/store.js';
import { getChannelBalance } from './contra.js';

const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);

// Calculate net trade + withdrawal adjustments for a wallet
export function getAdjustments(walletAddress: string): Map<string, bigint> {
  const db = getDb();
  const adjustments = new Map<string, bigint>();

  // Trade adjustments
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

  // Withdrawal adjustments (confirmed withdrawals reduce balance)
  const withdrawals = db.prepare(
    "SELECT * FROM withdrawals WHERE status = 'confirmed' AND wallet_address = ?"
  ).all(walletAddress) as any[];

  for (const w of withdrawals) {
    const adj = adjustments.get(w.token_mint) || 0n;
    adjustments.set(w.token_mint, adj - BigInt(w.amount));
  }

  return adjustments;
}

// Get effective balance for a specific token (channel + adjustments)
export async function getEffectiveBalance(walletAddress: string, tokenMint: string): Promise<bigint> {
  const channelBal = await getChannelBalance(walletAddress, tokenMint);
  const rawChannel = BigInt(channelBal?.amount || '0');
  const adjustments = getAdjustments(walletAddress);
  const adj = adjustments.get(tokenMint) || 0n;
  const effective = rawChannel + adj;
  return effective < 0n ? 0n : effective;
}

export function getDecimals(mint: string): number {
  if (mint === DEMO_MINTS[0]) return 6;
  if (mint === DEMO_MINTS[1]) return 9;
  return 6;
}
