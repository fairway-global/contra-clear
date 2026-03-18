import { Hono } from 'hono';
import * as store from '../db/store.js';

const app = new Hono();

// Get all trades
app.get('/', (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  return c.json(store.getAllTrades(limit));
});

// Get trades for a specific wallet
app.get('/wallet/:walletAddress', (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  return c.json(store.getTradesByWallet(c.req.param('walletAddress'), limit));
});

// Get a specific trade
app.get('/:id', (c) => {
  const trade = store.getTrade(c.req.param('id'));
  if (!trade) return c.json({ error: 'Trade not found' }, 404);
  return c.json(trade);
});

export default app;
