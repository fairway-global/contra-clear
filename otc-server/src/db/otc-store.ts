import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

// ── Types (mirror frontend types.ts) ──────────────────────────────────────

export type UserRole = 'RFQ_ORIGINATOR' | 'LIQUIDITY_PROVIDER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';
export type QuoteSide = 'sell' | 'buy';

export type RFQStatus =
  | 'Draft' | 'OpenForQuotes' | 'Negotiating' | 'QuoteSelected'
  | 'AwaitingOriginatorDeposit' | 'AwaitingProviderDeposit'
  | 'ReadyToSettle' | 'Settling' | 'Settled'
  | 'Expired' | 'Cancelled' | 'Defaulted';

export type QuoteStatus =
  | 'Draft' | 'Submitted' | 'Countered' | 'Negotiating'
  | 'Accepted' | 'Rejected' | 'Expired'
  | 'AwaitingDeposit' | 'Deposited' | 'Settled' | 'Cancelled';

export type EscrowStatus =
  | 'NotStarted' | 'DepositRequested' | 'PendingOnChain' | 'ConfirmedOnChain'
  | 'CreditedInContra' | 'LockedForSettlement' | 'Released'
  | 'Withdrawn' | 'Failed' | 'Expired';

export type ActivityType =
  | 'RFQ_CREATED' | 'QUOTE_SUBMITTED' | 'QUOTE_COUNTERED'
  | 'QUOTE_ACCEPTED' | 'QUOTE_REJECTED'
  | 'ESCROW_REQUESTED' | 'ESCROW_SUBMITTED' | 'ESCROW_LOCKED'
  | 'SETTLEMENT_STARTED' | 'SETTLEMENT_COMPLETED'
  | 'RFQ_UPDATED' | 'RFQ_CANCELLED';

export interface OtcUser {
  id: string;
  supabaseId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface OtcUserPublic {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface OtcRFQ {
  id: string;
  reference: string;
  sequence: string;
  originatorId: string;
  originatorName: string;
  sellToken: string;
  sellAmount: string;
  buyToken: string;
  indicativeBuyAmount: string;
  requiredTier: number;
  side: QuoteSide;
  status: RFQStatus;
  selectedQuoteId: string | null;
  selectedProviderId: string | null;
  selectedProviderName: string | null;
  acceptedPrice: string | null;
  filledAmount: string;
  originatorWallet: string | null;
  providerWallet: string | null;
  settlementLegATx: string | null;
  settlementLegBTx: string | null;
  settlementLegASig: string | null;
  settlementLegBSig: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface OtcQuote {
  id: string;
  rfqId: string;
  providerId: string;
  providerName: string;
  submittedByRole: UserRole;
  submittedByUserId: string;
  submittedByName: string;
  version: number;
  price: string;
  sellAmount: string;
  buyAmount: string;
  status: QuoteStatus;
  note: string | null;
  parentQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OtcEscrow {
  id: string;
  rfqId: string;
  partyRole: UserRole;
  partyId: string;
  partyName: string;
  tokenMint: string;
  amount: string;
  status: EscrowStatus;
  txHash: string | null;
  updatedAt: string;
}

export interface OtcActivity {
  id: string;
  rfqId: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  summary: string;
  detail: string | null;
  relatedQuoteId: string | null;
  createdAt: string;
}

export interface ViewerIdentity {
  role: UserRole;
  userId: string;
}

export interface CreateRFQInput {
  originatorId: string;
  sequence: string;
  sellToken: string;
  sellAmount: string;
  buyToken: string;
  indicativeBuyAmount: string;
  requiredTier: number;
  expiresInSeconds: number;
}

export interface SubmitQuoteInput {
  rfqId: string;
  providerId: string;
  price: string;
  buyAmount: string;
  note?: string;
}

export interface CounterQuoteInput {
  rfqId: string;
  quoteId: string;
  actorId: string;
  actorRole: UserRole;
  price: string;
  buyAmount: string;
  note?: string;
}

export interface UserMutationInput {
  fullName: string;
  email: string;
  role: 'RFQ_ORIGINATOR' | 'LIQUIDITY_PROVIDER';
  status: UserStatus;
}

export interface OTCAdminOverview {
  totalRFQs: number;
  openRFQs: number;
  negotiatingRFQs: number;
  awaitingDeposits: number;
  readyToSettle: number;
  settledRFQs: number;
  activeUsers: number;
}

// ── DB access ─────────────────────────────────────────────────────────────

import { getDb } from './store.js';

export function initOtcSchema(): void {
  const d = getDb();

  // Drop old otc_users table if it has password_hash (pre-Supabase schema)
  try {
    const cols = d.prepare("PRAGMA table_info(otc_users)").all() as any[];
    if (cols.some((c: any) => c.name === 'password_hash')) {
      d.exec('DROP TABLE otc_users');
    }
  } catch { /* table doesn't exist yet */ }

  d.exec(`
    CREATE TABLE IF NOT EXISTS otc_users (
      id TEXT PRIMARY KEY,
      supabase_id TEXT UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otc_rfqs (
      id TEXT PRIMARY KEY,
      reference TEXT UNIQUE NOT NULL,
      sequence TEXT NOT NULL DEFAULT '',
      originator_id TEXT NOT NULL,
      originator_name TEXT NOT NULL,
      sell_token TEXT NOT NULL,
      sell_amount TEXT NOT NULL,
      buy_token TEXT NOT NULL,
      indicative_buy_amount TEXT NOT NULL DEFAULT '0',
      required_tier INTEGER NOT NULL DEFAULT 1,
      side TEXT NOT NULL DEFAULT 'sell',
      status TEXT NOT NULL DEFAULT 'OpenForQuotes',
      selected_quote_id TEXT,
      selected_provider_id TEXT,
      selected_provider_name TEXT,
      accepted_price TEXT,
      filled_amount TEXT NOT NULL DEFAULT '0',
      originator_wallet TEXT,
      provider_wallet TEXT,
      settlement_leg_a_tx TEXT,
      settlement_leg_b_tx TEXT,
      settlement_leg_a_sig TEXT,
      settlement_leg_b_sig TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otc_quotes (
      id TEXT PRIMARY KEY,
      rfq_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      submitted_by_role TEXT NOT NULL,
      submitted_by_user_id TEXT NOT NULL,
      submitted_by_name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      price TEXT NOT NULL,
      sell_amount TEXT NOT NULL,
      buy_amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted',
      note TEXT,
      parent_quote_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otc_escrows (
      id TEXT PRIMARY KEY,
      rfq_id TEXT NOT NULL,
      party_role TEXT NOT NULL,
      party_id TEXT NOT NULL DEFAULT '',
      party_name TEXT NOT NULL DEFAULT '',
      token_mint TEXT NOT NULL,
      amount TEXT NOT NULL DEFAULT '0',
      status TEXT NOT NULL DEFAULT 'NotStarted',
      tx_hash TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otc_activities (
      id TEXT PRIMARY KEY,
      rfq_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      summary TEXT NOT NULL,
      detail TEXT,
      related_quote_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kyc_dids (
      id TEXT PRIMARY KEY,
      did TEXT UNIQUE NOT NULL,
      wallet_address TEXT UNIQUE NOT NULL,
      kyc_status TEXT NOT NULL DEFAULT 'pending',
      jurisdiction TEXT NOT NULL DEFAULT 'XX',
      kyc_provider TEXT DEFAULT 'zyphe',
      kyc_data TEXT,
      attestation_pda TEXT,
      attestation_tx TEXT,
      attestation_expiry INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ── Supabase user auto-provisioning ───────────────────────────────────────

export function getOrCreateOtcUserBySupabaseId(
  supabaseId: string,
  email: string,
  fullName: string,
  role: UserRole,
): OtcUserPublic {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM otc_users WHERE supabase_id = ?').get(supabaseId) as any;
  if (existing) return toPublicUser(mapUser(existing));

  // Check by email (may have been pre-created by admin)
  const byEmail = d.prepare('SELECT * FROM otc_users WHERE LOWER(email) = LOWER(?)').get(email) as any;
  if (byEmail) {
    // Link existing row to Supabase ID
    d.prepare('UPDATE otc_users SET supabase_id = ? WHERE id = ?').run(supabaseId, byEmail.id);
    return toPublicUser(mapUser({ ...byEmail, supabase_id: supabaseId }));
  }

  // Auto-provision new user
  const id = uuid();
  d.prepare(
    `INSERT INTO otc_users (id, supabase_id, full_name, email, role, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`
  ).run(id, supabaseId, fullName, email.trim().toLowerCase(), role, now());
  return otcGetUser(id);
}

export function getOtcUserBySupabaseId(supabaseId: string): OtcUserPublic | null {
  const d = getDb();
  const row = d.prepare('SELECT * FROM otc_users WHERE supabase_id = ?').get(supabaseId) as any;
  return row ? toPublicUser(mapUser(row)) : null;
}

// ── Row mappers ───────────────────────────────────────────────────────────

function mapUser(row: any): OtcUser {
  return {
    id: row.id,
    supabaseId: row.supabase_id ?? null,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toPublicUser(user: OtcUser): OtcUserPublic {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function mapRFQ(row: any): OtcRFQ {
  return {
    id: row.id,
    reference: row.reference,
    sequence: row.sequence || '',
    originatorId: row.originator_id,
    originatorName: row.originator_name,
    sellToken: row.sell_token,
    sellAmount: row.sell_amount,
    buyToken: row.buy_token,
    indicativeBuyAmount: row.indicative_buy_amount || '0',
    requiredTier: row.required_tier ?? 1,
    side: row.side || 'sell',
    status: row.status,
    selectedQuoteId: row.selected_quote_id ?? null,
    selectedProviderId: row.selected_provider_id ?? null,
    selectedProviderName: row.selected_provider_name ?? null,
    acceptedPrice: row.accepted_price ?? null,
    filledAmount: row.filled_amount || '0',
    originatorWallet: row.originator_wallet ?? null,
    providerWallet: row.provider_wallet ?? null,
    settlementLegATx: row.settlement_leg_a_tx ?? null,
    settlementLegBTx: row.settlement_leg_b_tx ?? null,
    settlementLegASig: row.settlement_leg_a_sig ?? null,
    settlementLegBSig: row.settlement_leg_b_sig ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

function mapQuote(row: any): OtcQuote {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    providerId: row.provider_id,
    providerName: row.provider_name,
    submittedByRole: row.submitted_by_role,
    submittedByUserId: row.submitted_by_user_id,
    submittedByName: row.submitted_by_name,
    version: row.version,
    price: row.price,
    sellAmount: row.sell_amount,
    buyAmount: row.buy_amount,
    status: row.status,
    note: row.note ?? null,
    parentQuoteId: row.parent_quote_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEscrow(row: any): OtcEscrow {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    partyRole: row.party_role,
    partyId: row.party_id || '',
    partyName: row.party_name || '',
    tokenMint: row.token_mint,
    amount: row.amount || '0',
    status: row.status,
    txHash: row.tx_hash ?? null,
    updatedAt: row.updated_at,
  };
}

function mapActivity(row: any): OtcActivity {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    type: row.type,
    actorId: row.actor_id,
    actorName: row.actor_name,
    summary: row.summary,
    detail: row.detail ?? null,
    relatedQuoteId: row.related_quote_id ?? null,
    createdAt: row.created_at,
  };
}

// ── Helper ────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function makeReference(index: number): string {
  return `RFQ-${String(index).padStart(4, '0')}`;
}

function insertActivity(
  d: Database.Database,
  rfqId: string,
  type: ActivityType,
  actorId: string,
  actorName: string,
  summary: string,
  detail?: string,
  relatedQuoteId?: string,
): void {
  d.prepare(
    `INSERT INTO otc_activities (id, rfq_id, type, actor_id, actor_name, summary, detail, related_quote_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), rfqId, type, actorId, actorName, summary, detail ?? null, relatedQuoteId ?? null, now());
}

// ── User operations ───────────────────────────────────────────────────────

export function otcListUsers(includeAdmins = false): OtcUserPublic[] {
  const d = getDb();
  const rows = includeAdmins
    ? d.prepare('SELECT * FROM otc_users ORDER BY created_at DESC').all()
    : d.prepare("SELECT * FROM otc_users WHERE role != 'ADMIN' ORDER BY created_at DESC").all();
  return rows.map((r: any) => toPublicUser(mapUser(r)));
}

export function otcGetUser(userId: string): OtcUserPublic {
  const d = getDb();
  const row = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(userId) as any;
  if (!row) throw new Error('User not found');
  return toPublicUser(mapUser(row));
}

export function otcCreateUser(input: UserMutationInput): OtcUserPublic {
  const d = getDb();
  const id = uuid();
  d.prepare(
    `INSERT INTO otc_users (id, full_name, email, role, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.fullName, input.email.trim().toLowerCase(), input.role, input.status, now());
  return otcGetUser(id);
}

export function otcUpdateUser(userId: string, input: UserMutationInput): OtcUserPublic {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(userId) as any;
  if (!existing) throw new Error('User not found');
  if (existing.role === 'ADMIN') throw new Error('Admin user management is read-only in this workflow.');
  d.prepare(
    `UPDATE otc_users SET full_name = ?, email = ?, role = ?, status = ? WHERE id = ?`
  ).run(input.fullName, input.email.trim().toLowerCase(), input.role, input.status, userId);
  return otcGetUser(userId);
}

export function otcDeleteUser(userId: string): void {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(userId) as any;
  if (!existing) throw new Error('User not found');
  if (existing.role === 'ADMIN') throw new Error('Admin users cannot be deleted here.');
  d.prepare('DELETE FROM otc_users WHERE id = ?').run(userId);
}

// ── RFQ operations ────────────────────────────────────────────────────────

export function otcListRFQs(viewer: ViewerIdentity): OtcRFQ[] {
  const d = getDb();
  let rows: any[];

  if (viewer.role === 'ADMIN') {
    rows = d.prepare('SELECT * FROM otc_rfqs ORDER BY updated_at DESC').all();
  } else if (viewer.role === 'RFQ_ORIGINATOR') {
    rows = d.prepare('SELECT * FROM otc_rfqs WHERE originator_id = ? ORDER BY updated_at DESC').all(viewer.userId);
  } else {
    // LP: show RFQs that are open or where this LP has quotes
    rows = d.prepare(`
      SELECT DISTINCT r.* FROM otc_rfqs r
      LEFT JOIN otc_quotes q ON q.rfq_id = r.id AND q.provider_id = ?
      WHERE r.status NOT IN ('Cancelled', 'Expired', 'Defaulted')
         OR q.id IS NOT NULL
      ORDER BY r.updated_at DESC
    `).all(viewer.userId);
  }

  return rows.map(mapRFQ);
}

export function otcCreateRFQ(input: CreateRFQInput): OtcRFQ {
  const d = getDb();
  const originator = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(input.originatorId) as any;
  if (!originator) throw new Error('Originator user not found');

  const rfqCount = (d.prepare('SELECT COUNT(*) as count FROM otc_rfqs').get() as any).count;
  const reference = makeReference(rfqCount + 1013);
  const id = uuid();
  const ts = now();
  const expiresInSeconds = Math.max(1, input.expiresInSeconds);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const txn = d.transaction(() => {
    d.prepare(
      `INSERT INTO otc_rfqs (id, reference, sequence, originator_id, originator_name, sell_token, sell_amount, buy_token, indicative_buy_amount, required_tier, side, status, filled_amount, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sell', 'OpenForQuotes', '0', ?, ?, ?)`
    ).run(id, reference, input.sequence, originator.id, originator.full_name, input.sellToken, input.sellAmount, input.buyToken, input.indicativeBuyAmount, input.requiredTier, ts, ts, expiresAt);

    // Originator escrow
    d.prepare(
      `INSERT INTO otc_escrows (id, rfq_id, party_role, party_id, party_name, token_mint, amount, status, updated_at)
       VALUES (?, ?, 'RFQ_ORIGINATOR', ?, ?, ?, ?, 'NotStarted', ?)`
    ).run(uuid(), id, originator.id, originator.full_name, input.sellToken, input.sellAmount, ts);

    // Provider escrow (placeholder)
    d.prepare(
      `INSERT INTO otc_escrows (id, rfq_id, party_role, party_id, party_name, token_mint, amount, status, updated_at)
       VALUES (?, ?, 'LIQUIDITY_PROVIDER', '', 'Awaiting quote selection', ?, '0', 'NotStarted', ?)`
    ).run(uuid(), id, input.buyToken, ts);

    insertActivity(d, id, 'RFQ_CREATED', originator.id, originator.full_name,
      'RFQ created and routed privately to eligible liquidity providers.',
      `Sequence ${input.sequence} · Tier ${input.requiredTier} · Expires in ${expiresInSeconds}s.`
    );
  });

  txn();
  return otcGetRFQ(id);
}

export function otcGetRFQ(rfqId: string): OtcRFQ {
  const d = getDb();
  const row = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(rfqId) as any;
  if (!row) throw new Error('RFQ not found');
  return mapRFQ(row);
}

// ── Quote operations ──────────────────────────────────────────────────────

export function otcGetQuotesForRFQ(rfqId: string, viewer: ViewerIdentity): OtcQuote[] {
  const d = getDb();
  let rows: any[];
  if (viewer.role === 'LIQUIDITY_PROVIDER') {
    rows = d.prepare('SELECT * FROM otc_quotes WHERE rfq_id = ? AND provider_id = ? ORDER BY updated_at DESC').all(rfqId, viewer.userId);
  } else {
    rows = d.prepare('SELECT * FROM otc_quotes WHERE rfq_id = ? ORDER BY updated_at DESC').all(rfqId);
  }
  return rows.map(mapQuote);
}

export function otcSubmitQuote(input: SubmitQuoteInput): OtcQuote {
  const d = getDb();
  const rfq = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(input.rfqId) as any;
  if (!rfq) throw new Error('RFQ not found');
  const provider = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(input.providerId) as any;
  if (!provider) throw new Error('Provider user not found');

  const existingVersions = d.prepare('SELECT * FROM otc_quotes WHERE rfq_id = ? AND provider_id = ? ORDER BY version DESC').all(input.rfqId, input.providerId) as any[];
  const latestVersion = existingVersions.length > 0 ? existingVersions[0].version : 0;
  const ts = now();
  const id = uuid();
  const status: QuoteStatus = existingVersions.length > 0 ? 'Negotiating' : 'Submitted';

  const txn = d.transaction(() => {
    d.prepare(
      `INSERT INTO otc_quotes (id, rfq_id, provider_id, provider_name, submitted_by_role, submitted_by_user_id, submitted_by_name, version, price, sell_amount, buy_amount, status, note, parent_quote_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'LIQUIDITY_PROVIDER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.rfqId, provider.id, provider.full_name, provider.id, provider.full_name,
      latestVersion + 1, input.price, rfq.sell_amount, input.buyAmount, status,
      input.note ?? null, existingVersions[0]?.id ?? null, ts, ts);

    // Update RFQ status if needed
    if (existingVersions.length > 0) {
      d.prepare("UPDATE otc_rfqs SET status = 'Negotiating', updated_at = ?, indicative_buy_amount = ? WHERE id = ?").run(ts, input.buyAmount, input.rfqId);
    } else {
      d.prepare("UPDATE otc_rfqs SET updated_at = ?, indicative_buy_amount = ? WHERE id = ?").run(ts, input.buyAmount, input.rfqId);
    }

    // Update provider escrow placeholder
    d.prepare(
      `UPDATE otc_escrows SET party_id = ?, party_name = ?, amount = ?, updated_at = ?
       WHERE rfq_id = ? AND party_role = 'LIQUIDITY_PROVIDER'`
    ).run(provider.id, provider.full_name, input.buyAmount, ts, input.rfqId);

    insertActivity(d, input.rfqId, 'QUOTE_SUBMITTED', provider.id, provider.full_name,
      existingVersions.length > 0 ? 'Quote revised by liquidity provider.' : 'Quote submitted by liquidity provider.',
      input.note, id);
  });

  txn();
  return mapQuote(d.prepare('SELECT * FROM otc_quotes WHERE id = ?').get(id) as any);
}

export function otcCounterQuote(input: CounterQuoteInput): OtcQuote {
  const d = getDb();
  const rfq = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(input.rfqId) as any;
  if (!rfq) throw new Error('RFQ not found');
  const priorQuote = d.prepare('SELECT * FROM otc_quotes WHERE id = ?').get(input.quoteId) as any;
  if (!priorQuote) throw new Error('Quote not found');
  const actor = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(input.actorId) as any;
  if (!actor) throw new Error('Actor user not found');

  const existingVersions = d.prepare('SELECT * FROM otc_quotes WHERE rfq_id = ? AND provider_id = ? ORDER BY version DESC').all(input.rfqId, priorQuote.provider_id) as any[];
  const latestVersion = existingVersions.length > 0 ? existingVersions[0].version : 0;
  const ts = now();
  const id = uuid();
  const counterStatus: QuoteStatus = input.actorRole === 'RFQ_ORIGINATOR' ? 'Countered' : 'Negotiating';

  const txn = d.transaction(() => {
    // Mark prior quote as Negotiating
    d.prepare("UPDATE otc_quotes SET status = 'Negotiating', updated_at = ? WHERE id = ?").run(ts, input.quoteId);

    d.prepare(
      `INSERT INTO otc_quotes (id, rfq_id, provider_id, provider_name, submitted_by_role, submitted_by_user_id, submitted_by_name, version, price, sell_amount, buy_amount, status, note, parent_quote_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.rfqId, priorQuote.provider_id, priorQuote.provider_name,
      input.actorRole, actor.id, actor.full_name,
      latestVersion + 1, input.price, rfq.sell_amount, input.buyAmount, counterStatus,
      input.note ?? null, input.quoteId, ts, ts);

    d.prepare("UPDATE otc_rfqs SET status = 'Negotiating', updated_at = ?, indicative_buy_amount = ? WHERE id = ?").run(ts, input.buyAmount, input.rfqId);

    d.prepare(
      `UPDATE otc_escrows SET party_id = ?, party_name = ?, amount = ?, updated_at = ?
       WHERE rfq_id = ? AND party_role = 'LIQUIDITY_PROVIDER'`
    ).run(priorQuote.provider_id, priorQuote.provider_name, input.buyAmount, ts, input.rfqId);

    insertActivity(d, input.rfqId, 'QUOTE_COUNTERED', actor.id, actor.full_name,
      input.actorRole === 'RFQ_ORIGINATOR' ? 'Originator sent a commercial counter.' : 'Liquidity provider revised pricing.',
      input.note, id);
  });

  txn();
  return mapQuote(d.prepare('SELECT * FROM otc_quotes WHERE id = ?').get(id) as any);
}

export function otcAcceptQuote(rfqId: string, quoteId: string, actorId: string, fillAmount?: string): OtcRFQ {
  const d = getDb();
  const rfq = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(rfqId) as any;
  if (!rfq) throw new Error('RFQ not found');
  const quote = d.prepare('SELECT * FROM otc_quotes WHERE id = ?').get(quoteId) as any;
  if (!quote) throw new Error('Quote not found');
  const actor = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(actorId) as any;
  if (!actor) throw new Error('Actor user not found');

  const ts = now();

  // Determine fill sizing
  const rfqSellAmount = BigInt(rfq.sell_amount);
  const currentFilled = BigInt(rfq.filled_amount || '0');
  const remaining = rfqSellAmount - currentFilled;
  const fillAmountBig = fillAmount ? BigInt(fillAmount) : remaining;
  const isPartial = fillAmountBig < remaining;

  // Scale escrow amounts proportionally to fill
  const fillRatio = Number(fillAmountBig) / Number(rfqSellAmount);
  const escrowSellAmount = fillAmountBig.toString();
  const escrowBuyAmount = Math.round(Number(quote.buy_amount) * fillRatio).toString();

  const txn = d.transaction(() => {
    // Update all quotes for this RFQ
    const allQuotes = d.prepare('SELECT * FROM otc_quotes WHERE rfq_id = ?').all(rfqId) as any[];
    for (const q of allQuotes) {
      if (q.id === quoteId) {
        d.prepare("UPDATE otc_quotes SET status = 'Accepted', updated_at = ? WHERE id = ?").run(ts, q.id);
      } else if (q.provider_id !== quote.provider_id && q.status !== 'Settled') {
        d.prepare("UPDATE otc_quotes SET status = 'Rejected', updated_at = ? WHERE id = ?").run(ts, q.id);
      } else if (q.id !== quoteId && q.status !== 'Settled') {
        d.prepare("UPDATE otc_quotes SET status = 'Negotiating', updated_at = ? WHERE id = ?").run(ts, q.id);
      }
    }

    // Update RFQ — go directly to ReadyToSettle (settlement via Contra channel swap)
    d.prepare(
      `UPDATE otc_rfqs SET status = 'ReadyToSettle', selected_quote_id = ?, selected_provider_id = ?,
       selected_provider_name = ?, accepted_price = ?, sell_amount = ?, indicative_buy_amount = ?, updated_at = ?
       WHERE id = ?`
    ).run(quote.id, quote.provider_id, quote.provider_name, quote.price,
      quote.sell_amount, quote.buy_amount, ts, rfqId);

    // Update escrow records for display (amounts each party will swap)
    d.prepare(
      `UPDATE otc_escrows SET amount = ?, status = 'LockedForSettlement', updated_at = ?
       WHERE rfq_id = ? AND party_role = 'RFQ_ORIGINATOR'`
    ).run(escrowSellAmount, ts, rfqId);

    d.prepare(
      `UPDATE otc_escrows SET party_id = ?, party_name = ?, amount = ?, status = 'LockedForSettlement', updated_at = ?
       WHERE rfq_id = ? AND party_role = 'LIQUIDITY_PROVIDER'`
    ).run(quote.provider_id, quote.provider_name, escrowBuyAmount, ts, rfqId);

    insertActivity(d, rfqId, 'QUOTE_ACCEPTED', actor.id, actor.full_name,
      isPartial
        ? `Terms accepted for partial fill (${escrowSellAmount} of ${rfq.sell_amount}). Sign settlement to swap on Contra channel.`
        : 'Commercial terms accepted. Sign settlement to swap tokens on Contra channel.',
      `Accepted ${quote.provider_name} at ${quote.price}.`,
      quoteId);
  });

  txn();
  return otcGetRFQ(rfqId);
}

export function otcRejectQuote(rfqId: string, quoteId: string, actorId: string): OtcRFQ {
  const d = getDb();
  const rfq = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(rfqId) as any;
  if (!rfq) throw new Error('RFQ not found');
  const quote = d.prepare('SELECT * FROM otc_quotes WHERE id = ?').get(quoteId) as any;
  if (!quote) throw new Error('Quote not found');
  const actor = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(actorId) as any;
  if (!actor) throw new Error('Actor user not found');

  const ts = now();

  const txn = d.transaction(() => {
    d.prepare("UPDATE otc_quotes SET status = 'Rejected', updated_at = ? WHERE id = ?").run(ts, quoteId);
    d.prepare("UPDATE otc_rfqs SET status = 'OpenForQuotes', updated_at = ? WHERE id = ?").run(ts, rfqId);

    insertActivity(d, rfqId, 'QUOTE_REJECTED', actor.id, actor.full_name,
      'Quote rejected by originator.',
      `Rejected ${quote.provider_name}.`,
      quoteId);
  });

  txn();
  return otcGetRFQ(rfqId);
}

// ── Escrow operations ─────────────────────────────────────────────────────

export function otcGetEscrowStatusForRFQ(rfqId: string): OtcEscrow[] {
  const d = getDb();
  return d.prepare('SELECT * FROM otc_escrows WHERE rfq_id = ? ORDER BY party_role').all(rfqId).map(mapEscrow);
}

export function otcSubmitEscrowTxHash(rfqId: string, partyRole: UserRole, actorId: string, txHash: string): OtcRFQ {
  const d = getDb();
  const rfq = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(rfqId) as any;
  if (!rfq) throw new Error('RFQ not found');
  const actor = d.prepare('SELECT * FROM otc_users WHERE id = ?').get(actorId) as any;
  if (!actor) throw new Error('Actor user not found');
  const obligation = d.prepare('SELECT * FROM otc_escrows WHERE rfq_id = ? AND party_role = ?').get(rfqId, partyRole) as any;
  if (!obligation) throw new Error('Escrow obligation not found');
  const counterpart = d.prepare('SELECT * FROM otc_escrows WHERE rfq_id = ? AND party_role != ?').get(rfqId, partyRole) as any;

  const ts = now();

  const txn = d.transaction(() => {
    // Update obligation
    d.prepare("UPDATE otc_escrows SET tx_hash = ?, status = 'CreditedInContra', updated_at = ? WHERE id = ?").run(txHash, ts, obligation.id);

    // Update accepted quote status
    if (rfq.selected_quote_id) {
      const acceptedQuote = d.prepare('SELECT * FROM otc_quotes WHERE id = ?').get(rfq.selected_quote_id) as any;
      if (acceptedQuote && acceptedQuote.status === 'Accepted') {
        d.prepare("UPDATE otc_quotes SET status = 'AwaitingDeposit', updated_at = ? WHERE id = ?").run(ts, acceptedQuote.id);
      }
    }

    insertActivity(d, rfqId, 'ESCROW_SUBMITTED', actor.id, actor.full_name,
      `${partyRole === 'RFQ_ORIGINATOR' ? 'Originator' : 'Liquidity provider'} escrow deposit submitted.`,
      `Tx hash ${txHash}.`);

    if (partyRole === 'RFQ_ORIGINATOR') {
      d.prepare("UPDATE otc_rfqs SET status = 'AwaitingProviderDeposit', updated_at = ? WHERE id = ?").run(ts, rfqId);
    }

    // Check if both parties have deposited → lock escrows and prepare for settlement
    const counterStatus = counterpart?.status;
    if (counterStatus === 'CreditedInContra' || counterStatus === 'LockedForSettlement' || counterStatus === 'Released') {
      // Lock both escrows
      d.prepare("UPDATE otc_escrows SET status = 'LockedForSettlement', updated_at = ? WHERE id = ?").run(ts, obligation.id);
      if (counterStatus !== 'Released') {
        d.prepare("UPDATE otc_escrows SET status = 'LockedForSettlement', updated_at = ? WHERE id = ?").run(ts, counterpart.id);
      }

      // Set RFQ to ReadyToSettle — actual settlement requires both parties to sign swap legs
      d.prepare("UPDATE otc_rfqs SET status = 'ReadyToSettle', updated_at = ? WHERE id = ?").run(ts, rfqId);

      insertActivity(d, rfqId, 'ESCROW_LOCKED', actor.id, actor.full_name,
        'Both escrows locked. Sign settlement transactions to complete the swap.');
    } else {
      d.prepare("UPDATE otc_rfqs SET updated_at = ? WHERE id = ?").run(ts, rfqId);
    }
  });

  txn();
  return otcGetRFQ(rfqId);
}

// ── Activity operations ───────────────────────────────────────────────────

export function otcGetNegotiationThread(rfqId: string): OtcActivity[] {
  const d = getDb();
  return d.prepare('SELECT * FROM otc_activities WHERE rfq_id = ? ORDER BY created_at DESC').all(rfqId).map(mapActivity);
}

// ── Admin operations ──────────────────────────────────────────────────────

export function otcGetAdminOverview(): OTCAdminOverview {
  const d = getDb();
  const totalRFQs = (d.prepare('SELECT COUNT(*) as c FROM otc_rfqs').get() as any).c;
  const openRFQs = (d.prepare("SELECT COUNT(*) as c FROM otc_rfqs WHERE status = 'OpenForQuotes'").get() as any).c;
  const negotiatingRFQs = (d.prepare("SELECT COUNT(*) as c FROM otc_rfqs WHERE status = 'Negotiating'").get() as any).c;
  const awaitingDeposits = (d.prepare("SELECT COUNT(*) as c FROM otc_rfqs WHERE status IN ('AwaitingOriginatorDeposit','AwaitingProviderDeposit')").get() as any).c;
  const readyToSettle = (d.prepare("SELECT COUNT(*) as c FROM otc_rfqs WHERE status IN ('ReadyToSettle','Settling')").get() as any).c;
  const settledRFQs = (d.prepare("SELECT COUNT(*) as c FROM otc_rfqs WHERE status = 'Settled'").get() as any).c;
  const activeUsers = (d.prepare("SELECT COUNT(*) as c FROM otc_users WHERE status = 'ACTIVE'").get() as any).c;

  return { totalRFQs, openRFQs, negotiatingRFQs, awaitingDeposits, readyToSettle, settledRFQs, activeUsers };
}

export function otcGetAdminRFQs(): (OtcRFQ & { quoteCount: number; activityCount: number })[] {
  const d = getDb();
  const rfqs = d.prepare('SELECT * FROM otc_rfqs ORDER BY updated_at DESC').all().map(mapRFQ);

  return rfqs.map(rfq => {
    // Count only latest quote per provider (deduplicated by provider)
    const providerCount = (d.prepare(
      `SELECT COUNT(DISTINCT provider_id) as c FROM otc_quotes WHERE rfq_id = ?`
    ).get(rfq.id) as any).c;
    const activityCount = (d.prepare(
      'SELECT COUNT(*) as c FROM otc_activities WHERE rfq_id = ?'
    ).get(rfq.id) as any).c;
    return { ...rfq, quoteCount: providerCount, activityCount };
  });
}

export function otcGetAdminEscrow(): (OtcEscrow & { rfqReference: string; rfqStatus: RFQStatus })[] {
  const d = getDb();
  const rows = d.prepare(`
    SELECT e.*, r.reference as rfq_reference, r.status as rfq_status
    FROM otc_escrows e
    JOIN otc_rfqs r ON r.id = e.rfq_id
    ORDER BY e.updated_at DESC
  `).all() as any[];

  return rows.map(row => ({
    ...mapEscrow(row),
    rfqReference: row.rfq_reference,
    rfqStatus: row.rfq_status,
  }));
}

// ── Seed demo data ────────────────────────────────────────────────────────

// ── Settlement operations ─────────────────────────────────────────────────

export function registerSettlementWallet(rfqId: string, userId: string, walletAddress: string): void {
  const d = getDb();
  const rfq = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(rfqId) as any;
  if (!rfq) throw new Error('RFQ not found');
  if (userId === rfq.originator_id) {
    d.prepare('UPDATE otc_rfqs SET originator_wallet = ?, updated_at = ? WHERE id = ?').run(walletAddress, now(), rfqId);
  } else if (userId === rfq.selected_provider_id) {
    d.prepare('UPDATE otc_rfqs SET provider_wallet = ?, updated_at = ? WHERE id = ?').run(walletAddress, now(), rfqId);
  }
}

export function storeSettlementLegs(rfqId: string, legATx: string, legBTx: string): void {
  const d = getDb();
  d.prepare(
    `UPDATE otc_rfqs SET settlement_leg_a_tx = ?, settlement_leg_b_tx = ?, updated_at = ? WHERE id = ?`
  ).run(legATx, legBTx, now(), rfqId);
}

export function recordSettlementLegSig(rfqId: string, leg: 'A' | 'B', signature: string): OtcRFQ {
  const d = getDb();
  const ts = now();
  const col = leg === 'A' ? 'settlement_leg_a_sig' : 'settlement_leg_b_sig';
  d.prepare(`UPDATE otc_rfqs SET ${col} = ?, updated_at = ? WHERE id = ?`).run(signature, ts, rfqId);

  // Check if both legs are now signed → complete settlement
  const rfq = d.prepare('SELECT * FROM otc_rfqs WHERE id = ?').get(rfqId) as any;
  if (rfq.settlement_leg_a_sig && rfq.settlement_leg_b_sig) {
    const txn = d.transaction(() => {
      d.prepare("UPDATE otc_rfqs SET status = 'Settling', updated_at = ? WHERE id = ?").run(ts, rfqId);
      insertActivity(d, rfqId, 'SETTLEMENT_STARTED', '', 'System',
        'Both settlement legs signed. Executing swap on Contra channel.');

      // Release escrows
      d.prepare("UPDATE otc_escrows SET status = 'Released', updated_at = ? WHERE rfq_id = ?").run(ts, rfqId);

      // Update filled amount
      const currentFilled = BigInt(rfq.filled_amount || '0');
      const originatorEscrow = d.prepare("SELECT * FROM otc_escrows WHERE rfq_id = ? AND party_role = 'RFQ_ORIGINATOR'").get(rfqId) as any;
      const fillIncrement = BigInt(originatorEscrow?.amount || rfq.sell_amount);
      const newFilled = currentFilled + fillIncrement;
      const totalSell = BigInt(rfq.sell_amount);

      if (newFilled >= totalSell) {
        d.prepare("UPDATE otc_rfqs SET status = 'Settled', filled_amount = ?, updated_at = ? WHERE id = ?").run(newFilled.toString(), ts, rfqId);
      } else {
        d.prepare("UPDATE otc_rfqs SET status = 'OpenForQuotes', filled_amount = ?, selected_quote_id = NULL, selected_provider_id = NULL, selected_provider_name = NULL, accepted_price = NULL, settlement_leg_a_tx = NULL, settlement_leg_b_tx = NULL, settlement_leg_a_sig = NULL, settlement_leg_b_sig = NULL, updated_at = ? WHERE id = ?").run(newFilled.toString(), ts, rfqId);
      }

      if (rfq.selected_quote_id) {
        d.prepare("UPDATE otc_quotes SET status = 'Settled', updated_at = ? WHERE id = ?").run(ts, rfq.selected_quote_id);
      }

      insertActivity(d, rfqId, 'SETTLEMENT_COMPLETED', '', 'System',
        newFilled >= totalSell
          ? 'Settlement completed. Funds swapped on Contra channel.'
          : `Partial settlement completed. RFQ reopened for remaining amount.`);
    });
    txn();
  }

  return otcGetRFQ(rfqId);
}

// ── KYC/DID operations ────────────────────────────────────────────────────

export interface KycDid {
  id: string;
  did: string;
  walletAddress: string;
  kycStatus: 'pending' | 'verified' | 'rejected' | 'expired';
  jurisdiction: string;
  kycProvider: string;
  kycData: Record<string, unknown> | null;
  attestationPda: string | null;
  attestationTx: string | null;
  attestationExpiry: number | null;
  createdAt: string;
  updatedAt: string;
}

function mapKycDid(row: any): KycDid {
  return {
    id: row.id,
    did: row.did,
    walletAddress: row.wallet_address,
    kycStatus: row.kyc_status,
    jurisdiction: row.jurisdiction,
    kycProvider: row.kyc_provider || 'zyphe',
    kycData: row.kyc_data ? JSON.parse(row.kyc_data) : null,
    attestationPda: row.attestation_pda ?? null,
    attestationTx: row.attestation_tx ?? null,
    attestationExpiry: row.attestation_expiry ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerDID(walletAddress: string, jurisdiction: string): KycDid {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM kyc_dids WHERE wallet_address = ?').get(walletAddress) as any;
  if (existing) return mapKycDid(existing);

  const id = uuid();
  const did = `did:contra:devnet:${walletAddress}`;
  const ts = now();
  d.prepare(
    `INSERT INTO kyc_dids (id, did, wallet_address, kyc_status, jurisdiction, kyc_provider, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, 'zyphe', ?, ?)`
  ).run(id, did, walletAddress, jurisdiction, ts, ts);
  return mapKycDid(d.prepare('SELECT * FROM kyc_dids WHERE id = ?').get(id) as any);
}

export function getKycStatusByWallet(walletAddress: string): { kycStatus: string; did: string; attestationPda: string | null } | null {
  const d = getDb();
  const row = d.prepare('SELECT * FROM kyc_dids WHERE wallet_address = ?').get(walletAddress) as any;
  if (!row) return null;
  return { kycStatus: row.kyc_status, did: row.did, attestationPda: row.attestation_pda ?? null };
}

export function getKycStatusByEmail(email: string): { kycStatus: string; did: string; attestationPda: string | null } | null {
  const d = getDb();
  // Check if email is stored directly as wallet_address (admin bypass)
  const byEmail = d.prepare('SELECT * FROM kyc_dids WHERE LOWER(wallet_address) = LOWER(?)').get(email) as any;
  if (byEmail) return { kycStatus: byEmail.kyc_status, did: byEmail.did, attestationPda: byEmail.attestation_pda ?? null };
  // Otherwise look up user's wallet from otc_users
  const user = d.prepare('SELECT * FROM otc_users WHERE LOWER(email) = LOWER(?)').get(email) as any;
  if (!user) return null;
  return { kycStatus: 'not_found', did: '', attestationPda: null };
}

export function processZypheVerification(data: {
  walletAddress: string;
  kycStatus: 'verified' | 'rejected';
  resultId: string;
  identityEmail?: string;
  metadata?: Record<string, unknown>;
}): KycDid {
  const d = getDb();
  let row = d.prepare('SELECT * FROM kyc_dids WHERE wallet_address = ?').get(data.walletAddress) as any;

  if (!row) {
    const id = uuid();
    const did = `did:contra:devnet:${data.walletAddress}`;
    const ts = now();
    d.prepare(
      `INSERT INTO kyc_dids (id, did, wallet_address, kyc_status, jurisdiction, kyc_provider, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 'XX', 'zyphe', ?, ?)`
    ).run(id, did, data.walletAddress, ts, ts);
    row = d.prepare('SELECT * FROM kyc_dids WHERE id = ?').get(id) as any;
  }

  const ts = now();
  const kycDataJson = JSON.stringify({
    resultId: data.resultId,
    identityEmail: data.identityEmail,
    verifiedAt: ts,
    ...data.metadata,
  });

  d.prepare(
    `UPDATE kyc_dids SET kyc_status = ?, kyc_data = ?, updated_at = ? WHERE wallet_address = ?`
  ).run(data.kycStatus, kycDataJson, ts, data.walletAddress);

  return mapKycDid(d.prepare('SELECT * FROM kyc_dids WHERE wallet_address = ?').get(data.walletAddress) as any);
}

export function updateKycAttestation(walletAddress: string, attestationPda: string, attestationTx: string, attestationExpiry: number): void {
  const d = getDb();
  d.prepare(
    `UPDATE kyc_dids SET attestation_pda = ?, attestation_tx = ?, attestation_expiry = ?, updated_at = ? WHERE wallet_address = ?`
  ).run(attestationPda, attestationTx, attestationExpiry, now(), walletAddress);
}

// ── Seed demo data ────────────────────────────────────────────────────────

export function seedOtcDemoData(): void {
  // With Supabase auth, users are created through signup flow.
  // This is kept as a no-op for backward compat. Users auto-provision on first Supabase login.
  console.log('OTC auth: Supabase mode — users auto-provision on first login.');
}
