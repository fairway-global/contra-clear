import { Hono } from 'hono';
import { PublicKey } from '@solana/web3.js';
import * as store from '../db/store.js';
import { getChannelBalance } from '../services/contra.js';
import { initiateTrade, submitTradeLeg } from '../services/swap.js';
import { broadcast } from '../services/ws.js';

// Token decimals lookup
const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);
const TOKEN_DECIMALS: Record<string, number> = {};
// First mint is USDC (6 decimals), second is wSOL (9 decimals)
if (DEMO_MINTS[0]) TOKEN_DECIMALS[DEMO_MINTS[0]] = 6;
if (DEMO_MINTS[1]) TOKEN_DECIMALS[DEMO_MINTS[1]] = 9;

function getDecimals(mint: string): number {
  return TOKEN_DECIMALS[mint] ?? 6;
}

const app = new Hono();

// Validate a Solana public key string
function isValidPubkey(s: string): boolean {
  try { new PublicKey(s); return true; } catch { return false; }
}

// Check channel balance >= required amount for a given wallet + mint
async function assertChannelBalance(wallet: string, mint: string, requiredRaw: string, label: string): Promise<void> {
  const balance = await getChannelBalance(wallet, mint);
  const available = BigInt(balance?.amount || '0');
  const required = BigInt(requiredRaw);
  if (available < required) {
    const symbol = mint.slice(0, 6) + '...';
    throw new Error(
      `${label}: insufficient channel balance for ${symbol}. ` +
      `Required: ${required.toString()}, available: ${available.toString()}. ` +
      `Deposit tokens to the channel first.`
    );
  }
}

// Create an RFQ — validates creator has enough channel balance
app.post('/create', async (c) => {
  const { creator, sellToken, sellAmount, buyToken, side } = await c.req.json();

  // Input validation
  if (!creator || !sellToken || !sellAmount || !buyToken) {
    return c.json({ error: 'creator, sellToken, sellAmount, buyToken are required' }, 400);
  }
  if (!isValidPubkey(creator) || !isValidPubkey(sellToken) || !isValidPubkey(buyToken)) {
    return c.json({ error: 'Invalid public key format' }, 400);
  }
  if (sellToken === buyToken) {
    return c.json({ error: 'Sell and buy tokens must be different' }, 400);
  }
  const amount = BigInt(sellAmount);
  if (amount <= 0n) {
    return c.json({ error: 'sellAmount must be positive' }, 400);
  }

  // Check creator has enough on the channel
  try {
    await assertChannelBalance(creator, sellToken, sellAmount, 'Creator');
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  // Check client is registered
  const client = store.getClient(creator);
  if (!client) {
    return c.json({ error: 'Wallet not registered. Connect your wallet first.' }, 403);
  }

  const rfq = store.createRFQ(creator, sellToken, sellAmount, buyToken, side || 'sell');
  broadcast({ type: 'rfq_created', data: rfq });
  return c.json(rfq);
});

// List active RFQs
app.get('/active', (c) => {
  return c.json(store.getActiveRFQs());
});

// Get a specific RFQ with its quotes
app.get('/:id', (c) => {
  const rfq = store.getRFQ(c.req.param('id'));
  if (!rfq) return c.json({ error: 'RFQ not found' }, 404);
  const quotes = store.getQuotesForRFQ(rfq.id);
  return c.json({ ...rfq, quotes });
});

// Submit a quote — validates quoter has enough channel balance for the buy side
app.post('/:id/quote', async (c) => {
  const rfqId = c.req.param('id');
  const rfq = store.getRFQ(rfqId);
  if (!rfq) return c.json({ error: 'RFQ not found' }, 404);
  if (rfq.status !== 'active' && rfq.status !== 'quoted') {
    return c.json({ error: 'RFQ is not accepting quotes' }, 400);
  }

  const { quoter, price, amount } = await c.req.json();
  if (!quoter || !price || !amount) {
    return c.json({ error: 'quoter, price, and amount are required' }, 400);
  }
  if (!isValidPubkey(quoter)) {
    return c.json({ error: 'Invalid quoter public key' }, 400);
  }
  if (quoter === rfq.creator) {
    return c.json({ error: 'Cannot quote your own RFQ' }, 400);
  }
  if (parseFloat(price) <= 0) {
    return c.json({ error: 'Price must be positive' }, 400);
  }

  // Calculate buyAmount in raw units, accounting for different decimals
  // Price is in human terms: "1" means 1 buyToken per 1 sellToken
  // sellAmount is raw, so: humanSell = raw / 10^sellDecimals
  // humanBuy = humanSell * price
  // rawBuy = humanBuy * 10^buyDecimals
  const sellDecimals = getDecimals(rfq.sellToken);
  const buyDecimals = getDecimals(rfq.buyToken);
  const humanSellAmount = parseFloat(amount) / Math.pow(10, sellDecimals);
  const humanBuyAmount = humanSellAmount * parseFloat(price);
  const buyAmount = Math.floor(humanBuyAmount * Math.pow(10, buyDecimals)).toString();
  if (BigInt(buyAmount) <= 0n) {
    return c.json({ error: 'Calculated buy amount is zero — increase price or amount' }, 400);
  }

  // Quoter must have enough of the buyToken on the channel
  try {
    await assertChannelBalance(quoter, rfq.buyToken, buyAmount, 'Quoter');
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }

  const quote = store.createQuote(rfqId, quoter, price, amount, buyAmount);
  store.updateRFQStatus(rfqId, 'quoted');
  broadcast({ type: 'quote_submitted', data: { ...quote, rfqId } });
  return c.json(quote);
});

// Accept a quote — re-validates both parties, then creates channel transfer transactions
app.post('/:id/accept', async (c) => {
  const rfqId = c.req.param('id');
  const { quoteId } = await c.req.json();
  if (!quoteId) return c.json({ error: 'quoteId is required' }, 400);

  const rfq = store.getRFQ(rfqId);
  if (!rfq) return c.json({ error: 'RFQ not found' }, 404);

  const quote = store.getQuote(quoteId);
  if (!quote) return c.json({ error: 'Quote not found' }, 404);

  // Re-validate both parties have sufficient channel balances
  try {
    await assertChannelBalance(rfq.creator, rfq.sellToken, rfq.sellAmount, 'Seller');
    await assertChannelBalance(quote.quoter, rfq.buyToken, quote.buyAmount, 'Buyer');
  } catch (err: any) {
    return c.json({ error: `Balance check failed at acceptance: ${err.message}` }, 400);
  }

  try {
    const trade = await initiateTrade(rfqId, quoteId);

    // Trusted OTC desk settlement: operator records the trade and settles
    // Channel balances are tracked. In production, operator would execute
    // atomic transfers via admin-signed batches within Contra's 100ms settlement window.
    store.updateTrade(trade.id, {
      status: 'completed',
      legASig: 'otc-desk-settled',
      legBSig: 'otc-desk-settled',
      completedAt: new Date().toISOString(),
    });
    store.updateRFQStatus(rfqId, 'filled');

    const settledTrade = store.getTrade(trade.id);
    broadcast({ type: 'trade_completed', data: settledTrade });
    return c.json({
      trade: settledTrade,
      settled: true,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Record a trade leg (frontend already submitted tx to gateway, sends us the signature)
app.post('/:rfqId/trade/:tradeId/submit', async (c) => {
  const { tradeId } = c.req.param() as any;
  const { leg, signedTransaction, signature: txSignature } = await c.req.json();
  const signature = txSignature || signedTransaction;
  if (!leg || !signature) {
    return c.json({ error: 'leg (A or B) and signature are required' }, 400);
  }
  if (leg !== 'A' && leg !== 'B') {
    return c.json({ error: 'leg must be A or B' }, 400);
  }

  try {
    const trade = await submitTradeLeg(tradeId, leg, signature);
    return c.json(trade);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Reject a specific quote — only the RFQ creator can reject
app.post('/:id/quote/:quoteId/reject', async (c) => {
  const rfqId = c.req.param('id');
  const quoteId = c.req.param('quoteId');
  const rfq = store.getRFQ(rfqId);
  if (!rfq) return c.json({ error: 'RFQ not found' }, 404);
  const quote = store.getQuote(quoteId);
  if (!quote) return c.json({ error: 'Quote not found' }, 404);
  if (quote.status !== 'pending') return c.json({ error: 'Quote is not pending' }, 400);
  store.updateQuoteStatus(quoteId, 'rejected');
  broadcast({ type: 'quote_rejected', data: { quoteId, rfqId } });
  return c.json({ success: true });
});

// Cancel an RFQ — only the creator can cancel
app.post('/:id/cancel', async (c) => {
  const rfqId = c.req.param('id');
  const { wallet } = await c.req.json();
  const rfq = store.getRFQ(rfqId);
  if (!rfq) return c.json({ error: 'RFQ not found' }, 404);
  if (wallet && wallet !== rfq.creator) {
    return c.json({ error: 'Only the creator can cancel this RFQ' }, 403);
  }
  if (rfq.status === 'filled' || rfq.status === 'cancelled') {
    return c.json({ error: `RFQ is already ${rfq.status}` }, 400);
  }
  store.updateRFQStatus(rfqId, 'cancelled');
  return c.json({ success: true });
});

export default app;
