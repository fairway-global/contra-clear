import type {
  CounterQuoteInput,
  CreateInstitutionInput,
  CreateRFQInput,
  EscrowObligation,
  Organization,
  Quote,
  RFQ,
  SettlementRecord,
  SubmitQuoteInput,
  User,
} from '../types/platform';
import {
  createActivityEvent,
  createId,
  getLatestQuote,
  getOrganization,
  getPlatformSnapshot,
  getRFQ,
  getSettlementForRFQ,
  getTenant,
  getUser,
  nowIso,
  savePlatformSnapshot,
  sortByNewest,
} from './platformStore';

function ensureBankUser(user: User): void {
  if (user.role !== 'BANK') throw new Error('Only bank users can perform that action.');
}

function ensureInstitutionUser(user: User): void {
  if (user.role !== 'INSTITUTION') throw new Error('Only institution users can perform that action.');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.00$/, '');
}

function hasRFQAccess(user: User, rfq: RFQ): boolean {
  if (user.role === 'BANK') return user.tenantId === rfq.tenantId;
  return user.tenantId === rfq.tenantId && user.organizationId === rfq.institutionId;
}

function buildEscrowTerms(rfq: RFQ, price: string, size: string) {
  const numericPrice = Number(price);
  const numericSize = Number(size || rfq.amount);
  const computedValue = numericPrice * numericSize;

  if (rfq.side === 'BUY') {
    return {
      institutionAsset: rfq.quoteAsset,
      institutionAmount: formatNumber(computedValue || Number(rfq.institutionDepositAmount)),
      bankAsset: rfq.baseAsset,
      bankAmount: formatNumber(numericSize || Number(rfq.bankDepositAmount)),
    };
  }

  return {
    institutionAsset: rfq.baseAsset,
    institutionAmount: formatNumber(numericSize || Number(rfq.institutionDepositAmount)),
    bankAsset: rfq.quoteAsset,
    bankAmount: formatNumber(computedValue || Number(rfq.bankDepositAmount)),
  };
}

function replaceRFQ(snapshot: ReturnType<typeof getPlatformSnapshot>, nextRFQ: RFQ) {
  snapshot.rfqs = snapshot.rfqs.map((item) => (item.id === nextRFQ.id ? nextRFQ : item));
}

function replaceSettlement(snapshot: ReturnType<typeof getPlatformSnapshot>, nextSettlement: SettlementRecord) {
  snapshot.settlements = snapshot.settlements
    .filter((item) => item.id !== nextSettlement.id)
    .concat(nextSettlement);
}

function replaceObligation(snapshot: ReturnType<typeof getPlatformSnapshot>, nextObligation: EscrowObligation) {
  snapshot.escrowObligations = snapshot.escrowObligations
    .filter((item) => item.id !== nextObligation.id)
    .concat(nextObligation);
}

export function getInstitutions(user: User): Organization[] {
  const snapshot = getPlatformSnapshot();
  const institutions = snapshot.organizations.filter(
    (item) => item.tenantId === user.tenantId && item.type === 'INSTITUTION'
  );

  if (user.role === 'BANK') return [...institutions].sort((left, right) => left.name.localeCompare(right.name));
  return institutions.filter((item) => item.id === user.organizationId);
}

export function getVisibleUsers(user: User): User[] {
  const snapshot = getPlatformSnapshot();
  const users = snapshot.users.filter((item) => {
    if (item.tenantId !== user.tenantId) return false;
    if (user.role === 'BANK') return true;
    return item.organizationId === user.organizationId;
  });
  return [...users].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export function getVisibleRFQs(user: User): RFQ[] {
  const snapshot = getPlatformSnapshot();
  return sortByNewest(snapshot.rfqs.filter((item) => hasRFQAccess(user, item)));
}

export function getVisibleEscrowObligations(user: User): EscrowObligation[] {
  const snapshot = getPlatformSnapshot();
  return sortByNewest(
    snapshot.escrowObligations.filter((item) => {
      if (user.role === 'BANK') return item.tenantId === user.tenantId;
      return item.organizationId === user.organizationId;
    })
  );
}

export function getVisibleSettlements(user: User): SettlementRecord[] {
  const snapshot = getPlatformSnapshot();
  return sortByNewest(
    snapshot.settlements.filter((item) => {
      if (user.role === 'BANK') return item.tenantId === user.tenantId;
      return item.institutionId === user.organizationId;
    })
  );
}

export function getRFQDetails(user: User, rfqId: string) {
  const snapshot = getPlatformSnapshot();
  const rfq = getRFQ(snapshot, rfqId);
  if (!hasRFQAccess(user, rfq)) throw new Error('You do not have access to that RFQ.');

  return {
    rfq,
    institution: getOrganization(snapshot, rfq.institutionId),
    bankOrganization: getOrganization(snapshot, rfq.assignedBankId),
    quotes: [...snapshot.quotes]
      .filter((item) => item.rfqId === rfqId)
      .sort((left, right) => left.version - right.version),
    settlement: getSettlementForRFQ(snapshot, rfqId),
    escrowObligations: snapshot.escrowObligations.filter((item) => item.rfqId === rfqId),
    activity: sortByNewest(snapshot.activityEvents.filter((item) => item.entityId === rfqId)),
  };
}

export function getDashboardOverview(user: User) {
  const snapshot = getPlatformSnapshot();
  const tenant = getTenant(snapshot, user.tenantId);
  const rfqs = getVisibleRFQs(user);
  const obligations = getVisibleEscrowObligations(user);
  const settlements = getVisibleSettlements(user);

  if (user.role === 'BANK') {
    return {
      tenant,
      institutions: getInstitutions(user).length,
      newRFQs: rfqs.filter((item) => item.status === 'SUBMITTED').length,
      activeNegotiations: rfqs.filter((item) => item.status === 'NEGOTIATING').length,
      awaitingInstitutionDeposit: obligations.filter(
        (item) => item.partyRole === 'INSTITUTION' && item.status !== 'CONFIRMED'
      ).length,
      awaitingBankDeposit: obligations.filter(
        (item) => item.partyRole === 'BANK' && item.status !== 'CONFIRMED'
      ).length,
      readyToSettle: settlements.filter((item) => item.status === 'READY_TO_SETTLE').length,
      settlementExceptions: settlements.filter((item) => item.status === 'EXCEPTION').length,
    };
  }

  return {
    tenant,
    myRFQs: rfqs.length,
    activeNegotiations: rfqs.filter((item) => item.status === 'NEGOTIATING').length,
    awaitingMyDeposit: obligations.filter(
      (item) => item.organizationId === user.organizationId && item.status !== 'CONFIRMED'
    ).length,
    settlementHistory: settlements.filter((item) => item.status === 'SETTLED').length,
    pendingPolicy: rfqs.filter((item) => item.policyStatus === 'REVIEW_REQUIRED').length,
    teamMembers: getVisibleUsers(user).length,
  };
}

export async function createInstitution(actorUserId: string, input: CreateInstitutionInput): Promise<Organization> {
  const snapshot = getPlatformSnapshot();
  const actor = getUser(snapshot, actorUserId);
  ensureBankUser(actor);

  const organization: Organization = {
    id: createId('org'),
    tenantId: actor.tenantId,
    name: input.name.trim(),
    type: 'INSTITUTION',
    kybStatus: input.kybStatus,
    onboardingStatus: input.onboardingStatus ?? 'ACTIVE',
    bankRelationshipManager: input.bankRelationshipManager || actor.fullName,
    allowedUsers: input.allowedUsers ?? 10,
  };

  snapshot.organizations.push(organization);
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: actor.tenantId,
      entityType: 'INSTITUTION',
      entityId: organization.id,
      actorUserId,
      actorRole: actor.role,
      title: 'Institution onboarded',
      description: `${organization.name} was added to the bank tenant.`,
    })
  );
  savePlatformSnapshot(snapshot);
  return organization;
}

export async function createRFQ(actorUserId: string, input: CreateRFQInput): Promise<RFQ> {
  const snapshot = getPlatformSnapshot();
  const actor = getUser(snapshot, actorUserId);
  ensureInstitutionUser(actor);

  const bankOrganization = snapshot.organizations.find(
    (item) => item.tenantId === actor.tenantId && item.type === 'BANK'
  );
  if (!bankOrganization) throw new Error('No bank organization is configured for this tenant.');

  const rfq: RFQ = {
    id: createId('rfq'),
    tenantId: actor.tenantId,
    institutionId: actor.organizationId,
    assignedBankId: bankOrganization.id,
    creatorUserId: actor.id,
    side: input.side,
    baseAsset: input.baseAsset,
    quoteAsset: input.quoteAsset,
    amount: input.amount,
    status: 'SUBMITTED',
    expiresAt: input.expiresAt,
    policyStatus: input.policyStatus,
    settlementNotes: input.settlementNotes,
    institutionDepositAsset: input.side === 'BUY' ? input.quoteAsset : input.baseAsset,
    institutionDepositAmount: input.amount,
    bankDepositAsset: input.side === 'BUY' ? input.baseAsset : input.quoteAsset,
    bankDepositAmount: input.amount,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  snapshot.rfqs.unshift(rfq);
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: actor.tenantId,
      entityType: 'RFQ',
      entityId: rfq.id,
      actorUserId,
      actorRole: actor.role,
      title: 'RFQ submitted',
      description: `${actor.fullName} submitted an RFQ to ${bankOrganization.name}.`,
    })
  );
  savePlatformSnapshot(snapshot);
  return rfq;
}

export async function submitBankQuote(actorUserId: string, rfqId: string, input: SubmitQuoteInput): Promise<Quote> {
  return counterQuote(actorUserId, rfqId, { ...input });
}

export async function counterQuote(actorUserId: string, rfqId: string, input: CounterQuoteInput): Promise<Quote> {
  const snapshot = getPlatformSnapshot();
  const actor = getUser(snapshot, actorUserId);
  const rfq = getRFQ(snapshot, rfqId);
  if (!hasRFQAccess(actor, rfq)) throw new Error('You do not have access to that negotiation.');

  const currentQuotes = snapshot.quotes.filter((item) => item.rfqId === rfqId);
  const latestQuote = getLatestQuote(currentQuotes);
  const bankUserId = actor.role === 'BANK' ? actor.id : rfq.assignedBankUserId ?? latestQuote?.bankUserId;
  if (!bankUserId) throw new Error('A bank quote must exist before negotiation can continue.');

  const version = Math.max(0, ...currentQuotes.map((item) => item.version)) + 1;
  if (latestQuote && !['ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'].includes(latestQuote.status)) {
    latestQuote.status = 'SUPERSEDED';
  }

  if (actor.role === 'BANK') {
    rfq.assignedBankUserId = actor.id;
    const terms = buildEscrowTerms(rfq, input.price, input.size);
    rfq.institutionDepositAsset = terms.institutionAsset;
    rfq.institutionDepositAmount = terms.institutionAmount;
    rfq.bankDepositAsset = terms.bankAsset;
    rfq.bankDepositAmount = terms.bankAmount;
  }
  rfq.status = version === 1 ? 'QUOTED' : 'NEGOTIATING';
  rfq.updatedAt = nowIso();

  const quote: Quote = {
    id: createId('quote'),
    tenantId: actor.tenantId,
    rfqId,
    bankUserId,
    institutionId: rfq.institutionId,
    createdByUserId: actor.id,
    createdByRole: actor.role,
    price: input.price,
    size: input.size,
    status: version === 1 ? 'SENT' : 'COUNTERED',
    version,
    expiresAt: input.expiresAt,
    createdAt: nowIso(),
    negotiationNote: input.negotiationNote,
    settlementNotes: input.settlementNotes,
    supersedesQuoteId: input.supersedesQuoteId ?? latestQuote?.id,
  };

  snapshot.quotes = snapshot.quotes.filter((item) => item.id !== quote.id).concat(quote);
  replaceRFQ(snapshot, rfq);
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: actor.tenantId,
      entityType: 'QUOTE',
      entityId: quote.id,
      actorUserId,
      actorRole: actor.role,
      title: actor.role === 'BANK' && version === 1 ? 'Bank quote sent' : 'Negotiation updated',
      description: `${actor.fullName} proposed quote version ${quote.version}.`,
    })
  );
  savePlatformSnapshot(snapshot);
  return quote;
}

export async function acceptQuote(actorUserId: string, rfqId: string, quoteId: string): Promise<RFQ> {
  const snapshot = getPlatformSnapshot();
  const actor = getUser(snapshot, actorUserId);
  ensureInstitutionUser(actor);

  const rfq = getRFQ(snapshot, rfqId);
  if (!hasRFQAccess(actor, rfq)) throw new Error('That RFQ is outside your organization.');

  const quote = snapshot.quotes.find((item) => item.id === quoteId && item.rfqId === rfqId);
  if (!quote) throw new Error('Quote not found.');

  snapshot.quotes = snapshot.quotes.map((item) => {
    if (item.rfqId !== rfqId) return item;
    if (item.id === quoteId) return { ...item, status: 'ACCEPTED' };
    if (['ACCEPTED', 'REJECTED', 'EXPIRED'].includes(item.status)) return item;
    return { ...item, status: 'SUPERSEDED' };
  });

  const terms = buildEscrowTerms(rfq, quote.price, quote.size);
  const bankOrganization = snapshot.organizations.find(
    (item) => item.tenantId === actor.tenantId && item.type === 'BANK'
  );
  if (!bankOrganization) throw new Error('Bank organization not found.');

  rfq.selectedQuoteId = quoteId;
  rfq.status = 'ESCROW_PENDING';
  rfq.institutionDepositAsset = terms.institutionAsset;
  rfq.institutionDepositAmount = terms.institutionAmount;
  rfq.bankDepositAsset = terms.bankAsset;
  rfq.bankDepositAmount = terms.bankAmount;
  rfq.updatedAt = nowIso();

  snapshot.escrowObligations = snapshot.escrowObligations.filter((item) => item.rfqId !== rfqId).concat([
    {
      id: createId('escrow'),
      tenantId: actor.tenantId,
      rfqId,
      quoteId,
      partyRole: 'INSTITUTION',
      organizationId: actor.organizationId,
      asset: terms.institutionAsset,
      amount: terms.institutionAmount,
      status: 'PENDING',
      confirmationState: 'UNCONFIRMED',
      creditedInContra: false,
      updatedAt: nowIso(),
    },
    {
      id: createId('escrow'),
      tenantId: actor.tenantId,
      rfqId,
      quoteId,
      partyRole: 'BANK',
      organizationId: bankOrganization.id,
      asset: terms.bankAsset,
      amount: terms.bankAmount,
      status: 'PENDING',
      confirmationState: 'UNCONFIRMED',
      creditedInContra: false,
      updatedAt: nowIso(),
    },
  ]);

  replaceSettlement(snapshot, {
    id: createId('settlement'),
    tenantId: actor.tenantId,
    rfqId,
    quoteId,
    institutionId: actor.organizationId,
    bankOrganizationId: bankOrganization.id,
    status: 'AWAITING_DEPOSITS',
    policyStatus: rfq.policyStatus,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  replaceRFQ(snapshot, rfq);
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: actor.tenantId,
      entityType: 'RFQ',
      entityId: rfqId,
      actorUserId,
      actorRole: actor.role,
      title: 'Quote accepted',
      description: `${actor.fullName} accepted quote version ${quote.version} and initiated escrow.`,
    })
  );
  savePlatformSnapshot(snapshot);
  return rfq;
}

export async function submitEscrowDeposit(
  actorUserId: string,
  obligationId: string,
  txHash: string
): Promise<EscrowObligation> {
  const snapshot = getPlatformSnapshot();
  const actor = getUser(snapshot, actorUserId);
  const obligation = snapshot.escrowObligations.find((item) => item.id === obligationId);
  if (!obligation) throw new Error('Escrow obligation not found.');

  if (actor.role === 'INSTITUTION' && obligation.organizationId !== actor.organizationId) {
    throw new Error("You can only fund your organization's escrow.");
  }
  if (actor.role === 'BANK' && obligation.partyRole !== 'BANK') {
    throw new Error('Bank users can only confirm bank-side escrow obligations.');
  }

  obligation.status = 'CONFIRMED';
  obligation.txHash = txHash;
  obligation.confirmationState = 'CONFIRMED';
  obligation.creditedInContra = true;
  obligation.updatedAt = nowIso();
  replaceObligation(snapshot, obligation);

  const relatedObligations = snapshot.escrowObligations.filter((item) => item.rfqId === obligation.rfqId);
  const rfq = getRFQ(snapshot, obligation.rfqId);
  const settlement = getSettlementForRFQ(snapshot, obligation.rfqId);

  if (settlement) {
    if (relatedObligations.every((item) => item.status === 'CONFIRMED')) {
      settlement.status = 'SETTLED';
      settlement.updatedAt = nowIso();
      settlement.completedAt = nowIso();
      rfq.status = 'SETTLED';
    } else {
      settlement.status = 'READY_TO_SETTLE';
      settlement.updatedAt = nowIso();
      rfq.status = 'SETTLING';
    }
    replaceSettlement(snapshot, settlement);
  }

  rfq.updatedAt = nowIso();
  replaceRFQ(snapshot, rfq);
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: actor.tenantId,
      entityType: 'ESCROW',
      entityId: obligation.id,
      actorUserId,
      actorRole: actor.role,
      title: 'Escrow funded',
      description: `${actor.fullName} confirmed ${obligation.partyRole.toLowerCase()}-side escrow funding.`,
    })
  );
  savePlatformSnapshot(snapshot);
  return obligation;
}
