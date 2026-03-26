import type {
  ActivityEvent,
  CounterQuoteInput,
  CreateRFQInput,
  EscrowObligation,
  OTCAdminOverview,
  PlatformAccessRequest,
  PlatformAccessRequestInput,
  Quote,
  RFQ,
  SubmitQuoteInput,
  User,
  UserMutationInput,
  ViewerIdentity,
} from './types';
import { RFQStatus } from './types';
import { supabase } from '../supabase';

// ── Config ────────────────────────────────────────────────────────────────

// In dev, Vite proxies /api → localhost:3001. In prod, use the explicit target.
const OTC_API_BASE = (import.meta as any).env?.VITE_OTC_API_URL
  || '/api/otc';

// ── Fetch helper (uses Supabase access token) ─────────────────────────────

async function otcFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${OTC_API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Only sign out if we had a token (avoid clearing state on unauthenticated pages)
    if (token) {
      await supabase.auth.signOut();
    }
    throw new Error('Session expired. Please sign in again.');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data as T;
}

// ── Auth (Supabase) ──────────────────────────────────────────────────────

export async function authenticateUser(email: string, password: string): Promise<User> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  // Fetch the OTC user profile from backend (auto-provisions if first login)
  return otcFetch<User>('/auth/me');
}

export async function logoutUser(): Promise<void> {
  await supabase.auth.signOut();
}

export async function submitPlatformAccessRequest(
  input: PlatformAccessRequestInput,
): Promise<PlatformAccessRequest> {
  // Use backend admin API to create user (bypasses Supabase rate limits)
  const res = await fetch(`${OTC_API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: (input as any).password || 'contra123',
      contactName: input.contactName,
      fullName: input.contactName,
      institutionName: input.institutionName,
      requestedRoles: input.requestedRoles,
      role: input.requestedRoles[0] || 'RFQ_ORIGINATOR',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');

  return {
    id: data.user?.id || crypto.randomUUID(),
    institutionName: input.institutionName,
    contactName: input.contactName,
    email: input.email,
    institutionType: input.institutionType,
    jurisdiction: input.jurisdiction,
    requestedRoles: input.requestedRoles,
    status: 'SUBMITTED',
    createdAt: data.user?.createdAt || new Date().toISOString(),
  };
}

// ── Users ─────────────────────────────────────────────────────────────────

export async function listUsers(includeAdmins = false): Promise<User[]> {
  return otcFetch<User[]>(`/users?includeAdmins=${includeAdmins}`);
}

export async function createUser(input: UserMutationInput): Promise<User> {
  return otcFetch<User>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateUser(userId: string, input: UserMutationInput): Promise<User> {
  return otcFetch<User>(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await otcFetch<{ ok: boolean }>(`/users/${userId}`, {
    method: 'DELETE',
  });
}

// ── RFQs ──────────────────────────────────────────────────────────────────

export async function listRFQs(_viewer: ViewerIdentity): Promise<RFQ[]> {
  return otcFetch<RFQ[]>('/rfqs');
}

export async function createRFQ(input: CreateRFQInput): Promise<RFQ> {
  return otcFetch<RFQ>('/rfqs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getRFQ(rfqId: string): Promise<RFQ> {
  return otcFetch<RFQ>(`/rfqs/${rfqId}`);
}

// ── Quotes ────────────────────────────────────────────────────────────────

export async function getQuotesForRFQ(rfqId: string, _viewer: ViewerIdentity): Promise<Quote[]> {
  return otcFetch<Quote[]>(`/quotes/${rfqId}`);
}

export async function submitQuote(input: SubmitQuoteInput): Promise<Quote> {
  return otcFetch<Quote>('/quotes/submit', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function counterQuote(input: CounterQuoteInput): Promise<Quote> {
  return otcFetch<Quote>('/quotes/counter', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function acceptQuote(rfqId: string, quoteId: string, actorId: string, fillAmount?: string): Promise<RFQ> {
  return otcFetch<RFQ>('/quotes/accept', {
    method: 'POST',
    body: JSON.stringify({ rfqId, quoteId, actorId, fillAmount }),
  });
}

export async function rejectQuote(rfqId: string, quoteId: string, actorId: string): Promise<RFQ> {
  return otcFetch<RFQ>('/quotes/reject', {
    method: 'POST',
    body: JSON.stringify({ rfqId, quoteId, actorId }),
  });
}

// ── Escrow ────────────────────────────────────────────────────────────────

export async function getEscrowStatusForRFQ(rfqId: string): Promise<EscrowObligation[]> {
  return otcFetch<EscrowObligation[]>(`/escrow/${rfqId}`);
}

export async function submitEscrowTxHash(
  rfqId: string,
  partyRole: string,
  actorId: string,
  txHash: string,
): Promise<RFQ> {
  return otcFetch<RFQ>('/escrow/submit-tx', {
    method: 'POST',
    body: JSON.stringify({ rfqId, partyRole, actorId, txHash }),
  });
}

// ── Activity ──────────────────────────────────────────────────────────────

export async function getNegotiationThread(rfqId: string): Promise<ActivityEvent[]> {
  return otcFetch<ActivityEvent[]>(`/activity/${rfqId}`);
}

// ── Admin ─────────────────────────────────────────────────────────────────

export async function getAdminOverview(): Promise<OTCAdminOverview> {
  return otcFetch<OTCAdminOverview>('/admin/overview');
}

export async function getAdminRFQs(): Promise<(RFQ & { quoteCount: number; activityCount: number })[]> {
  return otcFetch<(RFQ & { quoteCount: number; activityCount: number })[]>('/admin/rfqs');
}

export async function getAdminEscrow(): Promise<(EscrowObligation & { rfqReference: string; rfqStatus: RFQStatus })[]> {
  return otcFetch<(EscrowObligation & { rfqReference: string; rfqStatus: RFQStatus })[]>('/admin/escrow');
}
