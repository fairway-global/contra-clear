import type { DepositRecord } from '../types.js';
import * as store from '../db/store.js';
import { getChannelBalance } from './contra.js';
import { broadcast } from './ws.js';

export async function reconcileDepositStatus(deposit: DepositRecord | null): Promise<DepositRecord | null> {
  if (!deposit) return null;
  if (deposit.status === 'credited' || deposit.status === 'failed') return deposit;

  const balance = await getChannelBalance(deposit.walletAddress, deposit.tokenMint);
  if (!balance || BigInt(balance.amount) <= 0n) return deposit;

  store.updateDepositStatus(deposit.id, 'credited');
  const updated = store.getDeposit(deposit.id);

  if (updated) {
    broadcast({ type: 'deposit_credited', data: updated });
  }

  return updated;
}

export async function reconcileDeposits(deposits: DepositRecord[]): Promise<DepositRecord[]> {
  const results = await Promise.all(deposits.map(reconcileDepositStatus));
  return results.filter((deposit): deposit is DepositRecord => deposit !== null);
}
