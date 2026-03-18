import { Hono } from 'hono';
import * as store from '../db/store.js';
import { initiateTrade, buildLegATransaction, buildLegBTransaction, submitTradeLeg } from '../services/swap.js';

const app = new Hono();

// Create an RFQ
app.post('/create', async (c) => {
  const { creator, sellToken, sellAmount, buyToken, side } = await c.req.json();
  if (!creator || !sellToken || !sellAmount || !buyToken) {
    return c.json({ error: 'creator, sellToken, sellAmount, buyToken are required' }, 400);
  }
  const rfq = store.createRFQ(creator, sellToken, sellAmount, buyToken, side || 'sell');
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

// Submit a quote for an RFQ
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

  // Calculate the buy amount: for a "sell" RFQ, buyAmount = sellAmount * price
  const buyAmount = Math.floor(parseFloat(amount) * parseFloat(price)).toString();

  const quote = store.createQuote(rfqId, quoter, price, amount, buyAmount);
  store.updateRFQStatus(rfqId, 'quoted');
  return c.json(quote);
});

// Accept a quote — initiates the trade
app.post('/:id/accept', async (c) => {
  const rfqId = c.req.param('id');
  const { quoteId } = await c.req.json();
  if (!quoteId) return c.json({ error: 'quoteId is required' }, 400);

  try {
    const trade = await initiateTrade(rfqId, quoteId);

    // Build both leg transactions for the frontend to sign
    const [legATx, legBTx] = await Promise.all([
      buildLegATransaction(trade),
      buildLegBTransaction(trade),
    ]);

    return c.json({
      trade,
      transactions: {
        legA: { transaction: legATx, signer: trade.partyA, description: `Send ${trade.sellAmount} of sell token` },
        legB: { transaction: legBTx, signer: trade.partyB, description: `Send ${trade.buyAmount} of buy token` },
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Submit a signed trade leg
app.post('/:rfqId/trade/:tradeId/submit', async (c) => {
  const { tradeId } = c.req.param() as any;
  const { leg, signedTransaction } = await c.req.json();
  if (!leg || !signedTransaction) {
    return c.json({ error: 'leg (A or B) and signedTransaction are required' }, 400);
  }

  try {
    const trade = await submitTradeLeg(tradeId, leg, signedTransaction);
    return c.json(trade);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Cancel an RFQ
app.post('/:id/cancel', async (c) => {
  const rfqId = c.req.param('id');
  const rfq = store.getRFQ(rfqId);
  if (!rfq) return c.json({ error: 'RFQ not found' }, 404);
  store.updateRFQStatus(rfqId, 'cancelled');
  return c.json({ success: true });
});

export default app;
