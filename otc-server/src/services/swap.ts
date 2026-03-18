import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { getLatestBlockhash, sendRawTransaction, checkTransactionConfirmed, GATEWAY_URL } from './contra.js';
import * as store from '../db/store.js';
import type { Trade, RFQ, Quote } from '../types.js';

// Build a transfer instruction for one leg of an OTC swap
export async function buildTransferInstruction(
  from: PublicKey,
  to: PublicKey,
  mint: PublicKey,
  amount: bigint
): Promise<TransactionInstruction[]> {
  const fromAta = await getAssociatedTokenAddress(mint, from, false, TOKEN_PROGRAM_ID);
  const toAta = await getAssociatedTokenAddress(mint, to, false, TOKEN_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];

  // Create ATA for receiver if needed (within the channel, ATAs may need creation)
  instructions.push(
    createAssociatedTokenAccountInstruction(
      from, toAta, to, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  instructions.push(
    createTransferInstruction(fromAta, toAta, from, amount, [], TOKEN_PROGRAM_ID)
  );

  return instructions;
}

// Build the sell-side transaction (Party A sends sellToken to Party B)
export async function buildLegATransaction(trade: Trade): Promise<string> {
  const partyA = new PublicKey(trade.partyA);
  const partyB = new PublicKey(trade.partyB);
  const sellMint = new PublicKey(trade.sellToken);
  const sellAmount = BigInt(trade.sellAmount);

  const instructions = await buildTransferInstruction(partyA, partyB, sellMint, sellAmount);
  const { blockhash } = await getLatestBlockhash(GATEWAY_URL);

  const tx = new Transaction();
  instructions.forEach(ix => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = partyA;

  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}

// Build the buy-side transaction (Party B sends buyToken to Party A)
export async function buildLegBTransaction(trade: Trade): Promise<string> {
  const partyA = new PublicKey(trade.partyA);
  const partyB = new PublicKey(trade.partyB);
  const buyMint = new PublicKey(trade.buyToken);
  const buyAmount = BigInt(trade.buyAmount);

  const instructions = await buildTransferInstruction(partyB, partyA, buyMint, buyAmount);
  const { blockhash } = await getLatestBlockhash(GATEWAY_URL);

  const tx = new Transaction();
  instructions.forEach(ix => tx.add(ix));
  tx.recentBlockhash = blockhash;
  tx.feePayer = partyB;

  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}

// Execute a trade: accept a quote, create the trade, return transactions for both parties to sign
export async function initiateTrade(rfqId: string, quoteId: string): Promise<Trade> {
  const rfq = store.getRFQ(rfqId);
  if (!rfq) throw new Error('RFQ not found');
  if (rfq.status !== 'active' && rfq.status !== 'quoted') throw new Error('RFQ is not active');

  const quote = store.getQuote(quoteId);
  if (!quote) throw new Error('Quote not found');
  if (quote.status !== 'pending') throw new Error('Quote is not pending');

  // Create the trade
  const trade = store.createTrade(
    rfqId, quoteId,
    rfq.creator, quote.quoter,
    rfq.sellToken, rfq.sellAmount,
    rfq.buyToken, quote.buyAmount,
    quote.price
  );

  // Update statuses
  store.updateRFQStatus(rfqId, 'accepted');
  store.updateQuoteStatus(quoteId, 'accepted');

  return trade;
}

// Submit a signed transaction leg
export async function submitTradeLeg(
  tradeId: string,
  leg: 'A' | 'B',
  signedTx: string
): Promise<Trade> {
  const trade = store.getTrade(tradeId);
  if (!trade) throw new Error('Trade not found');

  // Submit to the Contra gateway
  const signature = await sendRawTransaction(GATEWAY_URL, signedTx);

  // Wait for confirmation
  const confirmed = await checkTransactionConfirmed(GATEWAY_URL, signature, 20, 300);
  if (!confirmed) {
    throw new Error(`Trade leg ${leg} transaction not confirmed`);
  }

  // Update trade
  if (leg === 'A') {
    store.updateTrade(tradeId, { legASig: signature, status: trade.legBSig ? 'completed' : 'executing' });
  } else {
    store.updateTrade(tradeId, { legBSig: signature, status: trade.legASig ? 'completed' : 'executing' });
  }

  const updated = store.getTrade(tradeId)!;

  // If both legs are done, mark as completed
  if (updated.legASig && updated.legBSig) {
    store.updateTrade(tradeId, { status: 'completed', completedAt: new Date().toISOString() });
    // Update the RFQ status
    store.updateRFQStatus(trade.rfqId, 'filled');
  }

  return store.getTrade(tradeId)!;
}
