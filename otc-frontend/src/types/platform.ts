export type UserRole = 'BANK' | 'INSTITUTION';

export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export type OrganizationType = 'BANK' | 'INSTITUTION';

export type OrganizationStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

export type KYBStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PolicyStatus = 'CLEAR' | 'REVIEW_REQUIRED' | 'BLOCKED';

export type RFQSide = 'BUY' | 'SELL';

export type RFQStatus =
  | 'SUBMITTED'
  | 'QUOTED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'ESCROW_PENDING'
  | 'SETTLING'
  | 'SETTLED'
  | 'CANCELLED';

export type QuoteStatus =
  | 'SENT'
  | 'COUNTERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED';

export type EscrowStatus = 'PENDING' | 'FUNDED' | 'CONFIRMED' | 'FAILED';

export type ConfirmationState = 'UNCONFIRMED' | 'CONFIRMING' | 'CONFIRMED';

export type SettlementStatus =
  | 'PENDING_POLICY'
  | 'AWAITING_DEPOSITS'
  | 'READY_TO_SETTLE'
  | 'SETTLING'
  | 'SETTLED'
  | 'EXCEPTION';

export interface Tenant {
  id: string;
  name: string;
  type: 'BANK';
  bankName: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
  policyProfile: string[];
  nodeConfig?: {
    network: string;
    escrowRail: string;
  };
  allowedAssets: string[];
}

export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  type: OrganizationType;
  kybStatus?: KYBStatus;
  onboardingStatus: OrganizationStatus;
  bankRelationshipManager?: string;
  allowedUsers: number;
}

export interface User {
  id: string;
  tenantId: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
}

export interface RFQ {
  id: string;
  tenantId: string;
  institutionId: string;
  assignedBankId: string;
  assignedBankUserId?: string;
  creatorUserId: string;
  side: RFQSide;
  baseAsset: string;
  quoteAsset: string;
  amount: string;
  status: RFQStatus;
  expiresAt: string;
  selectedQuoteId?: string;
  policyStatus: PolicyStatus;
  settlementNotes?: string;
  institutionDepositAsset: string;
  institutionDepositAmount: string;
  bankDepositAsset: string;
  bankDepositAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  tenantId: string;
  rfqId: string;
  bankUserId: string;
  institutionId: string;
  createdByUserId: string;
  createdByRole: UserRole;
  price: string;
  size: string;
  status: QuoteStatus;
  version: number;
  expiresAt: string;
  createdAt: string;
  negotiationNote?: string;
  settlementNotes?: string;
  supersedesQuoteId?: string;
}

export interface EscrowObligation {
  id: string;
  tenantId: string;
  rfqId: string;
  quoteId: string;
  partyRole: UserRole;
  organizationId: string;
  asset: string;
  amount: string;
  status: EscrowStatus;
  txHash?: string;
  confirmationState: ConfirmationState;
  creditedInContra: boolean;
  updatedAt: string;
}

export interface SettlementRecord {
  id: string;
  tenantId: string;
  rfqId: string;
  quoteId: string;
  institutionId: string;
  bankOrganizationId: string;
  status: SettlementStatus;
  policyStatus: PolicyStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ActivityEvent {
  id: string;
  tenantId: string;
  entityType: 'RFQ' | 'QUOTE' | 'ESCROW' | 'SETTLEMENT' | 'USER' | 'INSTITUTION';
  entityId: string;
  actorUserId: string;
  actorRole: UserRole;
  title: string;
  description: string;
  createdAt: string;
}

export interface InviteRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  userId: string;
  email: string;
  invitedByUserId: string;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface CredentialRecord {
  userId: string;
  password: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  createdAt: string;
}

export interface AuthProfile {
  user: User;
  tenant: Tenant;
  organization: Organization;
}

export interface PlatformSnapshot {
  schemaVersion: number;
  tenants: Tenant[];
  organizations: Organization[];
  users: User[];
  credentials: CredentialRecord[];
  invites: InviteRecord[];
  passwordResets: PasswordResetRecord[];
  rfqs: RFQ[];
  quotes: Quote[];
  escrowObligations: EscrowObligation[];
  settlements: SettlementRecord[];
  activityEvents: ActivityEvent[];
}

export interface CreateInstitutionInput {
  name: string;
  kybStatus: KYBStatus;
  onboardingStatus?: OrganizationStatus;
  allowedUsers?: number;
  bankRelationshipManager?: string;
}

export interface InviteUserInput {
  organizationId: string;
  email: string;
  fullName: string;
  role?: UserRole;
}

export interface AcceptInviteInput {
  token: string;
  fullName: string;
  password: string;
}

export interface CreateRFQInput {
  side: RFQSide;
  baseAsset: string;
  quoteAsset: string;
  amount: string;
  expiresAt: string;
  policyStatus: PolicyStatus;
  settlementNotes?: string;
}

export interface SubmitQuoteInput {
  price: string;
  size: string;
  expiresAt: string;
  settlementNotes?: string;
  negotiationNote?: string;
}

export interface CounterQuoteInput extends SubmitQuoteInput {
  supersedesQuoteId?: string;
}
