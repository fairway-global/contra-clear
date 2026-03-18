import { Hono } from 'hono';
import { getChannelBalances, getOnChainBalance } from '../services/contra.js';

// Known token mints for the demo
const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);

const app = new Hono();

// Get channel balances for a wallet
app.get('/channel/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const mints = DEMO_MINTS;
  if (mints.length === 0) {
    return c.json({ balances: [], warning: 'No DEMO_TOKEN_MINTS configured' });
  }
  const balances = await getChannelBalances(walletAddress, mints);
  return c.json({ balances });
});

// Get on-chain balances for a wallet
app.get('/onchain/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const mints = DEMO_MINTS;
  if (mints.length === 0) {
    return c.json({ balances: [], warning: 'No DEMO_TOKEN_MINTS configured' });
  }
  const balances = await Promise.all(mints.map(mint => getOnChainBalance(walletAddress, mint)));
  return c.json({ balances: balances.filter(b => b !== null) });
});

// Get all balances (channel + on-chain) for a wallet
app.get('/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress');
  const mints = DEMO_MINTS;

  const [channelBalances, onChainBalances] = await Promise.all([
    getChannelBalances(walletAddress, mints),
    Promise.all(mints.map(mint => getOnChainBalance(walletAddress, mint))),
  ]);

  return c.json({
    channel: channelBalances,
    onChain: onChainBalances.filter(b => b !== null),
  });
});

export default app;
