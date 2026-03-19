import { randomUUID } from 'crypto';

type UserRole = 'BANK' | 'INSTITUTION';
type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
type OrganizationType = 'BANK' | 'INSTITUTION';
type OrganizationStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
type KYBStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface TenantRecord {
  id: string;
  bankName: string;
  allowedAssets: string[];
}

interface OrganizationRecord {
  id: string;
  tenantId: string;
  name: string;
  type: OrganizationType;
  kybStatus?: KYBStatus;
  onboardingStatus: OrganizationStatus;
  bankRelationshipManager?: string;
  allowedUsers?: number;
}

interface UserRecord {
  id: string;
  tenantId: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
}

interface InviteRecord {
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

interface PasswordResetRecord {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  consumedAt?: string;
}

interface CredentialRecord {
  userId: string;
  password: string;
}

interface EmailSessionRecord {
  userId: string;
  expiresAt: number;
}

interface EmailAuthState {
  tenants: TenantRecord[];
  organizations: OrganizationRecord[];
  users: UserRecord[];
  credentials: CredentialRecord[];
  invites: InviteRecord[];
  passwordResets: PasswordResetRecord[];
}

export interface EmailAuthProfile {
  user: UserRecord;
  tenant: TenantRecord;
  organization: OrganizationRecord;
}

interface InviteUserInput {
  organizationId: string;
  email: string;
  fullName: string;
  role?: UserRole;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const emailSessions = new Map<string, EmailSessionRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

function plusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function seedEmailAuthState(): EmailAuthState {
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

  return {
    tenants: [
      {
        id: tenantId,
        bankName: 'Aurora Bank',
        allowedAssets: ['USD', 'USDC', 'SOL', 'BTC'],
      },
    ],
    organizations: [
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
    ],
    users: [
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
        lastLoginAt: hoursAgo(14),
      },
      {
        id: helixTreasuryId,
        tenantId,
        organizationId: helixId,
        email: 'treasury@helix.demo',
        fullName: 'Leo Brooks',
        role: 'INSTITUTION',
        status: 'ACTIVE',
        lastLoginAt: hoursAgo(20),
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
    ],
    credentials: [
      { userId: bankAdminId, password: 'demo123' },
      { userId: bankQuoterId, password: 'demo123' },
      { userId: northstarTraderId, password: 'demo123' },
      { userId: northstarOpsId, password: 'demo123' },
      { userId: helixTreasuryId, password: 'demo123' },
    ],
    invites: [
      {
        id: 'invite-record-northstar-analyst',
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
  };
}

let emailAuthState = seedEmailAuthState();

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of emailSessions) {
    if (session.expiresAt < now) {
      emailSessions.delete(token);
    }
  }
}, 60_000);

function getTenant(tenantId: string): TenantRecord {
  const tenant = emailAuthState.tenants.find((item) => item.id === tenantId);
  if (!tenant) throw new Error('Tenant not found.');
  return tenant;
}

function getOrganization(organizationId: string): OrganizationRecord {
  const organization = emailAuthState.organizations.find((item) => item.id === organizationId);
  if (!organization) throw new Error('Organization not found.');
  return organization;
}

function getUser(userId: string): UserRecord {
  const user = emailAuthState.users.find((item) => item.id === userId);
  if (!user) throw new Error('User not found.');
  return user;
}

function buildProfile(user: UserRecord): EmailAuthProfile {
  return {
    user,
    tenant: getTenant(user.tenantId),
    organization: getOrganization(user.organizationId),
  };
}

function createEmailSession(userId: string): string {
  const token = randomUUID();
  emailSessions.set(token, {
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function getEmailSessionProfile(token: string): EmailAuthProfile | null {
  const session = emailSessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    emailSessions.delete(token);
    return null;
  }

  const user = emailAuthState.users.find((item) => item.id === session.userId && item.status === 'ACTIVE');
  if (!user) {
    emailSessions.delete(token);
    return null;
  }

  return buildProfile(user);
}

export function revokeEmailSession(token: string): void {
  emailSessions.delete(token);
}

export function loginWithEmail(email: string, password: string): { token: string; profile: EmailAuthProfile } {
  const normalizedEmail = normalizeEmail(email);
  const user = emailAuthState.users.find(
    (item) => normalizeEmail(item.email) === normalizedEmail && item.status === 'ACTIVE'
  );

  if (!user) {
    throw new Error('No active user found for that email.');
  }

  const credential = emailAuthState.credentials.find((item) => item.userId === user.id);
  if (!credential || credential.password !== password) {
    throw new Error('Incorrect email or password.');
  }

  user.lastLoginAt = nowIso();
  const token = createEmailSession(user.id);
  return { token, profile: buildProfile(user) };
}

export function inviteUser(
  actorUserId: string,
  input: InviteUserInput
): { inviteToken: string; inviteUrl: string; userId: string } {
  const actor = getUser(actorUserId);
  const organization = getOrganization(input.organizationId);
  const email = normalizeEmail(input.email);

  if (actor.status !== 'ACTIVE') {
    throw new Error('Only active users can send invitations.');
  }

  if (organization.tenantId !== actor.tenantId) {
    throw new Error('Invitations must stay within the same bank tenant.');
  }

  if (actor.role === 'INSTITUTION' && actor.organizationId !== organization.id) {
    throw new Error('Institution users can only invite teammates to their own organization.');
  }

  const existing = emailAuthState.users.find((item) => normalizeEmail(item.email) === email);
  if (existing && existing.status === 'ACTIVE') {
    throw new Error('That user is already active.');
  }

  const userId = existing?.id ?? `user-${randomUUID()}`;
  const inviteToken = `invite-${randomUUID()}`;
  const role = input.role ?? (organization.type === 'BANK' ? 'BANK' : 'INSTITUTION');

  const user: UserRecord = existing ?? {
    id: userId,
    tenantId: organization.tenantId,
    organizationId: organization.id,
    email,
    fullName: input.fullName.trim(),
    role,
    status: 'INVITED',
  };

  user.tenantId = organization.tenantId;
  user.organizationId = organization.id;
  user.email = email;
  user.fullName = input.fullName.trim();
  user.role = role;
  user.status = 'INVITED';

  emailAuthState.users = emailAuthState.users.filter((item) => item.id !== userId).concat(user);
  emailAuthState.invites.push({
    id: `invite-record-${randomUUID()}`,
    tenantId: actor.tenantId,
    organizationId: organization.id,
    userId,
    email,
    invitedByUserId: actorUserId,
    token: inviteToken,
    expiresAt: plusDays(7),
  });

  return {
    inviteToken,
    inviteUrl: `/accept-invite?token=${inviteToken}`,
    userId,
  };
}

export function acceptInvite(input: {
  token: string;
  fullName: string;
  password: string;
}): { token: string; profile: EmailAuthProfile } {
  const invite = emailAuthState.invites.find(
    (item) => item.token === input.token && !item.acceptedAt && item.expiresAt > nowIso()
  );
  if (!invite) {
    throw new Error('That invite is invalid or has expired.');
  }

  const user = getUser(invite.userId);
  user.status = 'ACTIVE';
  user.fullName = input.fullName.trim();
  user.lastLoginAt = nowIso();
  invite.acceptedAt = nowIso();

  emailAuthState.credentials = emailAuthState.credentials.filter((item) => item.userId !== user.id);
  emailAuthState.credentials.push({
    userId: user.id,
    password: input.password,
  });

  const token = createEmailSession(user.id);
  return { token, profile: buildProfile(user) };
}

export function createPasswordReset(email: string): { resetToken: string; resetUrl: string } {
  const normalizedEmail = normalizeEmail(email);
  const user = emailAuthState.users.find(
    (item) => normalizeEmail(item.email) === normalizedEmail && item.status === 'ACTIVE'
  );

  if (!user) {
    throw new Error('No active account found for that email.');
  }

  const resetToken = `reset-${randomUUID()}`;
  emailAuthState.passwordResets.push({
    id: `password-reset-${randomUUID()}`,
    userId: user.id,
    email: user.email,
    token: resetToken,
    expiresAt: plusDays(1),
  });

  return {
    resetToken,
    resetUrl: `/reset-password?token=${resetToken}`,
  };
}

export function resetPassword(token: string, password: string): void {
  const reset = emailAuthState.passwordResets.find(
    (item) => item.token === token && !item.consumedAt && item.expiresAt > nowIso()
  );

  if (!reset) {
    throw new Error('That reset link is invalid or has expired.');
  }

  emailAuthState.credentials = emailAuthState.credentials.filter((item) => item.userId !== reset.userId);
  emailAuthState.credentials.push({
    userId: reset.userId,
    password,
  });
  reset.consumedAt = nowIso();
}
