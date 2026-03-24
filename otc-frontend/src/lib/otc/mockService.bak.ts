import { formatRawAmount, getTokenSymbol, toRawAmount } from '../constants';
import {
  type ActivityEvent,
  type CounterQuoteInput,
  type CreateRFQInput,
  type EscrowObligation,
  EscrowStatus,
  type OTCAdminOverview,
  type PlatformAccessRequest,
  type PlatformAccessRequestInput,
  type Quote,
  QuoteStatus,
  type RFQ,
  RFQStatus,
  type SubmitQuoteInput,
  type User,
  type UserMutationInput,
  UserRole,
  type ViewerIdentity,
} from './types';

const STORAGE_KEY = 'contra-otc-mock-v1';
const ACCESS_REQUESTS_KEY = 'contra-otc-access-requests-v1';

const DEMO_PASSWORDS: Record<string, string> = {
  'originator@contraotc.dev': 'contra123',
  'lp1@contraotc.dev': 'contra123',
  'lp2@contraotc.dev': 'contra123',
  'admin@contraotc.dev': 'contra123',
};

interface MockState {
  users: User[];
  rfqs: RFQ[];
  quotes: Quote[];
  escrows: EscrowObligation[];
  activities: ActivityEvent[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function delay<T>(value: T, waitMs = 90): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(clone(value)), waitMs));
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function isoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeReference(index: number): string {
  return `RFQ-${String(index).padStart(4, '0')}`;
}

function seedState(): MockState {
  const users: User[] = [
    {
      id: 'user-originator-1',
      fullName: 'Alemu Treasury Partners',
      email: 'originator@contraotc.dev',
      role: UserRole.RFQ_ORIGINATOR,
      status: 'ACTIVE',
      createdAt: isoMinutesAgo(1440),
    },
    {
      id: 'user-provider-1',
      fullName: 'Nile Liquidity Desk',
      email: 'lp1@contraotc.dev',
      role: UserRole.LIQUIDITY_PROVIDER,
      status: 'ACTIVE',
      createdAt: isoMinutesAgo(1500),
    },
    {
      id: 'user-provider-2',
      fullName: 'Horn Market Makers',
      email: 'lp2@contraotc.dev',
      role: UserRole.LIQUIDITY_PROVIDER,
      status: 'ACTIVE',
      createdAt: isoMinutesAgo(1320),
    },
    {
      id: 'user-admin-1',
      fullName: 'Contra Ops Admin',
      email: 'admin@contraotc.dev',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
      createdAt: isoMinutesAgo(2880),
    },
  ];

  const rfqs: RFQ[] = [
    {
      id: 'rfq-open-1',
      reference: makeReference(1012),
      sequence: '1774069873334',
      originatorId: 'user-originator-1',
      originatorName: 'Alemu Treasury Partners',
      sellToken: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      sellAmount: '2000000',
      buyToken: 'So11111111111111111111111111111111111111112',
      indicativeBuyAmount: '100000000',
      requiredTier: 1,
      expiresInSeconds: 3600,
      side: 'sell',
      status: RFQStatus.OpenForQuotes,
      createdAt: isoMinutesAgo(18),
      updatedAt: isoMinutesAgo(18),
      expiresAt: isoMinutesFromNow(55),
      notes: 'Private interest for same-day bilateral settlement.',
    },
    {
      id: 'rfq-negotiating-1',
      reference: makeReference(1011),
      sequence: '1774069851022',
      originatorId: 'user-originator-1',
      originatorName: 'Alemu Treasury Partners',
      sellToken: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      sellAmount: '7500000',
      buyToken: 'So11111111111111111111111111111111111111112',
      indicativeBuyAmount: '365000000',
      requiredTier: 1,
      expiresInSeconds: 3600,
      side: 'sell',
      status: RFQStatus.Negotiating,
      createdAt: isoMinutesAgo(94),
      updatedAt: isoMinutesAgo(9),
      expiresAt: isoMinutesFromNow(26),
      notes: 'Tight execution window. Provider to confirm inventory within 15 minutes.',
    },
    {
      id: 'rfq-settled-1',
      reference: makeReference(1010),
      sequence: '1774069600451',
      originatorId: 'user-originator-1',
      originatorName: 'Alemu Treasury Partners',
      sellToken: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      sellAmount: '1000000',
      buyToken: 'So11111111111111111111111111111111111111112',
      indicativeBuyAmount: '48000000',
      requiredTier: 1,
      expiresInSeconds: 3600,
      side: 'sell',
      status: RFQStatus.Settled,
      createdAt: isoMinutesAgo(360),
      updatedAt: isoMinutesAgo(240),
      expiresAt: isoMinutesAgo(300),
      selectedQuoteId: 'quote-settled-2',
      selectedProviderId: 'user-provider-1',
      selectedProviderName: 'Nile Liquidity Desk',
      acceptedPrice: '0.0480',
      notes: 'Reference settlement completed during London overlap.',
    },
  ];

  const quotes: Quote[] = [
    {
      id: 'quote-negotiating-1',
      rfqId: 'rfq-negotiating-1',
      providerId: 'user-provider-1',
      providerName: 'Nile Liquidity Desk',
      submittedByRole: UserRole.LIQUIDITY_PROVIDER,
      submittedByUserId: 'user-provider-1',
      submittedByName: 'Nile Liquidity Desk',
      version: 1,
      price: '0.0481',
      sellAmount: '7500000',
      buyAmount: '360750000',
      status: QuoteStatus.Negotiating,
      note: 'Indicative initial quote for firm size.',
      createdAt: isoMinutesAgo(72),
      updatedAt: isoMinutesAgo(72),
    },
    {
      id: 'quote-negotiating-2',
      rfqId: 'rfq-negotiating-1',
      providerId: 'user-provider-1',
      providerName: 'Nile Liquidity Desk',
      submittedByRole: UserRole.RFQ_ORIGINATOR,
      submittedByUserId: 'user-originator-1',
      submittedByName: 'Alemu Treasury Partners',
      version: 2,
      price: '0.0480',
      sellAmount: '7500000',
      buyAmount: '360000000',
      status: QuoteStatus.Countered,
      note: 'Countered tighter after internal check.',
      createdAt: isoMinutesAgo(28),
      updatedAt: isoMinutesAgo(28),
      parentQuoteId: 'quote-negotiating-1',
    },
    {
      id: 'quote-negotiating-3',
      rfqId: 'rfq-negotiating-1',
      providerId: 'user-provider-1',
      providerName: 'Nile Liquidity Desk',
      submittedByRole: UserRole.LIQUIDITY_PROVIDER,
      submittedByUserId: 'user-provider-1',
      submittedByName: 'Nile Liquidity Desk',
      version: 3,
      price: '0.0480',
      sellAmount: '7500000',
      buyAmount: '360000000',
      status: QuoteStatus.Submitted,
      note: 'Matched counter. Ready to proceed.',
      createdAt: isoMinutesAgo(9),
      updatedAt: isoMinutesAgo(9),
      parentQuoteId: 'quote-negotiating-2',
    },
    {
      id: 'quote-settled-1',
      rfqId: 'rfq-settled-1',
      providerId: 'user-provider-2',
      providerName: 'Horn Market Makers',
      submittedByRole: UserRole.LIQUIDITY_PROVIDER,
      submittedByUserId: 'user-provider-2',
      submittedByName: 'Horn Market Makers',
      version: 1,
      price: '0.0477',
      sellAmount: '1000000',
      buyAmount: '47700000',
      status: QuoteStatus.Rejected,
      note: 'Initial quote not selected.',
      createdAt: isoMinutesAgo(350),
      updatedAt: isoMinutesAgo(340),
    },
    {
      id: 'quote-settled-2',
      rfqId: 'rfq-settled-1',
      providerId: 'user-provider-1',
      providerName: 'Nile Liquidity Desk',
      submittedByRole: UserRole.LIQUIDITY_PROVIDER,
      submittedByUserId: 'user-provider-1',
      submittedByName: 'Nile Liquidity Desk',
      version: 1,
      price: '0.0480',
      sellAmount: '1000000',
      buyAmount: '48000000',
      status: QuoteStatus.Settled,
      note: 'Accepted and settled.',
      createdAt: isoMinutesAgo(340),
      updatedAt: isoMinutesAgo(240),
    },
  ];

  const escrows: EscrowObligation[] = [
    {
      id: 'escrow-open-originator',
      rfqId: 'rfq-open-1',
      partyRole: UserRole.RFQ_ORIGINATOR,
      partyId: 'user-originator-1',
      partyName: 'Alemu Treasury Partners',
      tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      amount: '2000000',
      status: EscrowStatus.NotStarted,
      updatedAt: isoMinutesAgo(18),
    },
    {
      id: 'escrow-open-provider',
      rfqId: 'rfq-open-1',
      partyRole: UserRole.LIQUIDITY_PROVIDER,
      partyId: '',
      partyName: 'Awaiting quote selection',
      tokenMint: 'So11111111111111111111111111111111111111112',
      amount: '0',
      status: EscrowStatus.NotStarted,
      updatedAt: isoMinutesAgo(18),
    },
    {
      id: 'escrow-negotiating-originator',
      rfqId: 'rfq-negotiating-1',
      partyRole: UserRole.RFQ_ORIGINATOR,
      partyId: 'user-originator-1',
      partyName: 'Alemu Treasury Partners',
      tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      amount: '7500000',
      status: EscrowStatus.NotStarted,
      updatedAt: isoMinutesAgo(9),
    },
    {
      id: 'escrow-negotiating-provider',
      rfqId: 'rfq-negotiating-1',
      partyRole: UserRole.LIQUIDITY_PROVIDER,
      partyId: 'user-provider-1',
      partyName: 'Nile Liquidity Desk',
      tokenMint: 'So11111111111111111111111111111111111111112',
      amount: '360000000',
      status: EscrowStatus.NotStarted,
      updatedAt: isoMinutesAgo(9),
    },
    {
      id: 'escrow-settled-originator',
      rfqId: 'rfq-settled-1',
      partyRole: UserRole.RFQ_ORIGINATOR,
      partyId: 'user-originator-1',
      partyName: 'Alemu Treasury Partners',
      tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      amount: '1000000',
      status: EscrowStatus.Released,
      txHash: '3kVqPmockoriginatortx',
      updatedAt: isoMinutesAgo(245),
    },
    {
      id: 'escrow-settled-provider',
      rfqId: 'rfq-settled-1',
      partyRole: UserRole.LIQUIDITY_PROVIDER,
      partyId: 'user-provider-1',
      partyName: 'Nile Liquidity Desk',
      tokenMint: 'So11111111111111111111111111111111111111112',
      amount: '48000000',
      status: EscrowStatus.Released,
      txHash: '9jd5mockprovidertx',
      updatedAt: isoMinutesAgo(244),
    },
  ];

  const activities: ActivityEvent[] = [
    {
      id: 'act-rfq-open-1',
      rfqId: 'rfq-open-1',
      type: 'RFQ_CREATED',
      actorId: 'user-originator-1',
      actorName: 'Alemu Treasury Partners',
      summary: 'RFQ published privately to eligible liquidity providers.',
      detail: `Sell ${formatRawAmount('2000000', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')} ${getTokenSymbol('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')} vs ${getTokenSymbol('So11111111111111111111111111111111111111112')}.`,
      createdAt: isoMinutesAgo(18),
    },
    {
      id: 'act-rfq-negotiating-1',
      rfqId: 'rfq-negotiating-1',
      type: 'RFQ_CREATED',
      actorId: 'user-originator-1',
      actorName: 'Alemu Treasury Partners',
      summary: 'RFQ opened for quotes.',
      createdAt: isoMinutesAgo(94),
    },
    {
      id: 'act-quote-negotiating-1',
      rfqId: 'rfq-negotiating-1',
      type: 'QUOTE_SUBMITTED',
      actorId: 'user-provider-1',
      actorName: 'Nile Liquidity Desk',
      summary: 'Initial quote submitted.',
      detail: 'Provider marked quote firm for full size.',
      createdAt: isoMinutesAgo(72),
      relatedQuoteId: 'quote-negotiating-1',
    },
    {
      id: 'act-quote-negotiating-2',
      rfqId: 'rfq-negotiating-1',
      type: 'QUOTE_COUNTERED',
      actorId: 'user-originator-1',
      actorName: 'Alemu Treasury Partners',
      summary: 'Originator countered pricing.',
      detail: 'Counter sent after treasury sign-off.',
      createdAt: isoMinutesAgo(28),
      relatedQuoteId: 'quote-negotiating-2',
    },
    {
      id: 'act-quote-negotiating-3',
      rfqId: 'rfq-negotiating-1',
      type: 'QUOTE_SUBMITTED',
      actorId: 'user-provider-1',
      actorName: 'Nile Liquidity Desk',
      summary: 'Provider matched the latest counter.',
      detail: 'Desk ready for escrow once selected.',
      createdAt: isoMinutesAgo(9),
      relatedQuoteId: 'quote-negotiating-3',
    },
    {
      id: 'act-rfq-settled-1',
      rfqId: 'rfq-settled-1',
      type: 'RFQ_CREATED',
      actorId: 'user-originator-1',
      actorName: 'Alemu Treasury Partners',
      summary: 'RFQ opened and quoted.',
      createdAt: isoMinutesAgo(360),
    },
    {
      id: 'act-rfq-settled-2',
      rfqId: 'rfq-settled-1',
      type: 'QUOTE_ACCEPTED',
      actorId: 'user-originator-1',
      actorName: 'Alemu Treasury Partners',
      summary: 'Commercial terms accepted.',
      detail: 'Counterparty selected and escrow workflow initiated.',
      createdAt: isoMinutesAgo(300),
      relatedQuoteId: 'quote-settled-2',
    },
    {
      id: 'act-rfq-settled-3',
      rfqId: 'rfq-settled-1',
      type: 'ESCROW_LOCKED',
      actorId: 'user-admin-1',
      actorName: 'Contra Ops Admin',
      summary: 'Both escrows locked for settlement.',
      createdAt: isoMinutesAgo(250),
    },
    {
      id: 'act-rfq-settled-4',
      rfqId: 'rfq-settled-1',
      type: 'SETTLEMENT_COMPLETED',
      actorId: 'user-admin-1',
      actorName: 'Contra Ops Admin',
      summary: 'Settlement completed successfully.',
      createdAt: isoMinutesAgo(240),
    },
  ];

  return { users, rfqs, quotes, escrows, activities };
}

function normalizeState(state: MockState): MockState {
  return {
    ...state,
    rfqs: state.rfqs.map((rfq) => {
      const createdAtMs = new Date(rfq.createdAt).getTime();
      const expiresAtMs = new Date(rfq.expiresAt).getTime();
      const derivedExpiresInSeconds =
        Number.isFinite(createdAtMs) && Number.isFinite(expiresAtMs) && expiresAtMs > createdAtMs
          ? Math.max(1, Math.round((expiresAtMs - createdAtMs) / 1000))
          : 3600;

      return {
        ...rfq,
        sequence: rfq.sequence || String(Number.isFinite(createdAtMs) ? createdAtMs : Date.now()),
        requiredTier: rfq.requiredTier ?? 1,
        expiresInSeconds: rfq.expiresInSeconds ?? derivedExpiresInSeconds,
      };
    }),
  };
}

function readState(): MockState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = normalizeState(seedState());
    writeState(seeded);
    return seeded;
  }

  try {
    const normalized = normalizeState(JSON.parse(raw) as MockState);
    writeState(normalized);
    return normalized;
  } catch {
    const seeded = normalizeState(seedState());
    writeState(seeded);
    return seeded;
  }
}

function writeState(state: MockState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readAccessRequests(): PlatformAccessRequest[] {
  const raw = window.localStorage.getItem(ACCESS_REQUESTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as PlatformAccessRequest[];
  } catch {
    return [];
  }
}

function writeAccessRequests(requests: PlatformAccessRequest[]): void {
  window.localStorage.setItem(ACCESS_REQUESTS_KEY, JSON.stringify(requests));
}

function withState<T>(handler: (state: MockState) => T): T {
  const state = readState();
  const result = handler(state);
  writeState(state);
  return result;
}

function getUserFromState(state: MockState, userId: string): User {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

function getRFQFromState(state: MockState, rfqId: string): RFQ {
  const rfq = state.rfqs.find((item) => item.id === rfqId);
  if (!rfq) {
    throw new Error('RFQ not found');
  }
  return rfq;
}

function getQuoteFromState(state: MockState, quoteId: string): Quote {
  const quote = state.quotes.find((item) => item.id === quoteId);
  if (!quote) {
    throw new Error('Quote not found');
  }
  return quote;
}

function sortNewestFirst<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftDate = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightDate = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightDate - leftDate;
  });
}

function isProviderEligible(rfq: RFQ, viewer: ViewerIdentity, quotes: Quote[]): boolean {
  if (viewer.role !== UserRole.LIQUIDITY_PROVIDER) {
    return false;
  }

  if ([RFQStatus.Cancelled, RFQStatus.Expired, RFQStatus.Defaulted].includes(rfq.status)) {
    return false;
  }

  const myQuotes = quotes.filter((quote) => quote.rfqId === rfq.id && quote.providerId === viewer.userId);
  if (myQuotes.length > 0) {
    return true;
  }

  return [
    RFQStatus.OpenForQuotes,
    RFQStatus.Negotiating,
    RFQStatus.QuoteSelected,
    RFQStatus.AwaitingOriginatorDeposit,
    RFQStatus.AwaitingProviderDeposit,
    RFQStatus.ReadyToSettle,
    RFQStatus.Settling,
  ].includes(rfq.status);
}

function createActivity(
  state: MockState,
  rfqId: string,
  type: ActivityEvent['type'],
  actorId: string,
  actorName: string,
  summary: string,
  detail?: string,
  relatedQuoteId?: string,
): void {
  state.activities.push({
    id: createId('activity'),
    rfqId,
    type,
    actorId,
    actorName,
    summary,
    detail,
    createdAt: new Date().toISOString(),
    relatedQuoteId,
  });
}

function latestQuotesByProvider(quotes: Quote[]): Quote[] {
  const grouped = new Map<string, Quote>();
  sortNewestFirst(quotes).forEach((quote) => {
    const current = grouped.get(quote.providerId);
    if (!current || quote.version > current.version) {
      grouped.set(quote.providerId, quote);
    }
  });
  return sortNewestFirst(Array.from(grouped.values()));
}

function resolveNegotiatedSellAmount(rfq: RFQ, price: string): string {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return rfq.sellAmount;
  }

  return toRawAmount(price, rfq.sellToken);
}

export async function listRFQs(viewer: ViewerIdentity): Promise<RFQ[]> {
  const state = readState();
  const result = sortNewestFirst(state.rfqs.filter((rfq) => {
    if (viewer.role === UserRole.ADMIN) {
      return true;
    }
    if (viewer.role === UserRole.RFQ_ORIGINATOR) {
      return rfq.originatorId === viewer.userId;
    }
    return isProviderEligible(rfq, viewer, state.quotes);
  }));
  return delay(result);
}

export async function createRFQ(input: CreateRFQInput): Promise<RFQ> {
  const next = withState((state) => {
    const originator = getUserFromState(state, input.originatorId);
    const reference = makeReference(state.rfqs.length + 1013);
    const now = new Date().toISOString();
    const expiresInSeconds = Math.max(1, input.expiresInSeconds);
    const rfq: RFQ = {
      id: createId('rfq'),
      reference,
      sequence: input.sequence,
      originatorId: originator.id,
      originatorName: originator.fullName,
      sellToken: input.sellToken,
      sellAmount: input.sellAmount,
      buyToken: input.buyToken,
      indicativeBuyAmount: input.indicativeBuyAmount,
      requiredTier: input.requiredTier,
      expiresInSeconds,
      side: 'sell',
      status: RFQStatus.OpenForQuotes,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    };

    state.rfqs.push(rfq);
    state.escrows.push({
      id: createId('escrow'),
      rfqId: rfq.id,
      partyRole: UserRole.RFQ_ORIGINATOR,
      partyId: originator.id,
      partyName: originator.fullName,
      tokenMint: rfq.sellToken,
      amount: rfq.sellAmount,
      status: EscrowStatus.NotStarted,
      updatedAt: now,
    });
    state.escrows.push({
      id: createId('escrow'),
      rfqId: rfq.id,
      partyRole: UserRole.LIQUIDITY_PROVIDER,
      partyId: '',
      partyName: 'Awaiting quote selection',
      tokenMint: rfq.buyToken,
      amount: '0',
      status: EscrowStatus.NotStarted,
      updatedAt: now,
    });

    createActivity(
      state,
      rfq.id,
      'RFQ_CREATED',
      originator.id,
      originator.fullName,
      'RFQ created and routed privately to eligible liquidity providers.',
      `Sequence ${rfq.sequence} · Indicative ${formatRawAmount(rfq.indicativeBuyAmount, rfq.buyToken)} ${getTokenSymbol(rfq.buyToken)} · Tier ${rfq.requiredTier} · Expires in ${rfq.expiresInSeconds}s.`,
    );

    return rfq;
  });

  return delay(next);
}

export async function getRFQ(rfqId: string): Promise<RFQ> {
  return delay(getRFQFromState(readState(), rfqId));
}

export async function getQuotesForRFQ(rfqId: string, viewer: ViewerIdentity): Promise<Quote[]> {
  const state = readState();
  const rfq = getRFQFromState(state, rfqId);
  let quotes = state.quotes.filter((quote) => quote.rfqId === rfq.id);

  if (viewer.role === UserRole.LIQUIDITY_PROVIDER) {
    quotes = quotes.filter((quote) => quote.providerId === viewer.userId);
  }

  return delay(sortNewestFirst(quotes));
}

export async function submitQuote(input: SubmitQuoteInput): Promise<Quote> {
  const next = withState((state) => {
    const rfq = getRFQFromState(state, input.rfqId);
    const provider = getUserFromState(state, input.providerId);
    const versions = state.quotes.filter((quote) => quote.rfqId === rfq.id && quote.providerId === provider.id);
    const latestVersion = versions.reduce((highest, quote) => Math.max(highest, quote.version), 0);
    const now = new Date().toISOString();
    const quote: Quote = {
      id: createId('quote'),
      rfqId: rfq.id,
      providerId: provider.id,
      providerName: provider.fullName,
      submittedByRole: UserRole.LIQUIDITY_PROVIDER,
      submittedByUserId: provider.id,
      submittedByName: provider.fullName,
      version: latestVersion + 1,
      price: input.price,
      sellAmount: resolveNegotiatedSellAmount(rfq, input.price),
      buyAmount: input.buyAmount,
      status: versions.length > 0 ? QuoteStatus.Negotiating : QuoteStatus.Submitted,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      parentQuoteId: versions[0]?.id,
    };

    state.quotes.push(quote);
    rfq.status = versions.length > 0 ? RFQStatus.Negotiating : rfq.status;
    rfq.updatedAt = now;
    rfq.indicativeBuyAmount = quote.buyAmount;

    const providerEscrow = state.escrows.find((escrow) => escrow.rfqId === rfq.id && escrow.partyRole === UserRole.LIQUIDITY_PROVIDER);
    if (providerEscrow) {
      providerEscrow.partyId = provider.id;
      providerEscrow.partyName = provider.fullName;
      providerEscrow.amount = quote.buyAmount;
      providerEscrow.tokenMint = rfq.buyToken;
      providerEscrow.updatedAt = now;
    }

    createActivity(
      state,
      rfq.id,
      'QUOTE_SUBMITTED',
      provider.id,
      provider.fullName,
      versions.length > 0 ? 'Quote revised by liquidity provider.' : 'Quote submitted by liquidity provider.',
      input.note,
      quote.id,
    );

    return quote;
  });

  return delay(next);
}

export async function counterQuote(input: CounterQuoteInput): Promise<Quote> {
  const next = withState((state) => {
    const rfq = getRFQFromState(state, input.rfqId);
    const priorQuote = getQuoteFromState(state, input.quoteId);
    const actor = getUserFromState(state, input.actorId);
    const now = new Date().toISOString();
    const nextVersion = state.quotes
      .filter((quote) => quote.rfqId === rfq.id && quote.providerId === priorQuote.providerId)
      .reduce((highest, quote) => Math.max(highest, quote.version), 0) + 1;

    priorQuote.status = QuoteStatus.Negotiating;
    priorQuote.updatedAt = now;

    const quote: Quote = {
      id: createId('quote'),
      rfqId: rfq.id,
      providerId: priorQuote.providerId,
      providerName: priorQuote.providerName,
      submittedByRole: input.actorRole,
      submittedByUserId: actor.id,
      submittedByName: actor.fullName,
      version: nextVersion,
      price: input.price,
      sellAmount: resolveNegotiatedSellAmount(rfq, input.price),
      buyAmount: input.buyAmount,
      status: input.actorRole === UserRole.RFQ_ORIGINATOR ? QuoteStatus.Countered : QuoteStatus.Negotiating,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      parentQuoteId: priorQuote.id,
    };

    state.quotes.push(quote);
    rfq.status = RFQStatus.Negotiating;
    rfq.updatedAt = now;
    rfq.indicativeBuyAmount = input.buyAmount;

    const providerEscrow = state.escrows.find((escrow) => escrow.rfqId === rfq.id && escrow.partyRole === UserRole.LIQUIDITY_PROVIDER);
    if (providerEscrow) {
      providerEscrow.partyId = priorQuote.providerId;
      providerEscrow.partyName = priorQuote.providerName;
      providerEscrow.amount = input.buyAmount;
      providerEscrow.updatedAt = now;
    }

    createActivity(
      state,
      rfq.id,
      'QUOTE_COUNTERED',
      actor.id,
      actor.fullName,
      input.actorRole === UserRole.RFQ_ORIGINATOR ? 'Originator sent a commercial counter.' : 'Liquidity provider revised pricing.',
      input.note,
      quote.id,
    );

    return quote;
  });

  return delay(next);
}

export async function acceptQuote(rfqId: string, quoteId: string, actorId: string): Promise<RFQ> {
  const next = withState((state) => {
    const rfq = getRFQFromState(state, rfqId);
    const quote = getQuoteFromState(state, quoteId);
    const actor = getUserFromState(state, actorId);
    const now = new Date().toISOString();

    state.quotes
      .filter((item) => item.rfqId === rfq.id)
      .forEach((item) => {
        if (item.id === quote.id) {
          item.status = QuoteStatus.Accepted;
        } else if (item.providerId !== quote.providerId && item.status !== QuoteStatus.Settled) {
          item.status = QuoteStatus.Rejected;
        } else if (item.id !== quote.id && item.status !== QuoteStatus.Settled) {
          item.status = QuoteStatus.Negotiating;
        }
        item.updatedAt = now;
      });

    rfq.status = RFQStatus.AwaitingOriginatorDeposit;
    rfq.selectedQuoteId = quote.id;
    rfq.selectedProviderId = quote.providerId;
    rfq.selectedProviderName = quote.providerName;
    rfq.acceptedPrice = quote.price;
    rfq.sellAmount = quote.sellAmount;
    rfq.indicativeBuyAmount = quote.buyAmount;
    rfq.updatedAt = now;

    const originatorEscrow = state.escrows.find((escrow) => escrow.rfqId === rfq.id && escrow.partyRole === UserRole.RFQ_ORIGINATOR);
    const providerEscrow = state.escrows.find((escrow) => escrow.rfqId === rfq.id && escrow.partyRole === UserRole.LIQUIDITY_PROVIDER);
    if (originatorEscrow) {
      originatorEscrow.amount = quote.sellAmount;
      originatorEscrow.status = EscrowStatus.DepositRequested;
      originatorEscrow.updatedAt = now;
    }
    if (providerEscrow) {
      providerEscrow.partyId = quote.providerId;
      providerEscrow.partyName = quote.providerName;
      providerEscrow.amount = quote.buyAmount;
      providerEscrow.status = EscrowStatus.DepositRequested;
      providerEscrow.updatedAt = now;
    }

    createActivity(
      state,
      rfq.id,
      'QUOTE_ACCEPTED',
      actor.id,
      actor.fullName,
      'Commercial terms accepted and escrow funding opened.',
      `Accepted ${quote.providerName} at ${quote.price}.`,
      quote.id,
    );
    createActivity(
      state,
      rfq.id,
      'ESCROW_REQUESTED',
      actor.id,
      actor.fullName,
      'Escrow deposits requested from both parties.',
    );

    return rfq;
  });

  return delay(next);
}

export async function rejectQuote(rfqId: string, quoteId: string, actorId: string): Promise<RFQ> {
  const next = withState((state) => {
    const rfq = getRFQFromState(state, rfqId);
    const quote = getQuoteFromState(state, quoteId);
    const actor = getUserFromState(state, actorId);
    const now = new Date().toISOString();

    quote.status = QuoteStatus.Rejected;
    quote.updatedAt = now;
    rfq.updatedAt = now;
    rfq.status = RFQStatus.OpenForQuotes;

    createActivity(
      state,
      rfq.id,
      'QUOTE_REJECTED',
      actor.id,
      actor.fullName,
      'Quote rejected by originator.',
      `Rejected ${quote.providerName}.`,
      quote.id,
    );

    return rfq;
  });

  return delay(next);
}

export async function getNegotiationThread(rfqId: string): Promise<ActivityEvent[]> {
  const state = readState();
  return delay(sortNewestFirst(state.activities.filter((activity) => activity.rfqId === rfqId)));
}

export async function getEscrowStatusForRFQ(rfqId: string): Promise<EscrowObligation[]> {
  const state = readState();
  const escrows = state.escrows
    .filter((escrow) => escrow.rfqId === rfqId)
    .sort((left, right) => left.partyRole.localeCompare(right.partyRole));
  return delay(escrows);
}

export async function submitEscrowTxHash(
  rfqId: string,
  partyRole: Extract<UserRole, UserRole.RFQ_ORIGINATOR | UserRole.LIQUIDITY_PROVIDER>,
  actorId: string,
  txHash: string,
): Promise<RFQ> {
  const next = withState((state) => {
    const rfq = getRFQFromState(state, rfqId);
    const actor = getUserFromState(state, actorId);
    const obligation = state.escrows.find((escrow) => escrow.rfqId === rfq.id && escrow.partyRole === partyRole);
    if (!obligation) {
      throw new Error('Escrow obligation not found');
    }

    const counterpart = state.escrows.find((escrow) => escrow.rfqId === rfq.id && escrow.partyRole !== partyRole);
    const now = new Date().toISOString();
    obligation.txHash = txHash;
    obligation.status = EscrowStatus.CreditedInContra;
    obligation.updatedAt = now;

    const acceptedQuote = rfq.selectedQuoteId ? state.quotes.find((quote) => quote.id === rfq.selectedQuoteId) : undefined;
    if (acceptedQuote && acceptedQuote.status === QuoteStatus.Accepted) {
      acceptedQuote.status = QuoteStatus.AwaitingDeposit;
      acceptedQuote.updatedAt = now;
    }

    createActivity(
      state,
      rfq.id,
      'ESCROW_SUBMITTED',
      actor.id,
      actor.fullName,
      `${partyRole === UserRole.RFQ_ORIGINATOR ? 'Originator' : 'Liquidity provider'} escrow deposit submitted.`,
      `Tx hash ${txHash}.`,
    );

    if (partyRole === UserRole.RFQ_ORIGINATOR) {
      rfq.status = RFQStatus.AwaitingProviderDeposit;
    }

    if (counterpart?.status === EscrowStatus.CreditedInContra || counterpart?.status === EscrowStatus.LockedForSettlement || counterpart?.status === EscrowStatus.Released) {
      obligation.status = EscrowStatus.LockedForSettlement;
      if (counterpart.status !== EscrowStatus.Released) {
        counterpart.status = EscrowStatus.LockedForSettlement;
        counterpart.updatedAt = now;
      }
      rfq.status = RFQStatus.ReadyToSettle;
      createActivity(
        state,
        rfq.id,
        'ESCROW_LOCKED',
        actor.id,
        actor.fullName,
        'Both escrows locked and ready for settlement.',
      );

      rfq.status = RFQStatus.Settling;
      createActivity(
        state,
        rfq.id,
        'SETTLEMENT_STARTED',
        actor.id,
        actor.fullName,
        'Settlement instruction dispatched.',
      );

      obligation.status = EscrowStatus.Released;
      obligation.updatedAt = now;
      if (counterpart.status !== EscrowStatus.Released) {
        counterpart.status = EscrowStatus.Released;
        counterpart.updatedAt = now;
      }
      rfq.status = RFQStatus.Settled;
      rfq.updatedAt = now;
      if (acceptedQuote) {
        acceptedQuote.status = QuoteStatus.Settled;
        acceptedQuote.updatedAt = now;
      }
      createActivity(
        state,
        rfq.id,
        'SETTLEMENT_COMPLETED',
        actor.id,
        actor.fullName,
        'Settlement completed. Funds released to both counterparties.',
      );
    } else {
      rfq.updatedAt = now;
    }

    return rfq;
  });

  return delay(next);
}

export async function getAdminOverview(): Promise<OTCAdminOverview> {
  const state = readState();
  const overview: OTCAdminOverview = {
    totalRFQs: state.rfqs.length,
    openRFQs: state.rfqs.filter((rfq) => rfq.status === RFQStatus.OpenForQuotes).length,
    negotiatingRFQs: state.rfqs.filter((rfq) => rfq.status === RFQStatus.Negotiating).length,
    awaitingDeposits: state.rfqs.filter((rfq) => [
      RFQStatus.AwaitingOriginatorDeposit,
      RFQStatus.AwaitingProviderDeposit,
    ].includes(rfq.status)).length,
    readyToSettle: state.rfqs.filter((rfq) => [RFQStatus.ReadyToSettle, RFQStatus.Settling].includes(rfq.status)).length,
    settledRFQs: state.rfqs.filter((rfq) => rfq.status === RFQStatus.Settled).length,
    activeUsers: state.users.filter((user) => user.status === 'ACTIVE').length,
  };
  return delay(overview);
}

export async function getAdminRFQs(): Promise<(RFQ & { quoteCount: number; activityCount: number })[]> {
  const state = readState();
  const rows = sortNewestFirst(state.rfqs).map((rfq) => ({
    ...rfq,
    quoteCount: latestQuotesByProvider(state.quotes.filter((quote) => quote.rfqId === rfq.id)).length,
    activityCount: state.activities.filter((activity) => activity.rfqId === rfq.id).length,
  }));
  return delay(rows);
}

export async function getAdminEscrow(): Promise<(EscrowObligation & { rfqReference: string; rfqStatus: RFQStatus })[]> {
  const state = readState();
  const rows = state.escrows.map((escrow) => {
    const rfq = getRFQFromState(state, escrow.rfqId);
    return {
      ...escrow,
      rfqReference: rfq.reference,
      rfqStatus: rfq.status,
    };
  });
  return delay(sortNewestFirst(rows));
}

export async function listUsers(includeAdmins = false): Promise<User[]> {
  const state = readState();
  const users = state.users.filter((user) => includeAdmins || user.role !== UserRole.ADMIN);
  return delay(sortNewestFirst(users));
}

export async function authenticateUser(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const state = readState();
  const user = state.users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);

  if (!user) {
    throw new Error('No account was found for that work email.');
  }

  const expectedPassword = DEMO_PASSWORDS[normalizedEmail];
  if (!expectedPassword || password !== expectedPassword) {
    throw new Error('Invalid email or password.');
  }

  return delay(user);
}

export async function submitPlatformAccessRequest(
  input: PlatformAccessRequestInput,
): Promise<PlatformAccessRequest> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUsers = await listUsers(true);
  if (existingUsers.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with that work email already exists. Please sign in instead.');
  }

  const existingRequests = readAccessRequests();
  if (existingRequests.some((request) => request.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An access request for that work email has already been submitted.');
  }

  const request: PlatformAccessRequest = {
    id: createId('access'),
    institutionName: input.institutionName.trim(),
    contactName: input.contactName.trim(),
    email: normalizedEmail,
    institutionType: input.institutionType.trim(),
    jurisdiction: input.jurisdiction.trim(),
    requestedRoles: [...input.requestedRoles],
    status: 'SUBMITTED',
    createdAt: new Date().toISOString(),
  };

  writeAccessRequests([...existingRequests, request]);
  return delay(request);
}

export async function createUser(input: UserMutationInput): Promise<User> {
  const next = withState((state) => {
    const user: User = {
      id: createId('user'),
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      status: input.status,
      createdAt: new Date().toISOString(),
    };
    state.users.push(user);
    return user;
  });
  return delay(next);
}

export async function updateUser(userId: string, input: UserMutationInput): Promise<User> {
  const next = withState((state) => {
    const user = getUserFromState(state, userId);
    if (user.role === UserRole.ADMIN) {
      throw new Error('Admin user management is read-only in this workflow.');
    }
    user.fullName = input.fullName;
    user.email = input.email;
    user.role = input.role;
    user.status = input.status;
    return user;
  });
  return delay(next);
}

export async function deleteUser(userId: string): Promise<void> {
  withState((state) => {
    const user = getUserFromState(state, userId);
    if (user.role === UserRole.ADMIN) {
      throw new Error('Admin users cannot be deleted here.');
    }
    state.users = state.users.filter((item) => item.id !== userId);
  });
  return delay(undefined);
}
