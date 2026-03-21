export enum UserRole {
  RFQ_ORIGINATOR = 'RFQ_ORIGINATOR',
  LIQUIDITY_PROVIDER = 'LIQUIDITY_PROVIDER',
  ADMIN = 'ADMIN',
}

export enum RFQStatus {
  Draft = 'Draft',
  OpenForQuotes = 'OpenForQuotes',
  Negotiating = 'Negotiating',
  QuoteSelected = 'QuoteSelected',
  AwaitingOriginatorDeposit = 'AwaitingOriginatorDeposit',
  AwaitingProviderDeposit = 'AwaitingProviderDeposit',
  ReadyToSettle = 'ReadyToSettle',
  Settling = 'Settling',
  Settled = 'Settled',
  Expired = 'Expired',
  Cancelled = 'Cancelled',
  Defaulted = 'Defaulted',
}

export enum QuoteStatus {
  Draft = 'Draft',
  Submitted = 'Submitted',
  Countered = 'Countered',
  Negotiating = 'Negotiating',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  Expired = 'Expired',
  AwaitingDeposit = 'AwaitingDeposit',
  Deposited = 'Deposited',
  Settled = 'Settled',
  Cancelled = 'Cancelled',
}

export enum EscrowStatus {
  NotStarted = 'NotStarted',
  DepositRequested = 'DepositRequested',
  PendingOnChain = 'PendingOnChain',
  ConfirmedOnChain = 'ConfirmedOnChain',
  CreditedInContra = 'CreditedInContra',
  LockedForSettlement = 'LockedForSettlement',
  Released = 'Released',
  Withdrawn = 'Withdrawn',
  Failed = 'Failed',
  Expired = 'Expired',
}

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';
export type QuoteSide = 'sell' | 'buy';
export type EscrowPartyRole = Extract<UserRole, UserRole.RFQ_ORIGINATOR | UserRole.LIQUIDITY_PROVIDER>;
export type RequestedAccessRole = Extract<UserRole, UserRole.RFQ_ORIGINATOR | UserRole.LIQUIDITY_PROVIDER>;

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface RFQ {
  id: string;
  reference: string;
  sequence?: string;
  originatorId: string;
  originatorName: string;
  sellToken: string;
  sellAmount: string;
  buyToken: string;
  indicativeBuyAmount: string;
  requiredTier?: number;
  expiresInSeconds?: number;
  side: QuoteSide;
  status: RFQStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  notes?: string;
  selectedQuoteId?: string;
  selectedProviderId?: string;
  selectedProviderName?: string;
  acceptedPrice?: string;
}

export interface Quote {
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
  note?: string;
  createdAt: string;
  updatedAt: string;
  parentQuoteId?: string;
}

export interface EscrowObligation {
  id: string;
  rfqId: string;
  partyRole: EscrowPartyRole;
  partyId: string;
  partyName: string;
  tokenMint: string;
  amount: string;
  status: EscrowStatus;
  txHash?: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  rfqId: string;
  type:
    | 'RFQ_CREATED'
    | 'QUOTE_SUBMITTED'
    | 'QUOTE_COUNTERED'
    | 'QUOTE_ACCEPTED'
    | 'QUOTE_REJECTED'
    | 'ESCROW_REQUESTED'
    | 'ESCROW_SUBMITTED'
    | 'ESCROW_LOCKED'
    | 'SETTLEMENT_STARTED'
    | 'SETTLEMENT_COMPLETED'
    | 'RFQ_UPDATED'
    | 'RFQ_CANCELLED';
  actorId: string;
  actorName: string;
  summary: string;
  detail?: string;
  createdAt: string;
  relatedQuoteId?: string;
}

export interface ViewerIdentity {
  role: UserRole;
  userId: string;
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
  role: Extract<UserRole, UserRole.RFQ_ORIGINATOR | UserRole.LIQUIDITY_PROVIDER>;
  status: UserStatus;
}

export interface PlatformAccessRequestInput {
  institutionName: string;
  contactName: string;
  email: string;
  institutionType: string;
  jurisdiction: string;
  requestedRoles: RequestedAccessRole[];
}

export interface PlatformAccessRequest extends PlatformAccessRequestInput {
  id: string;
  status: 'SUBMITTED';
  createdAt: string;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.RFQ_ORIGINATOR]: 'RFQ Originator',
  [UserRole.LIQUIDITY_PROVIDER]: 'Liquidity Provider',
  [UserRole.ADMIN]: 'Admin',
};

export const RFQ_STATUS_LABELS: Record<RFQStatus, string> = {
  [RFQStatus.Draft]: 'Draft',
  [RFQStatus.OpenForQuotes]: 'Open For Quotes',
  [RFQStatus.Negotiating]: 'Negotiating',
  [RFQStatus.QuoteSelected]: 'Quote Selected',
  [RFQStatus.AwaitingOriginatorDeposit]: 'Awaiting Originator Deposit',
  [RFQStatus.AwaitingProviderDeposit]: 'Awaiting Provider Deposit',
  [RFQStatus.ReadyToSettle]: 'Ready To Settle',
  [RFQStatus.Settling]: 'Settling',
  [RFQStatus.Settled]: 'Settled',
  [RFQStatus.Expired]: 'Expired',
  [RFQStatus.Cancelled]: 'Cancelled',
  [RFQStatus.Defaulted]: 'Defaulted',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.Draft]: 'Draft',
  [QuoteStatus.Submitted]: 'Submitted',
  [QuoteStatus.Countered]: 'Countered',
  [QuoteStatus.Negotiating]: 'Negotiating',
  [QuoteStatus.Accepted]: 'Accepted',
  [QuoteStatus.Rejected]: 'Rejected',
  [QuoteStatus.Expired]: 'Expired',
  [QuoteStatus.AwaitingDeposit]: 'Awaiting Deposit',
  [QuoteStatus.Deposited]: 'Deposited',
  [QuoteStatus.Settled]: 'Settled',
  [QuoteStatus.Cancelled]: 'Cancelled',
};

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  [EscrowStatus.NotStarted]: 'Not Started',
  [EscrowStatus.DepositRequested]: 'Deposit Requested',
  [EscrowStatus.PendingOnChain]: 'Pending On-Chain',
  [EscrowStatus.ConfirmedOnChain]: 'Confirmed On-Chain',
  [EscrowStatus.CreditedInContra]: 'Credited In Contra',
  [EscrowStatus.LockedForSettlement]: 'Locked For Settlement',
  [EscrowStatus.Released]: 'Released',
  [EscrowStatus.Withdrawn]: 'Withdrawn',
  [EscrowStatus.Failed]: 'Failed',
  [EscrowStatus.Expired]: 'Expired',
};
