import { PublicKey, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { getLatestBlockhash, checkTransactionConfirmed, sendRawTransaction, GATEWAY_URL } from './contra.js';
import * as store from '../db/store.js';
import type { Trade } from '../types.js';

async function getChannelTokenBalance(ata: string): Promise<{ exists: boolean; amount: bigint }> {
  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountBalance', params: [ata] }),
    });
    const json = await response.json();
    if (json.result?.value) {
      return { exists: true, amount: BigInt(json.result.value.amount) };
    }
    return { exists: false, amount: 0n };
  } catch {
    return { exists: false, amount: 0n };
  }
}

export async function buildTransferInstructions(
  from: PublicKey,
  to: PublicKey,
  mint: PublicKey,
  amount: bigint
): Promise<TransactionInstruction[]> {
  const fromAta = await getAssociatedTokenAddress(mint, from, false, TOKEN_PROGRAM_ID);
  const toAta = await getAssociatedTokenAddress(mint, to, false, TOKEN_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];

  // Verify sender has sufficient balance on the channel
  const fromBalance = await getChannelTokenBalance(fromAta.toString());
  if (!fromBalance.exists) {
    throw new Error(`Sender has no channel balance for this token. Deposit to Contra first.`);
  }
  if (fromBalance.amount < amount) {
    const has = Number(fromBalance.amount) / 1e6;
    const needs = Number(amount) / 1e6;
    throw new Error(`Insufficient channel balance: has ${has}, needs ${needs}. Deposit more to Contra first.`);
  }

  // Verify receiver has a token account on the channel
  const toBalance = await getChannelTokenBalance(toAta.toString());
  if (!toBalance.exists) {
    throw new Error(`Receiver has no channel account for this token. They must deposit to Contra first.`);
  }

  instructions.push(
    createTransferInstruction(fromAta, toAta, from, amount, [], TOKEN_PROGRAM_ID)
  );

  return instructions;
}

/**
 * Build a single atomic swap transaction containing both legs:
 *   - Leg A: partyA sends sellToken to partyB
 *   - Leg B: partyB sends buyToken to partyA
 *
 * Both partyA and partyB are required signers. The transaction can only
 * execute on-chain (Contra channel) when both have signed.
 *
 * Returns the unsigned serialized V0 transaction as base64, plus the
 * ordered list of required signers so the frontend knows which slot
 * each party fills.
 */
export async function buildAtomicSwapTransaction(trade: Trade): Promise<{
  transaction: string;
  signers: string[];   // [partyA pubkey, partyB pubkey]
}> {
  const partyA = new PublicKey(trade.partyA);
  const partyB = new PublicKey(trade.partyB);
  const sellMint = new PublicKey(trade.sellToken);
  const buyMint = new PublicKey(trade.buyToken);
  const sellAmount = BigInt(trade.sellAmount);
  const buyAmount = BigInt(trade.buyAmount);

  // Build both sets of transfer instructions
  const legAInstructions = await buildTransferInstructions(partyA, partyB, sellMint, sellAmount);
  const legBInstructions = await buildTransferInstructions(partyB, partyA, buyMint, buyAmount);

  const allInstructions = [...legAInstructions, ...legBInstructions];

  // Build a V0 VersionedTransaction — fee payer is partyA
  const { blockhash } = await getLatestBlockhash(GATEWAY_URL);

  const messageV0 = new TransactionMessage({
    payerKey: partyA,
    recentBlockhash: blockhash,
    instructions: allInstructions,
  }).compileToV0Message();

  const vtx = new VersionedTransaction(messageV0);

  // The staticAccountKeys will list partyA first (fee payer), then partyB
  // as the second required signer. Verify the signer slots.
  const signerKeys = messageV0.staticAccountKeys
    .slice(0, messageV0.header.numRequiredSignatures)
    .map(k => k.toBase58());

  return {
    transaction: Buffer.from(vtx.serialize()).toString('base64'),
    signers: signerKeys,
  };
}

/**
 * Given the unsigned atomic swap tx (base64) and both partial signatures,
 * assemble the fully-signed transaction and submit to the Contra channel.
 * Returns the transaction signature.
 */
export async function submitAtomicSwap(
  unsignedTxBase64: string,
  signerPubkeys: string[],
  signatures: Map<string, Buffer>,
): Promise<string> {
  const txBytes = Buffer.from(unsignedTxBase64, 'base64');
  const vtx = VersionedTransaction.deserialize(txBytes);

  // The message's staticAccountKeys[0..numRequiredSignatures] are the signers.
  // Insert each party's signature into the correct slot.
  const accountKeys = vtx.message.staticAccountKeys;
  const numSigners = vtx.message.header.numRequiredSignatures;

  for (let i = 0; i < numSigners; i++) {
    const key = accountKeys[i].toBase58();
    const sig = signatures.get(key);
    if (!sig) {
      throw new Error(`Missing signature for signer ${key} (slot ${i})`);
    }
    vtx.signatures[i] = new Uint8Array(sig);
  }

  // Submit the fully-signed transaction to Contra
  const serialized = Buffer.from(vtx.serialize()).toString('base64');
  const txSig = await sendRawTransaction(GATEWAY_URL, serialized);

  // Verify via getSignatureStatuses (getTransaction is not supported on the gateway)
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getSignatureStatuses',
          params: [[txSig]],
        }),
      });
      const json = await response.json() as any;
      const status = json.result?.value?.[0];
      if (status) {
        if (status.err) {
          throw new Error(`Atomic swap failed on Contra channel: ${JSON.stringify(status.err)}`);
        }
        // Transaction confirmed successfully
        return txSig;
      }
    } catch (err: any) {
      if (err.message?.includes('Atomic swap failed')) throw err;
      // Status not available yet, keep polling
    }
  }

  throw new Error('Atomic swap transaction status unknown after timeout. Check the gateway.');
}

// ── Legacy functions kept for backward compatibility with old trades ──

export async function buildLegATransaction(trade: Trade): Promise<string> {
  const partyA = new PublicKey(trade.partyA);
  const partyB = new PublicKey(trade.partyB);
  const sellMint = new PublicKey(trade.sellToken);
  const sellAmount = BigInt(trade.sellAmount);

  const instructions = await buildTransferInstructions(partyA, partyB, sellMint, sellAmount);
  return buildV0Transaction(partyA, instructions);
}

export async function buildLegBTransaction(trade: Trade): Promise<string> {
  const partyA = new PublicKey(trade.partyA);
  const partyB = new PublicKey(trade.partyB);
  const buyMint = new PublicKey(trade.buyToken);
  const buyAmount = BigInt(trade.buyAmount);

  const instructions = await buildTransferInstructions(partyB, partyA, buyMint, buyAmount);
  return buildV0Transaction(partyB, instructions);
}

async function buildV0Transaction(feePayer: PublicKey, instructions: TransactionInstruction[]): Promise<string> {
  const { blockhash } = await getLatestBlockhash(GATEWAY_URL);
  const messageV0 = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  const vtx = new VersionedTransaction(messageV0);
  return Buffer.from(vtx.serialize()).toString('base64');
}

export async function initiateTrade(rfqId: string, quoteId: string): Promise<Trade> {
  const rfq = store.getRFQ(rfqId);
  if (!rfq) throw new Error('RFQ not found');
  if (rfq.status !== 'active' && rfq.status !== 'quoted') throw new Error('RFQ is not active');

  const quote = store.getQuote(quoteId);
  if (!quote) throw new Error('Quote not found');
  if (quote.status !== 'pending') throw new Error('Quote is not pending');

  const trade = store.createTrade(
    rfqId, quoteId,
    rfq.creator, quote.quoter,
    rfq.sellToken, rfq.sellAmount,
    rfq.buyToken, quote.buyAmount,
    quote.price
  );

  store.updateRFQStatus(rfqId, 'accepted');
  store.updateQuoteStatus(quoteId, 'accepted');

  return trade;
}

export async function submitTradeLeg(
  tradeId: string,
  leg: 'A' | 'B',
  signature: string
): Promise<Trade> {
  const trade = store.getTrade(tradeId);
  if (!trade) throw new Error('Trade not found');

  const confirmed = await checkTransactionConfirmed(GATEWAY_URL, signature, 30, 500);
  if (!confirmed) {
    throw new Error(`Trade leg ${leg} transaction not confirmed on channel`);
  }

  if (leg === 'A') {
    store.updateTrade(tradeId, { legASig: signature, status: trade.legBSig ? 'completed' : 'executing' });
  } else {
    store.updateTrade(tradeId, { legBSig: signature, status: trade.legASig ? 'completed' : 'executing' });
  }

  const updated = store.getTrade(tradeId)!;

  if (updated.legASig && updated.legBSig) {
    store.updateTrade(tradeId, { status: 'completed', completedAt: new Date().toISOString() });
    store.updateRFQStatus(trade.rfqId, 'filled');
  }

  return store.getTrade(tradeId)!;
}
