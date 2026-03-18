import { Hono } from 'hono';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as store from '../db/store.js';
import { getEffectiveBalance, getDecimals } from '../services/effective-balance.js';
import { getLatestBlockhash, GATEWAY_URL } from '../services/contra.js';
import { broadcast } from '../services/ws.js';

const WITHDRAW_PROGRAM_ID = new PublicKey(process.env.WITHDRAW_PROGRAM_ID || 'J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi');

const app = new Hono();

// Build a withdrawal (burn) transaction for the user to sign
app.post('/', async (c) => {
  const { walletAddress, tokenMint, amount } = await c.req.json();
  if (!walletAddress || !tokenMint || !amount) {
    return c.json({ error: 'walletAddress, tokenMint, and amount are required' }, 400);
  }

  // Check effective balance
  const available = await getEffectiveBalance(walletAddress, tokenMint);
  const requested = BigInt(amount);

  if (available < requested) {
    const decimals = getDecimals(tokenMint);
    const availHuman = (Number(available) / Math.pow(10, decimals)).toFixed(4);
    const reqHuman = (Number(requested) / Math.pow(10, decimals)).toFixed(4);
    return c.json({ error: `Insufficient balance. Available: ${availHuman}, requested: ${reqHuman}` }, 400);
  }

  try {
    const user = new PublicKey(walletAddress);
    const mint = new PublicKey(tokenMint);
    const tokenAccount = await getAssociatedTokenAddress(mint, user, false, TOKEN_PROGRAM_ID);

    // WithdrawFunds: discriminator(0) + amount(u64 LE) + no destination(0)
    const data = Buffer.alloc(10);
    data[0] = 0; // discriminator
    data.writeBigUInt64LE(BigInt(amount), 1);
    data[9] = 0; // no destination

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: tokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: WITHDRAW_PROGRAM_ID,
      data,
    });

    const { blockhash } = await getLatestBlockhash(GATEWAY_URL);
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const withdrawal = store.createWithdrawal(walletAddress, tokenMint, amount);

    return c.json({
      withdrawalId: withdrawal.id,
      transaction: serialized.toString('base64'),
      message: `Burn ${amount} tokens on Contra channel for withdrawal`,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Confirm after user signed and submitted the burn to the gateway
app.post('/confirm', async (c) => {
  const { withdrawalId, txSignature } = await c.req.json();
  if (!withdrawalId || !txSignature) {
    return c.json({ error: 'withdrawalId and txSignature are required' }, 400);
  }

  const withdrawal = store.getWithdrawal(withdrawalId);
  if (!withdrawal) return c.json({ error: 'Withdrawal not found' }, 404);

  store.updateWithdrawal(withdrawalId, { channelTxSignature: txSignature, status: 'confirmed' });
  broadcast({ type: 'withdrawal_confirmed', data: store.getWithdrawal(withdrawalId) });

  return c.json(store.getWithdrawal(withdrawalId));
});

app.get('/status/:id', (c) => {
  const withdrawal = store.getWithdrawal(c.req.param('id'));
  if (!withdrawal) return c.json({ error: 'Withdrawal not found' }, 404);
  return c.json(withdrawal);
});

export default app;
