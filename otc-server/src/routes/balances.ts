import { Hono } from 'hono';
import { getChannelBalances, getMintDecimals, getOnChainBalances } from '../services/contra.js';
import { getAdjustments } from '../services/effective-balance.js';
import type { ChannelBalance } from '../types.js';

const app = new Hono();

async function applyAdjustments(balances: ChannelBalance[], adjustments: Map<string, bigint>): Promise<ChannelBalance[]> {
  const result = balances.map(b => ({ ...b }));

  for (const [mint, adj] of adjustments) {
    const existing = result.find(b => b.mint === mint);
    if (existing) {
      const newAmount = BigInt(existing.amount) + adj;
      const clamped = newAmount < 0n ? 0n : newAmount;
      existing.amount = clamped.toString();
      existing.uiAmount = Number(clamped) / Math.pow(10, existing.decimals);
    } else if (adj > 0n) {
      try {
        const decimals = await getMintDecimals(mint);
        result.push({ mint, amount: adj.toString(), decimals, uiAmount: Number(adj) / Math.pow(10, decimals) });
      } catch {
        result.push({ mint, amount: adj.toString(), decimals: 6, uiAmount: Number(adj) / 1e6 });
      }
    }
  }

  return result;
}

async function safeGetChannelBalances(walletAddress: string): Promise<ChannelBalance[]> {
  try { return await getChannelBalances(walletAddress); } catch { return []; }
}

async function safeGetOnChainBalances(walletAddress: string): Promise<ChannelBalance[]> {
  try { return await getOnChainBalances(walletAddress); } catch { return []; }
}

app.get('/channel/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const balances = await safeGetChannelBalances(walletAddress);
  const adjustments = getAdjustments(walletAddress);
  return c.json({ balances: await applyAdjustments(balances, adjustments) });
});

app.get('/onchain/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  return c.json({ balances: await safeGetOnChainBalances(walletAddress) });
});

app.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const [channel, onChain] = await Promise.all([
    safeGetChannelBalances(walletAddress),
    safeGetOnChainBalances(walletAddress),
  ]);
  const adjustments = getAdjustments(walletAddress);
  return c.json({
    channel: await applyAdjustments(channel, adjustments),
    onChain,
  });
});

export default app;
