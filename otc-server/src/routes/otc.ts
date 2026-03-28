import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import {
  getOrCreateOtcUserBySupabaseId,
  initOtcSchema,
  otcAcceptQuote,
  otcCounterQuote,
  otcCreateRFQ,
  otcCreateUser,
  otcDeleteUser,
  otcGetAdminEscrow,
  otcGetAdminOverview,
  otcGetAdminRFQs,
  otcGetEscrowStatusForRFQ,
  otcGetNegotiationThread,
  otcGetQuotesForRFQ,
  otcGetRFQ,
  otcGetUser,
  otcListRFQs,
  otcListUsers,
  otcRejectQuote,
  otcSubmitEscrowTxHash,
  otcSubmitQuote,
  otcUpdateUser,
  seedOtcDemoData,
  registerDID,
  getKycStatusByWallet,
  getKycStatusByEmail,
  processZypheVerification,
  updateKycAttestation,
  registerSettlementWallet,
  storeSettlementLegs,
  storeAtomicSwapTx,
  recordSettlementLegSig,
  completeAtomicSettlement,
} from '../db/otc-store.js';
import { broadcast } from '../services/ws.js';
import { createSASAttestation } from '../services/attestation.js';
import { buildAtomicSwapTransaction, submitAtomicSwap, buildLegATransaction, buildLegBTransaction } from '../services/swap.js';
import { checkTransactionConfirmed, GATEWAY_URL } from '../services/contra.js';
import type { UserRole } from '../db/otc-store.js';

// ── Supabase admin client ─────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — OTC auth will not work.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const otcRouter = new Hono();

// ── OTC Auth Middleware (Supabase JWT) ─────────────────────────────────────

otcRouter.use('/rfqs/*', otcAuthMiddleware);
otcRouter.use('/quotes/*', otcAuthMiddleware);
otcRouter.use('/escrow/*', otcAuthMiddleware);
otcRouter.use('/activity/*', otcAuthMiddleware);
otcRouter.use('/admin/*', otcAuthMiddleware);
otcRouter.use('/users', otcAuthMiddleware);
otcRouter.use('/users/*', otcAuthMiddleware);
otcRouter.use('/auth/me', otcAuthMiddleware);

async function otcAuthMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'OTC authentication required' }, 401);
  }
  const token = authHeader.slice(7);

  // Verify Supabase JWT
  const { data: { user: supaUser }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !supaUser) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  // Auto-provision OTC user from Supabase metadata
  const meta = supaUser.user_metadata || {};
  const role = (meta.role as UserRole) || 'RFQ_ORIGINATOR';
  const fullName = meta.full_name || supaUser.email?.split('@')[0] || 'Unknown';

  const otcUser = getOrCreateOtcUserBySupabaseId(
    supaUser.id,
    supaUser.email || '',
    fullName,
    role,
  );

  c.req.raw.headers.set('x-otc-user-id', otcUser.id);
  return next();
}

function getOtcUserId(c: any): string {
  return c.req.header('x-otc-user-id') || '';
}

// ── Auth endpoints ────────────────────────────────────────────────────────

// GET /auth/me — returns the current user's OTC profile
otcRouter.get('/auth/me', (c) => {
  const userId = getOtcUserId(c);
  try {
    return c.json(otcGetUser(userId));
  } catch (err: any) {
    return c.json({ error: err.message }, 404);
  }
});

// POST /auth/login — legacy compat (frontend now uses Supabase directly)
otcRouter.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    // Sign in via Supabase server-side
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return c.json({ error: error?.message || 'Authentication failed' }, 401);
    }
    const meta = data.user.user_metadata || {};
    const role = (meta.role as UserRole) || 'RFQ_ORIGINATOR';
    const fullName = meta.full_name || email.split('@')[0];
    const user = getOrCreateOtcUserBySupabaseId(data.user.id, email, fullName, role);
    return c.json({ user, token: data.session.access_token });
  } catch (err: any) {
    return c.json({ error: err.message }, 401);
  }
});

otcRouter.post('/auth/logout', async (c) => {
  // Supabase session invalidation is handled client-side
  return c.json({ ok: true });
});

otcRouter.post('/auth/signup', async (c) => {
  try {
    const body = await c.req.json();
    const role = body.requestedRoles?.[0] || body.role || 'RFQ_ORIGINATOR';
    const fullName = body.contactName || body.fullName || 'Unknown';

    // Create Supabase user with admin API (auto-confirms email)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password || 'contra123',
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        institution_name: body.institutionName || '',
      },
    });
    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Auto-provision OTC user
    const user = getOrCreateOtcUserBySupabaseId(data.user.id, body.email, fullName, role);
    return c.json({ user, status: 'SUBMITTED' });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ── Users endpoints ───────────────────────────────────────────────────────

otcRouter.get('/users', (c) => {
  const includeAdmins = c.req.query('includeAdmins') === 'true';
  return c.json(otcListUsers(includeAdmins));
});

otcRouter.post('/users', async (c) => {
  try {
    const body = await c.req.json();
    const user = otcCreateUser(body);
    return c.json(user);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

otcRouter.put('/users/:userId', async (c) => {
  try {
    const body = await c.req.json();
    const user = otcUpdateUser(c.req.param('userId'), body);
    return c.json(user);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

otcRouter.delete('/users/:userId', (c) => {
  try {
    otcDeleteUser(c.req.param('userId'));
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ── RFQ endpoints ─────────────────────────────────────────────────────────

otcRouter.get('/rfqs', (c) => {
  const userId = getOtcUserId(c);
  const user = otcGetUser(userId);
  const rfqs = otcListRFQs({ role: user.role, userId });
  return c.json(rfqs);
});

otcRouter.post('/rfqs', async (c) => {
  try {
    const body = await c.req.json();
    const rfq = otcCreateRFQ(body);
    broadcast({ type: 'otc_rfq_created', data: rfq } as any);
    return c.json(rfq);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

otcRouter.get('/rfqs/:rfqId', (c) => {
  try {
    return c.json(otcGetRFQ(c.req.param('rfqId')));
  } catch (err: any) {
    return c.json({ error: err.message }, 404);
  }
});

// ── Quote endpoints ───────────────────────────────────────────────────────

otcRouter.get('/quotes/:rfqId', (c) => {
  const userId = getOtcUserId(c);
  const user = otcGetUser(userId);
  return c.json(otcGetQuotesForRFQ(c.req.param('rfqId'), { role: user.role, userId }));
});

otcRouter.post('/quotes/submit', async (c) => {
  try {
    const body = await c.req.json();
    const quote = otcSubmitQuote(body);
    broadcast({ type: 'otc_quote_submitted', data: quote } as any);
    return c.json(quote);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

otcRouter.post('/quotes/counter', async (c) => {
  try {
    const body = await c.req.json();
    const quote = otcCounterQuote(body);
    broadcast({ type: 'otc_quote_countered', data: quote } as any);
    return c.json(quote);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

otcRouter.post('/quotes/accept', async (c) => {
  try {
    const { rfqId, quoteId, actorId, fillAmount } = await c.req.json();
    const rfq = otcAcceptQuote(rfqId, quoteId, actorId, fillAmount);
    broadcast({ type: 'otc_quote_accepted', data: rfq } as any);
    return c.json(rfq);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

otcRouter.post('/quotes/reject', async (c) => {
  try {
    const { rfqId, quoteId, actorId } = await c.req.json();
    const rfq = otcRejectQuote(rfqId, quoteId, actorId);
    broadcast({ type: 'otc_quote_rejected', data: rfq } as any);
    return c.json(rfq);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ── Escrow endpoints ──────────────────────────────────────────────────────

otcRouter.get('/escrow/:rfqId', (c) => {
  return c.json(otcGetEscrowStatusForRFQ(c.req.param('rfqId')));
});

otcRouter.post('/escrow/submit-tx', async (c) => {
  try {
    const { rfqId, partyRole, actorId, txHash } = await c.req.json();
    const rfq = otcSubmitEscrowTxHash(rfqId, partyRole, actorId, txHash);
    broadcast({ type: 'otc_escrow_submitted', data: rfq } as any);
    return c.json(rfq);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// ── Activity endpoints ────────────────────────────────────────────────────

otcRouter.get('/activity/:rfqId', (c) => {
  return c.json(otcGetNegotiationThread(c.req.param('rfqId')));
});

// ── Admin endpoints ───────────────────────────────────────────────────────

otcRouter.get('/admin/overview', (c) => {
  return c.json(otcGetAdminOverview());
});

otcRouter.get('/admin/rfqs', (c) => {
  return c.json(otcGetAdminRFQs());
});

otcRouter.get('/admin/escrow', (c) => {
  return c.json(otcGetAdminEscrow());
});

// ── Settlement endpoints (Atomic Swap) ───────────────────────────────────
//
// Flow:
// 1. Both parties register wallets via /settlement/register-wallet
// 2. /settlement/build creates ONE atomic transaction with both transfers
// 3. Each party signs the tx (partial sign) and submits via /settlement/submit-leg
// 4. When both signatures are collected, server assembles + submits to Contra
// 5. Either both transfers happen or neither does — truly atomic

// Register wallet address for settlement
otcRouter.post('/settlement/register-wallet', async (c) => {
  try {
    const { rfqId, userId, walletAddress } = await c.req.json();
    registerSettlementWallet(rfqId, userId, walletAddress);
    const rfq = otcGetRFQ(rfqId);

    // If both wallets are now registered and atomic tx not yet built, build it
    if (rfq.originatorWallet && rfq.providerWallet && !rfq.atomicSwapTx) {
      const trade = {
        id: rfqId, rfqId, quoteId: rfq.selectedQuoteId || '',
        partyA: rfq.originatorWallet, partyB: rfq.providerWallet,
        sellToken: rfq.sellToken, sellAmount: rfq.sellAmount,
        buyToken: rfq.buyToken, buyAmount: rfq.indicativeBuyAmount,
        price: rfq.acceptedPrice || '0', status: 'pending_signatures' as const,
        legASig: null, legBSig: null, createdAt: rfq.createdAt, completedAt: null,
      };

      try {
        const { transaction, signers } = await buildAtomicSwapTransaction(trade);
        storeAtomicSwapTx(rfqId, transaction, signers);
        broadcast({ type: 'otc_escrow_submitted', data: otcGetRFQ(rfqId) } as any);
      } catch (err: any) {
        console.error('Atomic swap tx build failed:', err.message);
      }
    }

    return c.json({ success: true, rfq: otcGetRFQ(rfqId) });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Build atomic swap transaction (called by frontend if tx not yet built)
otcRouter.post('/settlement/build', async (c) => {
  try {
    const { rfqId } = await c.req.json();
    const rfq = otcGetRFQ(rfqId);

    if (rfq.status !== 'ReadyToSettle') {
      return c.json({ error: 'RFQ is not ready for settlement' }, 400);
    }

    // Return existing atomic tx if already built
    if (rfq.atomicSwapTx && rfq.atomicSwapSigners) {
      return c.json({
        rfqId,
        atomicSwapTx: rfq.atomicSwapTx,
        signers: rfq.atomicSwapSigners,
        legASig: rfq.settlementLegASig,
        legBSig: rfq.settlementLegBSig,
      });
    }

    if (!rfq.originatorWallet || !rfq.providerWallet) {
      return c.json({ error: 'Both parties must register their wallet addresses first. Connect your wallet and try again.' }, 400);
    }

    // Validate Contra channel balances before building
    const { getChannelBalance } = await import('../services/contra.js');

    const originatorBalance = await getChannelBalance(rfq.originatorWallet, rfq.sellToken);
    const sellAmountRaw = BigInt(rfq.sellAmount);
    if (!originatorBalance || BigInt(originatorBalance.amount) < sellAmountRaw) {
      const has = originatorBalance ? originatorBalance.uiAmount : 0;
      const needs = Number(sellAmountRaw) / 1e6;
      return c.json({
        error: `Originator has insufficient Contra channel balance. Has ${has}, needs ${needs} ${rfq.sellToken.slice(0,8)}... Deposit to Contra first.`
      }, 400);
    }

    const providerBalance = await getChannelBalance(rfq.providerWallet, rfq.buyToken);
    const buyAmountRaw = BigInt(rfq.indicativeBuyAmount);
    if (!providerBalance || BigInt(providerBalance.amount) < buyAmountRaw) {
      const has = providerBalance ? providerBalance.uiAmount : 0;
      const needs = Number(buyAmountRaw) / 1e6;
      return c.json({
        error: `Liquidity provider has insufficient Contra channel balance. Has ${has}, needs ${needs} ${rfq.buyToken.slice(0,8)}... Deposit to Contra first.`
      }, 400);
    }

    const trade = {
      id: rfqId, rfqId, quoteId: rfq.selectedQuoteId || '',
      partyA: rfq.originatorWallet, partyB: rfq.providerWallet,
      sellToken: rfq.sellToken, sellAmount: rfq.sellAmount,
      buyToken: rfq.buyToken, buyAmount: rfq.indicativeBuyAmount,
      price: rfq.acceptedPrice || '0', status: 'pending_signatures' as const,
      legASig: null, legBSig: null, createdAt: rfq.createdAt, completedAt: null,
    };

    const { transaction, signers } = await buildAtomicSwapTransaction(trade);
    storeAtomicSwapTx(rfqId, transaction, signers);

    return c.json({ rfqId, atomicSwapTx: transaction, signers });
  } catch (err: any) {
    console.error('Settlement build failed:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// Get settlement info for an RFQ
otcRouter.get('/settlement/:rfqId', (c) => {
  try {
    const rfq = otcGetRFQ(c.req.param('rfqId'));
    return c.json({
      rfqId: rfq.id,
      status: rfq.status,
      atomicSwapTx: rfq.atomicSwapTx,
      signers: rfq.atomicSwapSigners,
      legASig: rfq.settlementLegASig,
      legBSig: rfq.settlementLegBSig,
      originatorId: rfq.originatorId,
      providerId: rfq.selectedProviderId,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 404);
  }
});

// Submit a partial signature for the atomic swap.
// The frontend signs the tx with the wallet (partial sign — only their slot)
// and sends the 64-byte signature as base64 here.
// When both sigs arrive, the server assembles and submits the fully-signed tx.
otcRouter.post('/settlement/submit-leg', async (c) => {
  try {
    const { rfqId, leg, signature } = await c.req.json();

    if (!rfqId || !leg || !signature) {
      return c.json({ error: 'rfqId, leg (A/B), and signature (base64) are required' }, 400);
    }

    const rfq = otcGetRFQ(rfqId);

    if (!rfq.atomicSwapTx || !rfq.atomicSwapSigners) {
      return c.json({ error: 'Atomic swap transaction not yet built. Call /settlement/build first.' }, 400);
    }

    // Re-validate Contra balances
    const { getChannelBalance } = await import('../services/contra.js');
    if (leg === 'A' && rfq.originatorWallet) {
      const bal = await getChannelBalance(rfq.originatorWallet, rfq.sellToken);
      if (!bal || BigInt(bal.amount) < BigInt(rfq.sellAmount)) {
        return c.json({ error: `Originator has insufficient Contra balance (${bal?.uiAmount ?? 0}). Deposit first.` }, 400);
      }
    }
    if (leg === 'B' && rfq.providerWallet) {
      const bal = await getChannelBalance(rfq.providerWallet, rfq.buyToken);
      if (!bal || BigInt(bal.amount) < BigInt(rfq.indicativeBuyAmount)) {
        return c.json({ error: `Provider has insufficient Contra balance (${bal?.uiAmount ?? 0}). Deposit first.` }, 400);
      }
    }

    console.log(`Atomic swap partial signature (leg ${leg}) submitted for RFQ ${rfqId}`);

    // Store the partial signature
    const updatedRfq = recordSettlementLegSig(rfqId, leg, signature);
    broadcast({ type: 'otc_escrow_submitted', data: updatedRfq } as any);

    // Check if both signatures are now present
    if (updatedRfq.settlementLegASig && updatedRfq.settlementLegBSig) {
      console.log(`Both signatures collected for RFQ ${rfqId}. Submitting atomic swap...`);

      // Assemble the fully-signed transaction and submit to Contra
      const sigMap = new Map<string, Buffer>();
      // signers[0] = originator (partyA), signers[1] = provider (partyB)
      sigMap.set(updatedRfq.atomicSwapSigners![0], Buffer.from(updatedRfq.settlementLegASig, 'base64'));
      sigMap.set(updatedRfq.atomicSwapSigners![1], Buffer.from(updatedRfq.settlementLegBSig, 'base64'));

      const txSig = await submitAtomicSwap(
        updatedRfq.atomicSwapTx!,
        updatedRfq.atomicSwapSigners!,
        sigMap,
      );

      console.log(`Atomic swap confirmed for RFQ ${rfqId}: ${txSig}`);

      // Mark as settled
      const settledRfq = completeAtomicSettlement(rfqId, txSig);
      broadcast({ type: 'trade_completed', data: settledRfq } as any);

      return c.json({ success: true, settled: true, txSignature: txSig, rfq: settledRfq });
    }

    return c.json({ success: true, settled: false, rfq: updatedRfq });
  } catch (err: any) {
    console.error('Settlement leg submission failed:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

// ── KYC/DID endpoints ─────────────────────────────────────────────────────

otcRouter.post('/kyc/initiate', async (c) => {
  try {
    const { walletAddress, jurisdiction, type } = await c.req.json();
    if (!walletAddress || !jurisdiction) {
      return c.json({ error: 'walletAddress and jurisdiction are required' }, 400);
    }

    const verificationType = type || 'kyc'; // 'kyc' or 'kyb'

    // Step 1: Register DID in SQLite
    const did = registerDID(walletAddress, jurisdiction);

    // Step 2: Create Zyphe verification session (KYC or KYB)
    const webhookUrl = process.env.ZYPHE_WEBHOOK_URL || 'http://localhost:8085';
    const sessionRes = await fetch(`${webhookUrl}/api/kyc/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, type: verificationType }),
    });

    if (!sessionRes.ok) {
      const errBody = await sessionRes.json().catch(() => null) as any;
      return c.json({ error: `Zyphe session failed: ${errBody?.error || 'unknown'}` }, 500);
    }

    const sessionData = await sessionRes.json() as any;

    return c.json({
      success: true,
      did: did.did,
      sessionUrl: sessionData.sessionUrl,
      sessionId: sessionData.sessionId,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Emails that always bypass KYC/KYB (test accounts)
const KYC_BYPASS_EMAILS = ['lp@contraotc.dev', 'rfq@contraotc.dev', 'admin@contraotc.dev'];

otcRouter.get('/kyc/status', (c) => {
  const wallet = c.req.query('wallet');
  const email = c.req.query('email');
  if (!wallet && !email) {
    return c.json({ error: 'wallet or email query param is required' }, 400);
  }

  // Check bypass list by email
  if (email && KYC_BYPASS_EMAILS.includes(email.toLowerCase())) {
    return c.json({ kycStatus: 'verified', did: 'bypass', attestationPda: null });
  }

  // Check by wallet first
  if (wallet) {
    const status = getKycStatusByWallet(wallet);
    if (status) return c.json(status);
  }

  // Fall back to email
  if (email) {
    // Check bypass list again
    if (KYC_BYPASS_EMAILS.includes(email.toLowerCase())) {
      return c.json({ kycStatus: 'verified', did: 'bypass', attestationPda: null });
    }
    const status = getKycStatusByEmail(email);
    if (status) return c.json(status);
  }

  return c.json({ kycStatus: 'not_found', did: null });
});

// Zyphe webhook forwarded from webhook server
otcRouter.post('/did/webhook/zyphe', async (c) => {
  try {
    const payload = await c.req.json();
    const { event, data, resultId, custom } = payload;
    const kyb = (data as any)?.kyb;
    const isKYB = Boolean(kyb);

    console.log(`Zyphe webhook received: event=${event} resultId=${resultId} isKYB=${isKYB}`);

    const walletAddress =
      (custom as any)?.customData?.walletAddress ||
      (custom as any)?.walletAddress ||
      (data as any)?.dv?.customData?.customData?.walletAddress;

    if (!walletAddress) {
      console.warn('Webhook missing walletAddress in custom data');
      return c.json({ success: false, error: 'No walletAddress in webhook' });
    }

    const kyc = (data as any)?.kyc;
    const dv = (data as any)?.dv;

    // KYB: always mark as verified (sandbox limitation)
    // KYC: respect the actual verification status
    let kycStatus: 'verified' | 'rejected';
    if (isKYB) {
      kycStatus = 'verified';
    } else {
      const status = kyc?.status || dv?.status || 'PASSED';
      kycStatus = status === 'PASSED' ? 'verified' : 'rejected';
      if (event === 'FAILED' || event === 'failed') {
        kycStatus = 'rejected';
      }
    }

    const result = processZypheVerification({
      walletAddress,
      kycStatus,
      resultId,
      identityEmail: dv?.identityEmail || kyc?.identityId || kyb?.identityEmail,
      metadata: {
        event,
        isKYB,
        flowId: dv?.flowId || kyb?.flowId,
        documentType: kyc?.documentType,
      },
    });

    console.log(`${isKYB ? 'KYB' : 'KYC'} ${kycStatus} for wallet ${walletAddress}`);

    // Create SAS attestation on-chain if verified
    if (kycStatus === 'verified') {
      try {
        const attestation = await createSASAttestation(walletAddress, result.jurisdiction);
        updateKycAttestation(walletAddress, attestation.attestationPda, attestation.signature, attestation.expiry);
        console.log(`SAS attestation created for ${walletAddress}`);
      } catch (err: any) {
        console.error('SAS attestation failed (status still marked verified):', err.message);
      }
    }

    return c.json({ success: true, data: { did: result.did, kycStatus: result.kycStatus } });
  } catch (err: any) {
    console.error('Zyphe webhook error:', err.message);
    return c.json({ success: false, error: 'Processing failed' });
  }
});

export default otcRouter;
export { initOtcSchema, seedOtcDemoData };
