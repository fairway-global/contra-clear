import { Hono } from 'hono';
import * as store from '../db/store.js';
import { getEffectiveBalance, getDecimals } from '../services/effective-balance.js';
import { broadcast } from '../services/ws.js';

const app = new Hono();

// Request withdrawal — validates effective balance (channel + trade adjustments)
app.post('/', async (c) => {
  const { walletAddress, tokenMint, amount } = await c.req.json();
  if (!walletAddress || !tokenMint || !amount) {
    return c.json({ error: 'walletAddress, tokenMint, and amount are required' }, 400);
  }

  const available = await getEffectiveBalance(walletAddress, tokenMint);
  const requested = BigInt(amount);

  if (available < requested) {
    const decimals = getDecimals(tokenMint);
    const availHuman = (Number(available) / Math.pow(10, decimals)).toFixed(4);
    const reqHuman = (Number(requested) / Math.pow(10, decimals)).toFixed(4);
    return c.json({
      error: `Insufficient balance. Available: ${availHuman}, requested: ${reqHuman}`
    }, 400);
  }

  const withdrawal = store.createWithdrawal(walletAddress, tokenMint, amount);
  store.updateWithdrawal(withdrawal.id, { status: 'confirmed', channelTxSignature: 'otc-desk-processed' });

  broadcast({ type: 'withdrawal_confirmed', data: withdrawal });

  return c.json({
    ...store.getWithdrawal(withdrawal.id),
    message: 'Withdrawal submitted. OTC desk will release funds to your wallet.',
  });
});

app.get('/status/:id', (c) => {
  const withdrawal = store.getWithdrawal(c.req.param('id'));
  if (!withdrawal) return c.json({ error: 'Withdrawal not found' }, 404);
  return c.json(withdrawal);
});

export default app;
