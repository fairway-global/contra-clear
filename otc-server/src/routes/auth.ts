import { Hono } from 'hono';
import { verifyAndCreateSession, revokeSession } from '../services/auth.js';
import {
  acceptInvite,
  createPasswordReset,
  getEmailSessionProfile,
  inviteUser,
  loginWithEmail,
  revokeEmailSession,
  resetPassword,
} from '../services/emailAuth.js';
import * as store from '../db/store.js';

const app = new Hono();

function getBearerToken(authHeader?: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// Login: supports both legacy wallet auth and email-based tenant access
app.post('/login', async (c) => {
  const body = await c.req.json();

  if (body.email && body.password) {
    try {
      const result = loginWithEmail(body.email, body.password);
      return c.json({ authType: 'email', token: result.token, profile: result.profile });
    } catch (err: any) {
      return c.json({ error: err.message }, 401);
    }
  }

  const { walletAddress, message, signature } = body;
  if (!walletAddress || !message || !signature) {
    return c.json({ error: 'Provide email/password or walletAddress/message/signature.' }, 400);
  }

  try {
    const token = verifyAndCreateSession(walletAddress, message, signature);
    // Auto-register as client
    store.registerClient(walletAddress, '');
    return c.json({ authType: 'wallet', token, walletAddress });
  } catch (err: any) {
    return c.json({ error: err.message }, 401);
  }
});

app.get('/me', (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) {
    return c.json({ error: 'Authentication required.' }, 401);
  }

  const profile = getEmailSessionProfile(token);
  if (profile) {
    return c.json({ authType: 'email', profile });
  }

  return c.json({ error: 'Session not found.' }, 401);
});

// Logout
app.post('/logout', async (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (token) {
    revokeSession(token);
    revokeEmailSession(token);
  }
  return c.json({ success: true });
});

app.post('/invite-user', async (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) {
    return c.json({ error: 'Authentication required.' }, 401);
  }

  const profile = getEmailSessionProfile(token);
  if (!profile) {
    return c.json({ error: 'Email session required.' }, 401);
  }

  try {
    const body = await c.req.json();
    const result = inviteUser(profile.user.id, {
      organizationId: body.organizationId,
      email: body.email,
      fullName: body.fullName,
      role: body.role,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post('/accept-invite', async (c) => {
  try {
    const body = await c.req.json();
    const result = acceptInvite({
      token: body.token,
      fullName: body.fullName,
      password: body.password,
    });
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json();
    const result = createPasswordReset(body.email);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    resetPassword(body.token, body.password);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

export default app;
