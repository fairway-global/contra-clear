import { Hono } from 'hono';
import { getChannelBalances, getOnChainBalance } from '../services/contra.js';
import { getDb } from '../db/store.js';
import type { ChannelBalance } from '../types.js';

const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);

const app = new Hono();

// Calculate trade adjustments for a wallet across all completed trades
function getTradeAdjustments(walletAddress: string): Map<string, bigint> {
  const db = getDb();
  const adjustments = new Map<string, bigint>();

  const trades = db.prepare(
    "SELECT * FROM trades WHERE status = 'completed' AND (party_a = ? OR party_b = ?)"
  ).all(walletAddress, walletAddress) as any[];

  for (const trade of trades) {
    const isPartyA = trade.party_a === walletAddress;
    if (isPartyA) {
      // Party A sold sellToken, received buyToken
      const sellAdj = adjustments.get(trade.sell_token) || 0n;
      adjustments.set(trade.sell_token, sellAdj - BigInt(trade.sell_amount));
      const buyAdj = adjustments.get(trade.buy_token) || 0n;
      adjustments.set(trade.buy_token, buyAdj + BigInt(trade.buy_amount));
    } else {
      // Party B sold buyToken, received sellToken
      const buyAdj = adjustments.get(trade.buy_token) || 0n;
      adjustments.set(trade.buy_token, buyAdj - BigInt(trade.buy_amount));
      const sellAdj = adjustments.get(trade.sell_token) || 0n;
      adjustments.set(trade.sell_token, sellAdj + BigInt(trade.sell_amount));
    }
  }

  return adjustments;
}

// Apply trade adjustments to channel balances
function applyAdjustments(balances: ChannelBalance[], adjustments: Map<string, bigint>): ChannelBalance[] {
  const result = [...balances];

  for (const [mint, adj] of adjustments) {
    const existing = result.find(b => b.mint === mint);
    if (existing) {
      const newAmount = BigInt(existing.amount) + adj;
      const clampedAmount = newAmount < 0n ? 0n : newAmount;
      existing.amount = clampedAmount.toString();
      existing.uiAmount = Number(clampedAmount) / Math.pow(10, existing.decimals);
    } else if (adj > 0n) {
      // Received a token we didn't have before — find decimals from DEMO_MINTS
      const decimals = mint === DEMO_MINTS[0] ? 6 : 9;
      result.push({
        mint,
        amount: adj.toString(),
        decimals,
        uiAmount: Number(adj) / Math.pow(10, decimals),
      });
    }
  }

  return result;
}

// Get channel balances for a wallet (with trade adjustments)
app.get('/channel/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  if (DEMO_MINTS.length === 0) return c.json({ balances: [], warning: 'No DEMO_TOKEN_MINTS configured' });

  const balances = await getChannelBalances(walletAddress, DEMO_MINTS);
  const adjustments = getTradeAdjustments(walletAddress);
  return c.json({ balances: applyAdjustments(balances, adjustments) });
});

// Get on-chain balances for a wallet
app.get('/onchain/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  if (DEMO_MINTS.length === 0) return c.json({ balances: [], warning: 'No DEMO_TOKEN_MINTS configured' });

  const balances = await Promise.all(DEMO_MINTS.map(mint => getOnChainBalance(walletAddress, mint)));
  return c.json({ balances: balances.filter(b => b !== null) });
});

// Get all balances (channel + on-chain + trade adjustments)
app.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');

  const [channelBalances, onChainBalances] = await Promise.all([
    getChannelBalances(walletAddress, DEMO_MINTS),
    Promise.all(DEMO_MINTS.map(mint => getOnChainBalance(walletAddress, mint))),
  ]);

  const adjustments = getTradeAdjustments(walletAddress);

  return c.json({
    channel: applyAdjustments(channelBalances, adjustments),
    onChain: onChainBalances.filter(b => b !== null),
  });
});

export default app;
