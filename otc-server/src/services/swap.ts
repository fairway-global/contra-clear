import { PublicKey, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { getLatestBlockhash, checkTransactionConfirmed, getAccountInfo, GATEWAY_URL } from './contra.js';
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

// Build a v0 VersionedTransaction — Phantom won't inject ComputeBudget into these
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
