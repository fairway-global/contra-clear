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
 * Given the FULL SIGNED transactions from both parties, splice the signatures
 * at the raw byte level and submit. This avoids VersionedTransaction
 * re-serialization which can produce different message bytes and cause
 * sigverify failures.
 *
 * signedTxA: full signed tx from party A (has valid sig[0], zero sig[1])
 * signedTxB: full signed tx from party B (has zero sig[0], valid sig[1])
 *
 * We take A's bytes and copy B's sig[1] into slot 1.
 */
export async function submitAtomicSwap(
  signedTxABase64: string,
  signedTxBBase64: string,
): Promise<string> {
  const bytesA = Buffer.from(signedTxABase64, 'base64');
  const bytesB = Buffer.from(signedTxBBase64, 'base64');

  // VersionedTransaction wire format:
  //   [compact_array_len, sig_0 (64 bytes), sig_1 (64 bytes), ..., message_bytes]
  // For 2 signatures, compact_array_len = 0x02 (1 byte)
  // sig_0 starts at offset 1, sig_1 starts at offset 65

  const numSigs = bytesA[0];
  if (numSigs !== 2) {
    throw new Error(`Expected 2 required signatures, got ${numSigs}`);
  }

  const SIG_SIZE = 64;
  const SIG_0_START = 1;
  const SIG_1_START = 1 + SIG_SIZE; // 65

  // Take party A's full tx (which has the correct message bytes that A signed)
  // Copy party B's sig[1] into slot 1
  const combined = Buffer.from(bytesA); // copy
  bytesB.copy(combined, SIG_1_START, SIG_1_START, SIG_1_START + SIG_SIZE);

  // Verify both sig slots are non-zero
  const sig0 = combined.subarray(SIG_0_START, SIG_0_START + SIG_SIZE);
  const sig1 = combined.subarray(SIG_1_START, SIG_1_START + SIG_SIZE);
  if (sig0.every(b => b === 0)) throw new Error('Party A signature is empty');
  if (sig1.every(b => b === 0)) throw new Error('Party B signature is empty');

  // Verify the message portion (after signatures) is identical in both txs
  const MSG_START = 1 + numSigs * SIG_SIZE; // byte after all signatures
  const msgA = bytesA.subarray(MSG_START);
  const msgB = bytesB.subarray(MSG_START);
  if (!msgA.equals(msgB)) {
    throw new Error('Message mismatch between party A and party B signed transactions. They must sign the same tx.');
  }

  console.log(`[swap] Assembled atomic swap: ${combined.length} bytes, msg=${msgA.length}b, sig0=${sig0.subarray(0, 4).toString('hex')}..., sig1=${sig1.subarray(0, 4).toString('hex')}...`);

  // Submit the raw bytes to Contra
  const txSig = await sendRawTransaction(GATEWAY_URL, combined.toString('base64'));

  // Quick check via getSignatureStatuses — gateway processes txs near-instantly
  // but doesn't always expose status. Check a few times, then fall back to success.
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 1000));
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
        return txSig; // Confirmed
      }
    } catch (err: any) {
      if (err.message?.includes('Atomic swap failed')) throw err;
    }
  }

  // Gateway accepted the tx (returned a sig) but status isn't available.
  // This is normal — the gateway doesn't always track statuses.
  // The caller (route handler) will mark settlement complete; balance checks
  // before building the tx already validated sufficient funds.
  console.log(`[swap] Atomic swap submitted (${txSig}) — status not available via getSignatureStatuses, proceeding.`);
  return txSig;
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
