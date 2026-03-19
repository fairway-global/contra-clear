import type {
  AcceptInviteInput,
  AuthProfile,
  AuthSession,
  InviteUserInput,
  User,
} from '../types/platform';
import {
  clearAuthSession,
  createActivityEvent,
  createId,
  findActiveSessionProfile,
  getOrganization,
  getPlatformSnapshot,
  getTenant,
  getUser,
  nowIso,
  plusDays,
  saveAuthSession,
  savePlatformSnapshot,
} from './platformStore';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildProfile(user: User): AuthProfile {
  const snapshot = getPlatformSnapshot();
  return {
    user,
    tenant: getTenant(snapshot, user.tenantId),
    organization: getOrganization(snapshot, user.organizationId),
  };
}

function createSession(userId: string): AuthSession {
  return saveAuthSession({
    token: createId('session'),
    userId,
    createdAt: nowIso(),
  });
}

export async function login(email: string, password: string): Promise<AuthProfile> {
  const snapshot = getPlatformSnapshot();
  const normalizedEmail = normalizeEmail(email);

  const user = snapshot.users.find(
    (item) => normalizeEmail(item.email) === normalizedEmail && item.status === 'ACTIVE'
  );

  if (!user) {
    throw new Error('No active user found for that email.');
  }

  const credential = snapshot.credentials.find((item) => item.userId === user.id);
  if (!credential || credential.password !== password) {
    throw new Error('Incorrect email or password.');
  }

  user.lastLoginAt = nowIso();
  savePlatformSnapshot(snapshot);
  createSession(user.id);
  return buildProfile(user);
}

export async function logout(): Promise<void> {
  clearAuthSession();
}

export async function getCurrentUser(): Promise<AuthProfile | null> {
  return findActiveSessionProfile();
}

export async function inviteUser(
  actorUserId: string,
  input: InviteUserInput
): Promise<{ inviteToken: string; inviteUrl: string; userId: string }> {
  const snapshot = getPlatformSnapshot();
  const actor = getUser(snapshot, actorUserId);
  const organization = getOrganization(snapshot, input.organizationId);
  const email = normalizeEmail(input.email);

  if (actor.status !== 'ACTIVE') {
    throw new Error('Only active users can send invitations.');
  }

  if (actor.role === 'INSTITUTION' && actor.organizationId !== input.organizationId) {
    throw new Error('Institution users can only invite teammates to their own organization.');
  }

  if (organization.tenantId !== actor.tenantId) {
    throw new Error('Users can only invite within their tenant.');
  }

  const existing = snapshot.users.find((item) => normalizeEmail(item.email) === email);
  if (existing && existing.status === 'ACTIVE') {
    throw new Error('That email is already active on the platform.');
  }

  const userId = existing?.id ?? createId('user');
  const inviteToken = createId('invite');
  const role = input.role ?? (organization.type === 'BANK' ? 'BANK' : 'INSTITUTION');

  const user: User = existing ?? {
    id: userId,
    tenantId: organization.tenantId,
    organizationId: organization.id,
    email,
    fullName: input.fullName,
    role,
    status: 'INVITED',
  };

  user.organizationId = organization.id;
  user.tenantId = organization.tenantId;
  user.role = role;
  user.fullName = input.fullName;
  user.status = 'INVITED';
  user.email = email;

  snapshot.users = snapshot.users.filter((item) => item.id !== userId).concat(user);
  snapshot.invites.push({
    id: createId('invite-record'),
    tenantId: actor.tenantId,
    organizationId: organization.id,
    userId,
    email,
    invitedByUserId: actorUserId,
    token: inviteToken,
    expiresAt: plusDays(7),
  });
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: actor.tenantId,
      entityType: 'USER',
      entityId: userId,
      actorUserId,
      actorRole: actor.role,
      title: 'User invited',
      description: `${input.fullName} was invited to ${organization.name}.`,
    })
  );

  savePlatformSnapshot(snapshot);

  return {
    inviteToken,
    inviteUrl: `/accept-invite?token=${inviteToken}`,
    userId,
  };
}

export async function acceptInvite(input: AcceptInviteInput): Promise<AuthProfile> {
  const snapshot = getPlatformSnapshot();
  const invite = snapshot.invites.find(
    (item) => item.token === input.token && !item.acceptedAt && item.expiresAt > nowIso()
  );

  if (!invite) {
    throw new Error('That invite is invalid or has expired.');
  }

  const user = getUser(snapshot, invite.userId);
  user.status = 'ACTIVE';
  user.fullName = input.fullName.trim();
  user.lastLoginAt = nowIso();

  snapshot.credentials = snapshot.credentials.filter((item) => item.userId !== user.id);
  snapshot.credentials.push({ userId: user.id, password: input.password });
  invite.acceptedAt = nowIso();
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: user.tenantId,
      entityType: 'USER',
      entityId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      title: 'Invite accepted',
      description: `${user.fullName} activated their account.`,
    })
  );

  savePlatformSnapshot(snapshot);
  createSession(user.id);
  return buildProfile(user);
}

export async function forgotPassword(email: string): Promise<{ resetToken: string; resetUrl: string }> {
  const snapshot = getPlatformSnapshot();
  const user = snapshot.users.find(
    (item) => normalizeEmail(item.email) === normalizeEmail(email) && item.status === 'ACTIVE'
  );

  if (!user) {
    throw new Error('No active account found for that email.');
  }

  const resetToken = createId('reset');
  snapshot.passwordResets.push({
    id: createId('password-reset'),
    userId: user.id,
    email: user.email,
    token: resetToken,
    expiresAt: plusDays(1),
  });
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: user.tenantId,
      entityType: 'USER',
      entityId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      title: 'Password reset requested',
      description: `${user.email} requested a password reset.`,
    })
  );

  savePlatformSnapshot(snapshot);

  return {
    resetToken,
    resetUrl: `/reset-password?token=${resetToken}`,
  };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const snapshot = getPlatformSnapshot();
  const reset = snapshot.passwordResets.find(
    (item) => item.token === token && !item.consumedAt && item.expiresAt > nowIso()
  );

  if (!reset) {
    throw new Error('That reset link is invalid or has expired.');
  }

  snapshot.credentials = snapshot.credentials.filter((item) => item.userId !== reset.userId);
  snapshot.credentials.push({ userId: reset.userId, password });
  reset.consumedAt = nowIso();

  const user = getUser(snapshot, reset.userId);
  snapshot.activityEvents.unshift(
    createActivityEvent({
      tenantId: user.tenantId,
      entityType: 'USER',
      entityId: user.id,
      actorUserId: user.id,
      actorRole: user.role,
      title: 'Password reset completed',
      description: `${user.email} reset their password.`,
    })
  );

  savePlatformSnapshot(snapshot);
}
