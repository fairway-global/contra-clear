import { Hono } from 'hono';
import { verifyAndCreateSession, revokeSession } from '../services/auth.js';
import * as store from '../db/store.js';

const app = new Hono();

// Login: verify wallet signature and return a session token
app.post('/login', async (c) => {
  const { walletAddress, message, signature } = await c.req.json();
  if (!walletAddress || !message || !signature) {
    return c.json({ error: 'walletAddress, message, and signature are required' }, 400);
  }

  try {
    const token = verifyAndCreateSession(walletAddress, message, signature);
    // Auto-register as client
    store.registerClient(walletAddress, '');
    return c.json({ token, walletAddress });
  } catch (err: any) {
    return c.json({ error: err.message }, 401);
  }
});

// Logout
app.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    revokeSession(authHeader.slice(7));
  }
  return c.json({ success: true });
});

export default app;
