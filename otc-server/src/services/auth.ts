import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { randomUUID } from 'crypto';

// Session store: token -> { wallet, expiresAt }
const sessions = new Map<string, { wallet: string; expiresAt: number }>();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Clean expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(token);
  }
}, 60_000);

// Verify a signed login message and create a session
export function verifyAndCreateSession(
  walletAddress: string,
  message: string,
  signature: string
): string {
  // Validate wallet address
  const pubkey = new PublicKey(walletAddress);

  // Verify signature
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = bs58.decode(signature);
  const pubkeyBytes = pubkey.toBytes();

  const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
  if (!valid) {
    throw new Error('Invalid signature');
  }

  // Verify the message contains a recent timestamp (within 5 minutes)
  const timestampMatch = message.match(/timestamp:(\d+)/);
  if (timestampMatch) {
    const messageTime = parseInt(timestampMatch[1]);
    if (Math.abs(Date.now() - messageTime) > 5 * 60 * 1000) {
      throw new Error('Message expired');
    }
  }

  // Create session
  const token = randomUUID();
  sessions.set(token, {
    wallet: walletAddress,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return token;
}

// Validate a session token, return the wallet address
export function getSessionWallet(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.wallet;
}

// Invalidate a session
export function revokeSession(token: string): void {
  sessions.delete(token);
}
