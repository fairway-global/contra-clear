import { Hono } from 'hono';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import * as store from '../db/store.js';
import { getLatestBlockhash, sendRawTransaction, checkTransactionConfirmed, GATEWAY_URL } from '../services/contra.js';

const WITHDRAW_PROGRAM_ID = new PublicKey(process.env.WITHDRAW_PROGRAM_ID || 'J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi');

const app = new Hono();

// Build a withdrawal transaction (burn on channel)
app.post('/', async (c) => {
  const { walletAddress, tokenMint, amount, destination } = await c.req.json();
  if (!walletAddress || !tokenMint || !amount) {
    return c.json({ error: 'walletAddress, tokenMint, and amount are required' }, 400);
  }

  try {
    const user = new PublicKey(walletAddress);
    const mint = new PublicKey(tokenMint);
    const tokenAccount = await getAssociatedTokenAddress(mint, user, false, TOKEN_PROGRAM_ID);

    // Build WithdrawFunds instruction
    // Discriminator: 0 (withdrawFunds), then amount (u64 LE), then option<pubkey>
    const discriminator = Buffer.from([0]);
    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(amount));

    let data: Buffer;
    if (destination) {
      const destPk = new PublicKey(destination);
      data = Buffer.concat([discriminator, amountBuf, Buffer.from([1]), destPk.toBuffer()]);
    } else {
      data = Buffer.concat([discriminator, amountBuf, Buffer.from([0])]);
    }

    const keys = [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const instruction = new TransactionInstruction({
      keys,
      programId: WITHDRAW_PROGRAM_ID,
      data,
    });

    const { blockhash } = await getLatestBlockhash(GATEWAY_URL);
    const tx = new Transaction();
    tx.add(instruction);
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

    // Create withdrawal record
    const withdrawal = store.createWithdrawal(walletAddress, tokenMint, amount);

    return c.json({
      withdrawalId: withdrawal.id,
      transaction: serialized.toString('base64'),
      message: `Withdraw ${amount} tokens from Contra channel`,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Confirm withdrawal after user has signed and submitted
app.post('/confirm', async (c) => {
  const { withdrawalId, txSignature } = await c.req.json();
  if (!withdrawalId || !txSignature) {
    return c.json({ error: 'withdrawalId and txSignature are required' }, 400);
  }

  const withdrawal = store.getWithdrawal(withdrawalId);
  if (!withdrawal) return c.json({ error: 'Withdrawal not found' }, 404);

  store.updateWithdrawal(withdrawalId, { channelTxSignature: txSignature, status: 'processing' });

  // Background: poll for completion (operator processes withdrawal back to mainnet)
  pollWithdrawalStatus(withdrawalId, txSignature).catch(console.error);

  return c.json(store.getWithdrawal(withdrawalId));
});

// Get withdrawal status
app.get('/status/:id', (c) => {
  const withdrawal = store.getWithdrawal(c.req.param('id'));
  if (!withdrawal) return c.json({ error: 'Withdrawal not found' }, 404);
  return c.json(withdrawal);
});

async function pollWithdrawalStatus(withdrawalId: string, txSignature: string) {
  const confirmed = await checkTransactionConfirmed(GATEWAY_URL, txSignature, 30, 1000);
  if (confirmed) {
    // The indexer/operator will handle releasing funds from escrow
    // We just mark the channel-side burn as confirmed
    store.updateWithdrawal(withdrawalId, { status: 'confirmed' });
  } else {
    store.updateWithdrawal(withdrawalId, { status: 'failed' });
  }
}

export default app;
