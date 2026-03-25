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
} from '../db/otc-store.js';
import { broadcast } from '../services/ws.js';
import { createSASAttestation } from '../services/attestation.js';
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

// ── KYC/DID endpoints ─────────────────────────────────────────────────────

otcRouter.post('/kyc/initiate', async (c) => {
  try {
    const { walletAddress, jurisdiction } = await c.req.json();
    if (!walletAddress || !jurisdiction) {
      return c.json({ error: 'walletAddress and jurisdiction are required' }, 400);
    }

    // Step 1: Register DID in SQLite
    const did = registerDID(walletAddress, jurisdiction);

    // Step 2: Create Zyphe verification session
    const webhookUrl = process.env.ZYPHE_WEBHOOK_URL || 'http://localhost:8085';
    const sessionRes = await fetch(`${webhookUrl}/api/kyc/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
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

otcRouter.get('/kyc/status', (c) => {
  const wallet = c.req.query('wallet');
  const email = c.req.query('email');
  if (!wallet && !email) {
    return c.json({ error: 'wallet or email query param is required' }, 400);
  }
  const status = wallet ? getKycStatusByWallet(wallet) : getKycStatusByEmail(email!);
  if (!status) {
    return c.json({ kycStatus: 'not_found', did: null });
  }
  return c.json(status);
});

// Zyphe webhook forwarded from webhook server
otcRouter.post('/did/webhook/zyphe', async (c) => {
  try {
    const payload = await c.req.json();
    const { event, data, resultId, custom } = payload;

    const walletAddress =
      (custom as any)?.customData?.walletAddress ||
      (custom as any)?.walletAddress ||
      (data as any)?.dv?.customData?.customData?.walletAddress;

    if (!walletAddress) {
      return c.json({ success: false, error: 'No walletAddress in webhook' });
    }

    if (event === 'FAILED' || event === 'failed') {
      processZypheVerification({ walletAddress, kycStatus: 'rejected', resultId });
      return c.json({ success: true, message: 'Rejection processed' });
    }

    if (event !== 'COMPLETED') {
      return c.json({ success: true, message: 'Event acknowledged' });
    }

    const kyc = (data as any)?.kyc;
    const dv = (data as any)?.dv;
    const status = kyc?.status || dv?.status || 'PASSED';
    const kycStatus = status === 'PASSED' ? 'verified' : 'rejected';

    const result = processZypheVerification({
      walletAddress,
      kycStatus: kycStatus as 'verified' | 'rejected',
      resultId,
      identityEmail: dv?.identityEmail || kyc?.identityId,
      metadata: {
        flowId: dv?.flowId,
        documentType: kyc?.documentType,
      },
    });

    // If verified, create SAS attestation on-chain
    if (kycStatus === 'verified') {
      try {
        const attestation = await createSASAttestation(walletAddress, result.jurisdiction);
        updateKycAttestation(walletAddress, attestation.attestationPda, attestation.signature, attestation.expiry);
        console.log(`SAS attestation created for ${walletAddress}`);
      } catch (err: any) {
        console.error('SAS attestation failed (KYC still marked verified):', err.message);
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
