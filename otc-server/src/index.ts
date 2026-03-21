import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import depositsRouter from './routes/deposits.js';
import balancesRouter from './routes/balances.js';
import rfqRouter from './routes/rfq.js';
import tradesRouter from './routes/trades.js';
import withdrawalsRouter from './routes/withdrawals.js';

import { getAllDeposits, getDb } from './db/store.js';
import { getSlot, GATEWAY_URL, VALIDATOR_URL } from './services/contra.js';
import { getSessionWallet } from './services/auth.js';
import { startWebSocketServer, broadcast } from './services/ws.js';
import { reconcileDeposits } from './services/deposit-status.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Auth middleware: protect mutation endpoints
// GET requests and /api/auth/* are public
app.use('/api/*', async (c, next) => {
  // Public endpoints — no auth required
  const path = c.req.path;
  if (path.startsWith('/api/auth/')) return next();
  if (c.req.method === 'GET') return next();

  // Check Authorization header
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required. Please connect your wallet.' }, 401);
  }

  const token = authHeader.slice(7);
  const wallet = getSessionWallet(token);
  if (!wallet) {
    return c.json({ error: 'Session expired. Please reconnect your wallet.' }, 401);
  }

  // Attach wallet to request headers for downstream use
  c.req.raw.headers.set('x-wallet', wallet);
  return next();
});

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
app.route('/api/auth', authRouter);
app.route('/api/clients', clientsRouter);
app.route('/api/deposit', depositsRouter);
app.route('/api/balances', balancesRouter);
app.route('/api/rfq', rfqRouter);
app.route('/api/trades', tradesRouter);
app.route('/api/withdraw', withdrawalsRouter);

// Token decimals for admin display
const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);
const TOKEN_META: Record<string, { symbol: string; decimals: number }> = {};
if (DEMO_MINTS[0]) TOKEN_META[DEMO_MINTS[0]] = { symbol: 'USDC', decimals: 6 };
if (DEMO_MINTS[1]) TOKEN_META[DEMO_MINTS[1]] = { symbol: 'wSOL', decimals: 9 };

function formatRaw(amount: string, mint: string): string {
  const meta = TOKEN_META[mint];
  if (!meta) return amount;
  const human = parseFloat(amount) / Math.pow(10, meta.decimals);
  return `${human.toFixed(meta.decimals > 6 ? 4 : 2)} ${meta.symbol}`;
}

// Admin endpoints
app.get('/api/admin/overview', async (c) => {
  const db = getDb();
  const clients = db.prepare('SELECT COUNT(*) as count FROM clients').get() as any;
  const deposits = db.prepare('SELECT COUNT(*) as count FROM deposits').get() as any;
  const activeRFQs = db.prepare("SELECT COUNT(*) as count FROM rfqs WHERE status IN ('active','quoted')").get() as any;
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

app.get('/api/admin/clients', (c) => {
  return c.json(getDb().prepare('SELECT * FROM clients ORDER BY created_at DESC').all());
});

app.get('/api/admin/trades', (c) => {
  const rows = getDb().prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT 100').all() as any[];
  return c.json(rows.map(r => ({
    ...r,
    sell_display: formatRaw(r.sell_amount, r.sell_token),
    buy_display: formatRaw(r.buy_amount, r.buy_token),
  })));
});

app.get('/api/admin/deposits', async (c) => {
  const rows = await reconcileDeposits(getAllDeposits(100));
  return c.json(rows.map(r => ({
    ...r,
    wallet_address: r.walletAddress,
    token_mint: r.tokenMint,
    tx_signature: r.txSignature,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    amount_display: formatRaw(r.amount, r.tokenMint),
  })));
});

app.get('/api/admin/withdrawals', (c) => {
  const rows = getDb().prepare('SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 100').all() as any[];
  return c.json(rows.map(r => ({
    ...r,
    amount_display: formatRaw(r.amount, r.token_mint),
  })));
});

// Initialize database
getDb();

const PORT = parseInt(process.env.OTC_PORT || '3001');
const WS_PORT = parseInt(process.env.WS_PORT || '3002');

console.log(`
  ╔══════════════════════════════════════════╗
  ║       Contra OTC Trading Desk           ║
  ║                                          ║
  ║  API Server: http://localhost:${PORT}       ║
  ║  WebSocket:  ws://localhost:${WS_PORT}         ║
  ║  Gateway:    ${GATEWAY_URL}    ║
  ║  Solana RPC: ${VALIDATOR_URL} ║
  ╚══════════════════════════════════════════╝
`);

serve({ fetch: app.fetch, port: PORT });
startWebSocketServer(WS_PORT);

// Export broadcast for use in route handlers
export { broadcast };
