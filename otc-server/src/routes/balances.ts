import { Hono } from 'hono';
import { getChannelBalances, getOnChainBalance } from '../services/contra.js';
import { getAdjustments } from '../services/effective-balance.js';
import type { ChannelBalance } from '../types.js';

const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);

const app = new Hono();

function applyAdjustments(balances: ChannelBalance[], adjustments: Map<string, bigint>): ChannelBalance[] {
  const result = balances.map(b => ({ ...b }));

  for (const [mint, adj] of adjustments) {
    const existing = result.find(b => b.mint === mint);
    if (existing) {
      const newAmount = BigInt(existing.amount) + adj;
      const clamped = newAmount < 0n ? 0n : newAmount;
      existing.amount = clamped.toString();
      existing.uiAmount = Number(clamped) / Math.pow(10, existing.decimals);
    } else if (adj > 0n) {
      const decimals = mint === DEMO_MINTS[0] ? 6 : 9;
      result.push({ mint, amount: adj.toString(), decimals, uiAmount: Number(adj) / Math.pow(10, decimals) });
    }
  }

  return result;
}

app.get('/channel/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  if (DEMO_MINTS.length === 0) return c.json({ balances: [], warning: 'No DEMO_TOKEN_MINTS configured' });
  const balances = await getChannelBalances(walletAddress, DEMO_MINTS);
  const adjustments = getAdjustments(walletAddress);
  return c.json({ balances: applyAdjustments(balances, adjustments) });
});

app.get('/onchain/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  if (DEMO_MINTS.length === 0) return c.json({ balances: [], warning: 'No DEMO_TOKEN_MINTS configured' });
  const balances = await Promise.all(DEMO_MINTS.map(mint => getOnChainBalance(walletAddress, mint)));
  return c.json({ balances: balances.filter(b => b !== null) });
});

app.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const [channelBalances, onChainBalances] = await Promise.all([
    getChannelBalances(walletAddress, DEMO_MINTS),
    Promise.all(DEMO_MINTS.map(mint => getOnChainBalance(walletAddress, mint))),
  ]);
  const adjustments = getAdjustments(walletAddress);
  return c.json({
    channel: applyAdjustments(channelBalances, adjustments),
    onChain: onChainBalances.filter(b => b !== null),
  });
});

export default app;
