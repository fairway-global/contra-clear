import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import clientsRouter from './routes/clients.js';
import depositsRouter from './routes/deposits.js';
import balancesRouter from './routes/balances.js';
import rfqRouter from './routes/rfq.js';
import tradesRouter from './routes/trades.js';
import withdrawalsRouter from './routes/withdrawals.js';

import { getDb } from './db/store.js';
import { getSlot, GATEWAY_URL, VALIDATOR_URL } from './services/contra.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/health', async (c) => {
  try {
    const slot = await getSlot();
    return c.json({ status: 'ok', contraSlot: slot, gatewayUrl: GATEWAY_URL, validatorUrl: VALIDATOR_URL });
  } catch {
    return c.json({ status: 'degraded', error: 'Cannot reach Contra gateway' }, 503);
  }
});

// API routes
app.route('/api/clients', clientsRouter);
app.route('/api/deposit', depositsRouter);
app.route('/api/balances', balancesRouter);
app.route('/api/rfq', rfqRouter);
app.route('/api/trades', tradesRouter);
app.route('/api/withdraw', withdrawalsRouter);

// Admin: overview of all system state
app.get('/api/admin/overview', async (c) => {
  const db = getDb();
  const clients = db.prepare('SELECT COUNT(*) as count FROM clients').get() as any;
  const deposits = db.prepare('SELECT COUNT(*) as count FROM deposits').get() as any;
  const activeRFQs = db.prepare("SELECT COUNT(*) as count FROM rfqs WHERE status = 'active'").get() as any;
  const completedTrades = db.prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'completed'").get() as any;
  const totalTrades = db.prepare('SELECT COUNT(*) as count FROM trades').get() as any;
  const withdrawals = db.prepare('SELECT COUNT(*) as count FROM withdrawals').get() as any;

  let contraSlot = 0;
  try { contraSlot = await getSlot(); } catch {}

  return c.json({
    clients: clients.count,
    deposits: deposits.count,
    activeRFQs: activeRFQs.count,
    completedTrades: completedTrades.count,
    totalTrades: totalTrades.count,
    withdrawals: withdrawals.count,
    contraSlot,
  });
});

// Admin: all clients with balances
app.get('/api/admin/clients', (c) => {
  const db = getDb();
  return c.json(db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all());
});

// Admin: all trades
app.get('/api/admin/trades', (c) => {
  const db = getDb();
  return c.json(db.prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT 100').all());
});

// Admin: all deposits
app.get('/api/admin/deposits', (c) => {
  const db = getDb();
  return c.json(db.prepare('SELECT * FROM deposits ORDER BY created_at DESC LIMIT 100').all());
});

// Admin: all withdrawals
app.get('/api/admin/withdrawals', (c) => {
  const db = getDb();
  return c.json(db.prepare('SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 100').all());
});

// Initialize database
getDb();

const PORT = parseInt(process.env.OTC_PORT || '3001');

console.log(`
  ╔══════════════════════════════════════════╗
  ║       Contra OTC Trading Desk           ║
  ║                                          ║
  ║  API Server: http://localhost:${PORT}       ║
  ║  Gateway:    ${GATEWAY_URL}    ║
  ║  Validator:  ${VALIDATOR_URL} ║
  ╚══════════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port: PORT });
