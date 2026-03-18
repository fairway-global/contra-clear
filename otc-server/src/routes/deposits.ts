import { Hono } from 'hono';
import * as store from '../db/store.js';
import { buildDepositTransaction } from '../services/escrow.js';
import { checkTransactionConfirmed, getChannelBalance, VALIDATOR_URL } from '../services/contra.js';

const app = new Hono();

// Build a deposit transaction for the frontend to sign
app.post('/', async (c) => {
  const { walletAddress, tokenMint, amount } = await c.req.json();
  if (!walletAddress || !tokenMint || !amount) {
    return c.json({ error: 'walletAddress, tokenMint, and amount are required' }, 400);
  }

  try {
    const { transaction, message } = await buildDepositTransaction(walletAddress, tokenMint, amount);
    return c.json({ transaction, message });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Record a deposit after the user has signed and submitted
app.post('/confirm', async (c) => {
  const { walletAddress, tokenMint, amount, txSignature } = await c.req.json();
  if (!walletAddress || !tokenMint || !amount || !txSignature) {
    return c.json({ error: 'walletAddress, tokenMint, amount, and txSignature are required' }, 400);
  }

  const deposit = store.createDeposit(walletAddress, tokenMint, amount, txSignature);
  store.updateDepositStatus(deposit.id, 'confirming');

  // Start background polling for confirmation and channel credit
  pollDepositStatus(deposit.id, walletAddress, tokenMint, txSignature).catch(console.error);

  return c.json(deposit);
});

// Get deposit status
app.get('/status/:txSig', (c) => {
  const deposit = store.getDepositByTxSig(c.req.param('txSig'));
  if (!deposit) return c.json({ error: 'Deposit not found' }, 404);
  return c.json(deposit);
});

// Get deposits for a wallet
app.get('/wallet/:walletAddress', (c) => {
  return c.json(store.getDepositsByWallet(c.req.param('walletAddress')));
});

// Background polling to detect when the indexer/operator has credited the channel
async function pollDepositStatus(depositId: string, walletAddress: string, tokenMint: string, txSignature: string) {
  // First, confirm the on-chain transaction
  const onChainConfirmed = await checkTransactionConfirmed(VALIDATOR_URL, txSignature, 30, 2000);
  if (!onChainConfirmed) {
    store.updateDepositStatus(depositId, 'failed');
    return;
  }

  store.updateDepositStatus(depositId, 'confirming');

  // Then poll the channel for the balance to appear (indexer + operator processing)
  for (let i = 0; i < 60; i++) {
    const balance = await getChannelBalance(walletAddress, tokenMint);
    if (balance && BigInt(balance.amount) > 0n) {
      store.updateDepositStatus(depositId, 'credited');
      return;
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  // If we timeout, leave as confirming - the indexer might still be processing
  console.warn(`Deposit ${depositId} timed out waiting for channel credit`);
}

export default app;
