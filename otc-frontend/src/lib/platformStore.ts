import type {
  ActivityEvent,
  AuthProfile,
  AuthSession,
  Organization,
  PlatformSnapshot,
  Quote,
  RFQ,
  SettlementRecord,
  Tenant,
  User,
} from '../types/platform';

const PLATFORM_STORAGE_KEY = 'contra-bank-otc-platform-v2';
const SESSION_STORAGE_KEY = 'contra-bank-otc-session-v2';
const SCHEMA_VERSION = 2;

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function plusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function createActivityEvent(
  input: Omit<ActivityEvent, 'id' | 'createdAt'> & { createdAt?: string }
): ActivityEvent {
  return {
    id: createId('activity'),
    createdAt: input.createdAt ?? nowIso(),
    ...input,
  };
}

function seedSnapshot(): PlatformSnapshot {
  const tenantId = 'tenant-aurora';
  const bankOrganizationId = 'org-bank-aurora';
  const northstarId = 'org-inst-northstar';
  const helixId = 'org-inst-helix';

  const bankAdminId = 'user-bank-admin';
  const bankQuoterId = 'user-bank-quoter';
  const northstarTraderId = 'user-inst-northstar-trader';
  const northstarOpsId = 'user-inst-northstar-ops';
  const helixTreasuryId = 'user-inst-helix-treasury';
  const invitedAnalystId = 'user-inst-northstar-invite';

  const tenant: Tenant = {
    id: tenantId,
    name: 'Aurora Bank Tenant',
    type: 'BANK',
    bankName: 'Aurora Bank',
    branding: { primaryColor: '#00FFD1' },
    policyProfile: [
      'KYB must be approved before trading access is enabled.',
      'Both parties must fund escrow before settlement release.',
      'Trades above 5M require manual policy review.',
    ],
    nodeConfig: {
      network: 'Solana / Contra Localnet',
      escrowRail: 'Contra Escrow',
    },
    allowedAssets: ['USD', 'USDC', 'SOL', 'BTC'],
  };

  const organizations: Organization[] = [
    {
      id: bankOrganizationId,
      tenantId,
      name: 'Aurora Bank',
      type: 'BANK',
      onboardingStatus: 'ACTIVE',
      allowedUsers: 50,
    },
    {
      id: northstarId,
      tenantId,
      name: 'Northstar Asset Management',
      type: 'INSTITUTION',
      kybStatus: 'APPROVED',
      onboardingStatus: 'ACTIVE',
      bankRelationshipManager: 'Sarah Chen',
      allowedUsers: 8,
    },
    {
      id: helixId,
      tenantId,
      name: 'Helix Treasury Partners',
      type: 'INSTITUTION',
      kybStatus: 'PENDING',
      onboardingStatus: 'ACTIVE',
      bankRelationshipManager: 'Marcus Vale',
      allowedUsers: 5,
    },
  ];

  const users: User[] = [
    {
      id: bankAdminId,
      tenantId,
      organizationId: bankOrganizationId,
      email: 'bank.admin@aurora.demo',
      fullName: 'Sarah Chen',
      role: 'BANK',
      status: 'ACTIVE',
      lastLoginAt: hoursAgo(2),
    },
    {
      id: bankQuoterId,
      tenantId,
      organizationId: bankOrganizationId,
      email: 'quoter@aurora.demo',
      fullName: 'Marcus Vale',
      role: 'BANK',
      status: 'ACTIVE',
      lastLoginAt: hoursAgo(5),
    },
    {
      id: northstarTraderId,
      tenantId,
      organizationId: northstarId,
      email: 'trader@northstar.demo',
      fullName: 'Ava Thompson',
      role: 'INSTITUTION',
      status: 'ACTIVE',
      lastLoginAt: hoursAgo(8),
    },
    {
      id: northstarOpsId,
      tenantId,
      organizationId: northstarId,
      email: 'ops@northstar.demo',
      fullName: 'Noah Kim',
      role: 'INSTITUTION',
      status: 'ACTIVE',
      lastLoginAt: daysAgo(1),
    },
    {
      id: helixTreasuryId,
      tenantId,
      organizationId: helixId,
      email: 'treasury@helix.demo',
      fullName: 'Leo Brooks',
      role: 'INSTITUTION',
      status: 'ACTIVE',
      lastLoginAt: daysAgo(2),
    },
    {
      id: invitedAnalystId,
      tenantId,
      organizationId: northstarId,
      email: 'analyst@northstar.demo',
      fullName: 'Dana Lee',
      role: 'INSTITUTION',
      status: 'INVITED',
    },
  ];

  const rfqs: RFQ[] = [
    {
      id: 'rfq-submitted',
      tenantId,
      institutionId: northstarId,
      assignedBankId: bankOrganizationId,
      creatorUserId: northstarTraderId,
      side: 'BUY',
      baseAsset: 'SOL',
      quoteAsset: 'USD',
      amount: '150000',
      status: 'SUBMITTED',
      expiresAt: hoursFromNow(6),
      policyStatus: 'CLEAR',
      institutionDepositAsset: 'USD',
      institutionDepositAmount: '150000',
      bankDepositAsset: 'SOL',
      bankDepositAmount: '150000',
      settlementNotes: 'T+0 settlement through Contra escrow.',
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
    },
    {
      id: 'rfq-negotiating',
      tenantId,
      institutionId: northstarId,
      assignedBankId: bankOrganizationId,
      assignedBankUserId: bankQuoterId,
      creatorUserId: northstarTraderId,
      side: 'SELL',
      baseAsset: 'BTC',
      quoteAsset: 'USD',
      amount: '12',
      status: 'NEGOTIATING',
      expiresAt: hoursFromNow(4),
      policyStatus: 'REVIEW_REQUIRED',
      institutionDepositAsset: 'BTC',
      institutionDepositAmount: '12',
      bankDepositAsset: 'USD',
      bankDepositAmount: '775200',
      settlementNotes: 'Institution prefers same-day settlement after policy approval.',
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(1),
    },
    {
      id: 'rfq-escrow',
      tenantId,
      institutionId: helixId,
      assignedBankId: bankOrganizationId,
      assignedBankUserId: bankAdminId,
      creatorUserId: helixTreasuryId,
      side: 'BUY',
      baseAsset: 'BTC',
      quoteAsset: 'USD',
      amount: '4',
      status: 'ESCROW_PENDING',
      expiresAt: hoursFromNow(2),
      selectedQuoteId: 'quote-escrow-1',
      policyStatus: 'CLEAR',
      institutionDepositAsset: 'USD',
      institutionDepositAmount: '258000',
      bankDepositAsset: 'BTC',
      bankDepositAmount: '4',
      settlementNotes: 'Funding in progress on both sides.',
      createdAt: hoursAgo(18),
      updatedAt: hoursAgo(1),
    },
    {
      id: 'rfq-settled',
      tenantId,
      institutionId: northstarId,
      assignedBankId: bankOrganizationId,
      assignedBankUserId: bankQuoterId,
      creatorUserId: northstarOpsId,
      side: 'SELL',
      baseAsset: 'SOL',
      quoteAsset: 'USD',
      amount: '90000',
      status: 'SETTLED',
      expiresAt: hoursAgo(12),
      selectedQuoteId: 'quote-settled-2',
      policyStatus: 'CLEAR',
      institutionDepositAsset: 'SOL',
      institutionDepositAmount: '90000',
      bankDepositAsset: 'USD',
      bankDepositAmount: '93060',
      settlementNotes: 'Completed with bilateral escrow confirmation.',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
  ];

  const quotes: Quote[] = [
    {
      id: 'quote-negotiating-1',
      tenantId,
      rfqId: 'rfq-negotiating',
      bankUserId: bankQuoterId,
      institutionId: northstarId,
      createdByUserId: bankQuoterId,
      createdByRole: 'BANK',
      price: '64000',
      size: '12',
      status: 'SUPERSEDED',
      version: 1,
      expiresAt: hoursAgo(5),
      createdAt: hoursAgo(9),
      negotiationNote: 'Initial market color for full size.',
      settlementNotes: 'Subject to desk approval above 10 BTC.',
    },
    {
      id: 'quote-negotiating-2',
      tenantId,
      rfqId: 'rfq-negotiating',
      bankUserId: bankQuoterId,
      institutionId: northstarId,
      createdByUserId: northstarTraderId,
      createdByRole: 'INSTITUTION',
      price: '64800',
      size: '10',
      status: 'SUPERSEDED',
      version: 2,
      expiresAt: hoursAgo(3),
      createdAt: hoursAgo(6),
      negotiationNote: 'Institution counters on tighter spread and reduced size.',
      supersedesQuoteId: 'quote-negotiating-1',
    },
    {
      id: 'quote-negotiating-3',
      tenantId,
      rfqId: 'rfq-negotiating',
      bankUserId: bankQuoterId,
      institutionId: northstarId,
      createdByUserId: bankQuoterId,
      createdByRole: 'BANK',
      price: '64600',
      size: '12',
      status: 'COUNTERED',
      version: 3,
      expiresAt: hoursFromNow(2),
      createdAt: hoursAgo(1),
      negotiationNote: 'Bank counters with improved level for full size.',
      settlementNotes: 'Ready for acceptance once policy check is cleared.',
      supersedesQuoteId: 'quote-negotiating-2',
    },
    {
      id: 'quote-escrow-1',
      tenantId,
      rfqId: 'rfq-escrow',
      bankUserId: bankAdminId,
      institutionId: helixId,
      createdByUserId: bankAdminId,
      createdByRole: 'BANK',
      price: '64500',
      size: '4',
      status: 'ACCEPTED',
      version: 1,
      expiresAt: hoursFromNow(3),
      createdAt: hoursAgo(16),
      negotiationNote: 'Bank quote accepted by institution.',
      settlementNotes: 'Both sides to fund escrow before settlement release.',
    },
    {
      id: 'quote-settled-1',
      tenantId,
      rfqId: 'rfq-settled',
      bankUserId: bankQuoterId,
      institutionId: northstarId,
      createdByUserId: bankQuoterId,
      createdByRole: 'BANK',
      price: '1.02',
      size: '90000',
      status: 'SUPERSEDED',
      version: 1,
      expiresAt: daysAgo(3),
      createdAt: daysAgo(3),
      negotiationNote: 'Opening quote.',
    },
    {
      id: 'quote-settled-2',
      tenantId,
      rfqId: 'rfq-settled',
      bankUserId: bankQuoterId,
      institutionId: northstarId,
      createdByUserId: bankQuoterId,
      createdByRole: 'BANK',
      price: '1.034',
      size: '90000',
      status: 'ACCEPTED',
      version: 2,
      expiresAt: daysAgo(3),
      createdAt: daysAgo(3),
      negotiationNote: 'Final agreed commercial terms.',
      settlementNotes: 'Settled atomically through Contra.',
      supersedesQuoteId: 'quote-settled-1',
    },
  ];

  const settlements: SettlementRecord[] = [
    {
      id: 'settlement-escrow-1',
      tenantId,
      rfqId: 'rfq-escrow',
      quoteId: 'quote-escrow-1',
      institutionId: helixId,
      bankOrganizationId,
      status: 'AWAITING_DEPOSITS',
      policyStatus: 'CLEAR',
      createdAt: hoursAgo(16),
      updatedAt: hoursAgo(1),
    },
    {
      id: 'settlement-settled-1',
      tenantId,
      rfqId: 'rfq-settled',
      quoteId: 'quote-settled-2',
      institutionId: northstarId,
      bankOrganizationId,
      status: 'SETTLED',
      policyStatus: 'CLEAR',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
      completedAt: daysAgo(2),
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    tenants: [tenant],
    organizations,
    users,
    credentials: [
      { userId: bankAdminId, password: 'demo123' },
      { userId: bankQuoterId, password: 'demo123' },
      { userId: northstarTraderId, password: 'demo123' },
      { userId: northstarOpsId, password: 'demo123' },
      { userId: helixTreasuryId, password: 'demo123' },
    ],
    invites: [
      {
        id: 'invite-northstar-analyst',
        tenantId,
        organizationId: northstarId,
        userId: invitedAnalystId,
        email: 'analyst@northstar.demo',
        invitedByUserId: bankAdminId,
        token: 'invite-northstar-analyst',
        expiresAt: plusDays(7),
      },
    ],
    passwordResets: [],
    rfqs,
    quotes,
    escrowObligations: [
      {
        id: 'escrow-inst-1',
        tenantId,
        rfqId: 'rfq-escrow',
        quoteId: 'quote-escrow-1',
        partyRole: 'INSTITUTION',
        organizationId: helixId,
        asset: 'USD',
        amount: '258000',
        status: 'CONFIRMED',
        txHash: '0xinstescrow258000',
        confirmationState: 'CONFIRMED',
        creditedInContra: true,
        updatedAt: hoursAgo(2),
      },
      {
        id: 'escrow-bank-1',
        tenantId,
        rfqId: 'rfq-escrow',
        quoteId: 'quote-escrow-1',
        partyRole: 'BANK',
        organizationId: bankOrganizationId,
        asset: 'BTC',
        amount: '4',
        status: 'PENDING',
        confirmationState: 'UNCONFIRMED',
        creditedInContra: false,
        updatedAt: hoursAgo(1),
      },
      {
        id: 'escrow-inst-2',
        tenantId,
        rfqId: 'rfq-settled',
        quoteId: 'quote-settled-2',
        partyRole: 'INSTITUTION',
        organizationId: northstarId,
        asset: 'SOL',
        amount: '90000',
        status: 'CONFIRMED',
        txHash: '0xinstsettled90000',
        confirmationState: 'CONFIRMED',
        creditedInContra: true,
        updatedAt: daysAgo(2),
      },
      {
        id: 'escrow-bank-2',
        tenantId,
        rfqId: 'rfq-settled',
        quoteId: 'quote-settled-2',
        partyRole: 'BANK',
        organizationId: bankOrganizationId,
        asset: 'USD',
        amount: '93060',
        status: 'CONFIRMED',
        txHash: '0xbanksettled93060',
        confirmationState: 'CONFIRMED',
        creditedInContra: true,
        updatedAt: daysAgo(2),
      },
    ],
    settlements,
    activityEvents: [
      createActivityEvent({
        tenantId,
        entityType: 'RFQ',
        entityId: 'rfq-submitted',
        actorUserId: northstarTraderId,
        actorRole: 'INSTITUTION',
        title: 'RFQ submitted',
        description: 'Northstar submitted a new SOL buy RFQ to Aurora Bank.',
        createdAt: hoursAgo(3),
      }),
      createActivityEvent({
        tenantId,
        entityType: 'QUOTE',
        entityId: 'quote-negotiating-3',
        actorUserId: bankQuoterId,
        actorRole: 'BANK',
        title: 'Counter quote sent',
        description: 'Bank desk sent the latest negotiated quote on BTC sale.',
        createdAt: hoursAgo(1),
      }),
      createActivityEvent({
        tenantId,
        entityType: 'ESCROW',
        entityId: 'escrow-inst-1',
        actorUserId: helixTreasuryId,
        actorRole: 'INSTITUTION',
        title: 'Institution escrow funded',
        description: 'Helix funded its USD escrow leg and is awaiting bank funding.',
        createdAt: hoursAgo(2),
      }),
      createActivityEvent({
        tenantId,
        entityType: 'SETTLEMENT',
        entityId: 'settlement-settled-1',
        actorUserId: bankQuoterId,
        actorRole: 'BANK',
        title: 'Settlement completed',
        description: 'Aurora and Northstar completed atomic settlement through Contra.',
        createdAt: daysAgo(2),
      }),
    ],
  };
}

export function getPlatformSnapshot(): PlatformSnapshot {
  const fallback = seedSnapshot();
  const snapshot = readStorage<PlatformSnapshot>(PLATFORM_STORAGE_KEY, fallback);
  if (!snapshot.schemaVersion || snapshot.schemaVersion !== SCHEMA_VERSION) {
    savePlatformSnapshot(fallback);
    return fallback;
  }
  return snapshot;
}

export function savePlatformSnapshot(snapshot: PlatformSnapshot): PlatformSnapshot {
  writeStorage(PLATFORM_STORAGE_KEY, snapshot);
  return snapshot;
}

export function resetPlatformSnapshot(): PlatformSnapshot {
  const snapshot = seedSnapshot();
  savePlatformSnapshot(snapshot);
  clearAuthSession();
  return snapshot;
}

export function loadAuthSession(): AuthSession | null {
  return readStorage<AuthSession | null>(SESSION_STORAGE_KEY, null);
}

export function saveAuthSession(session: AuthSession): AuthSession {
  writeStorage(SESSION_STORAGE_KEY, session);
  return session;
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getTenant(snapshot: PlatformSnapshot, tenantId: string): Tenant {
  const tenant = snapshot.tenants.find((item) => item.id === tenantId);
  if (!tenant) throw new Error('Tenant not found');
  return tenant;
}

export function getOrganization(snapshot: PlatformSnapshot, organizationId: string): Organization {
  const organization = snapshot.organizations.find((item) => item.id === organizationId);
  if (!organization) throw new Error('Organization not found');
  return organization;
}

export function getUser(snapshot: PlatformSnapshot, userId: string): User {
  const user = snapshot.users.find((item) => item.id === userId);
  if (!user) throw new Error('User not found');
  return user;
}

export function getRFQ(snapshot: PlatformSnapshot, rfqId: string): RFQ {
  const rfq = snapshot.rfqs.find((item) => item.id === rfqId);
  if (!rfq) throw new Error('RFQ not found');
  return rfq;
}

export function getSettlementForRFQ(snapshot: PlatformSnapshot, rfqId: string): SettlementRecord | undefined {
  return snapshot.settlements.find((item) => item.rfqId === rfqId);
}

export function findActiveSessionProfile(snapshot = getPlatformSnapshot()): AuthProfile | null {
  const session = loadAuthSession();
  if (!session) return null;

  const user = snapshot.users.find((item) => item.id === session.userId && item.status === 'ACTIVE');
  if (!user) return null;

  return {
    user,
    tenant: getTenant(snapshot, user.tenantId),
    organization: getOrganization(snapshot, user.organizationId),
  };
}

export function sortByNewest<T extends { createdAt?: string; updatedAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftValue = left.updatedAt ?? left.createdAt ?? '';
    const rightValue = right.updatedAt ?? right.createdAt ?? '';
    return rightValue.localeCompare(leftValue);
  });
}

export function getLatestQuote(quotes: Quote[]): Quote | null {
  return [...quotes].sort((left, right) => right.version - left.version)[0] ?? null;
}
