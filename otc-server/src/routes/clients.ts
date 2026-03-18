import { Hono } from 'hono';
import * as store from '../db/store.js';

const app = new Hono();

app.post('/register', async (c) => {
  const { walletAddress, label } = await c.req.json();
  if (!walletAddress) return c.json({ error: 'walletAddress required' }, 400);
  const client = store.registerClient(walletAddress, label || '');
  return c.json(client);
});

app.get('/', (c) => {
  return c.json(store.getClients());
});

app.get('/:walletAddress', (c) => {
  const client = store.getClient(c.req.param('walletAddress'));
  if (!client) return c.json({ error: 'Client not found' }, 404);
  return c.json(client);
});

export default app;
