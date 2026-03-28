import { Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { getLatestBlockhash, sendRawTransaction, GATEWAY_URL } from './contra.js';
import { readFileSync } from 'node:fs';
import nacl from 'tweetnacl';

// ── Operator keypair (signs release txs server-side) ─────────────────────

let _operatorKeypair: Keypair | null = null;
function getOperatorKeypair(): Keypair {
  if (!_operatorKeypair) {
    const keyPath = (process.env.SAS_PAYER_PATH || '~/.config/solana/id.json')
      .replace('~', process.env.HOME || '');
    const raw = JSON.parse(readFileSync(keyPath, 'utf-8'));
    _operatorKeypair = Keypair.fromSecretKey(new Uint8Array(raw));
  }
  return _operatorKeypair;
}

export function getOperatorPublicKey(): string {
  return getOperatorKeypair().publicKey.toBase58();
}

// ── Channel balance check ────────────────────────────────────────────────

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

  // Verify sender balance
  const fromBalance = await getChannelTokenBalance(fromAta.toString());
  if (!fromBalance.exists) {
    throw new Error('Sender has no channel balance for this token. Deposit to Contra first.');
  }
  if (fromBalance.amount < amount) {
    const has = Number(fromBalance.amount) / 1e6;
    const needs = Number(amount) / 1e6;
    throw new Error(`Insufficient channel balance: has ${has}, needs ${needs}.`);
  }

  // Verify receiver account exists
  const toBalance = await getChannelTokenBalance(toAta.toString());
  if (!toBalance.exists) {
    throw new Error('Receiver has no channel account for this token.');
  }

  return [createTransferInstruction(fromAta, toAta, from, amount, [], TOKEN_PROGRAM_ID)];
}

// ── Build V0 transaction ─────────────────────────────────────────────────

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

// ── Operator-Escrow Settlement ───────────────────────────────────────────
//
// Each party sends tokens to the OPERATOR (escrow). When both deposits arrive,
// the operator releases tokens to the correct recipients. The operator signs
// and submits release txs server-side with fresh blockhashes — no expiry.

/**
 * Build a tx where `party` sends `amount` of `mint` to the OPERATOR.
 * The party signs this tx and submits it immediately (no blockhash expiry).
 */
export async function buildDepositToOperatorTx(
  party: string, mint: string, amount: string
): Promise<string> {
  const partyPk = new PublicKey(party);
  const mintPk = new PublicKey(mint);
  const amountBig = BigInt(amount);
  const operator = getOperatorKeypair().publicKey;

  const instructions = await buildTransferInstructions(partyPk, operator, mintPk, amountBig);
  return buildV0Transaction(partyPk, instructions);
}

/**
 * Operator releases escrowed tokens to both parties. Builds, signs, and
 * submits two txs server-side with fresh blockhashes.
 *
 * Release A: operator sends sellToken to provider (partyB)
 * Release B: operator sends buyToken to originator (partyA)
 *
 * Returns both tx signatures.
 */
export async function executeOperatorRelease(
  partyA: string, partyB: string,
  sellToken: string, sellAmount: string,
  buyToken: string, buyAmount: string,
): Promise<{ releaseSigA: string; releaseSigB: string }> {
  const operator = getOperatorKeypair();
  const operatorPk = operator.publicKey;

  // Release A: operator → partyB (sell token)
  const ixA = await buildTransferInstructions(
    operatorPk, new PublicKey(partyB), new PublicKey(sellToken), BigInt(sellAmount)
  );

  // Release B: operator → partyA (buy token)
  const ixB = await buildTransferInstructions(
    operatorPk, new PublicKey(partyA), new PublicKey(buyToken), BigInt(buyAmount)
  );

  // Build, sign, submit release A
  const { blockhash: bhA } = await getLatestBlockhash(GATEWAY_URL);
  const msgA = new TransactionMessage({
    payerKey: operatorPk, recentBlockhash: bhA, instructions: ixA,
  }).compileToV0Message();
  const vtxA = new VersionedTransaction(msgA);
  const sigA = nacl.sign.detached(vtxA.message.serialize(), operator.secretKey);
  vtxA.signatures[0] = sigA;
  const releaseSigA = await sendRawTransaction(GATEWAY_URL, Buffer.from(vtxA.serialize()).toString('base64'));
  console.log(`[swap] Release A (operator → ${partyB.slice(0,8)}... sellToken): ${releaseSigA}`);

  // Build, sign, submit release B
  const { blockhash: bhB } = await getLatestBlockhash(GATEWAY_URL);
  const msgB = new TransactionMessage({
    payerKey: operatorPk, recentBlockhash: bhB, instructions: ixB,
  }).compileToV0Message();
  const vtxB = new VersionedTransaction(msgB);
  const sigB = nacl.sign.detached(vtxB.message.serialize(), operator.secretKey);
  vtxB.signatures[0] = sigB;
  const releaseSigB = await sendRawTransaction(GATEWAY_URL, Buffer.from(vtxB.serialize()).toString('base64'));
  console.log(`[swap] Release B (operator → ${partyA.slice(0,8)}... buyToken): ${releaseSigB}`);

  return { releaseSigA, releaseSigB };
}

// ── Legacy exports (kept for old code paths) ─────────────────────────────

export async function buildLegATransaction(trade: { partyA: string; partyB: string; sellToken: string; sellAmount: string }): Promise<string> {
  const instructions = await buildTransferInstructions(
    new PublicKey(trade.partyA), new PublicKey(trade.partyB),
    new PublicKey(trade.sellToken), BigInt(trade.sellAmount)
  );
  return buildV0Transaction(new PublicKey(trade.partyA), instructions);
}

export async function buildLegBTransaction(trade: { partyA: string; partyB: string; buyToken: string; buyAmount: string }): Promise<string> {
  const instructions = await buildTransferInstructions(
    new PublicKey(trade.partyB), new PublicKey(trade.partyA),
    new PublicKey(trade.buyToken), BigInt(trade.buyAmount)
  );
  return buildV0Transaction(new PublicKey(trade.partyB), instructions);
}

// Legacy trade functions used by rfq.ts
import * as store from '../db/store.js';
import type { Trade } from '../types.js';
import { checkTransactionConfirmed } from './contra.js';

export async function initiateTrade(rfqId: string, quoteId: string): Promise<Trade> {
  const rfq = store.getRFQ(rfqId);
  if (!rfq) throw new Error('RFQ not found');
  if (rfq.status !== 'active' && rfq.status !== 'quoted') throw new Error('RFQ is not active');
  const quote = store.getQuote(quoteId);
  if (!quote) throw new Error('Quote not found');
  if (quote.status !== 'pending') throw new Error('Quote is not pending');
  const trade = store.createTrade(rfqId, quoteId, rfq.creator, quote.quoter, rfq.sellToken, rfq.sellAmount, rfq.buyToken, quote.buyAmount, quote.price);
  store.updateRFQStatus(rfqId, 'accepted');
  store.updateQuoteStatus(quoteId, 'accepted');
  return trade;
}

export async function submitTradeLeg(tradeId: string, leg: 'A' | 'B', signature: string): Promise<Trade> {
  const trade = store.getTrade(tradeId);
  if (!trade) throw new Error('Trade not found');
  const confirmed = await checkTransactionConfirmed(GATEWAY_URL, signature, 30, 500);
  if (!confirmed) throw new Error(`Trade leg ${leg} transaction not confirmed`);
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
