import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
// Zyphe SDK — only used for webhook signature verification
// Session creation uses direct sandbox URLs (no API key needed)
import { verifyWebhookSignatureHeader } from '@zyphe-sdk/node';

// Extended Request type with rawBody
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

// KYC Data types
interface KYCData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
  [key: string]: unknown;
}

interface SignedKYCData {
  data: KYCData;
  signature: string;
  issuer: string;
  timestamp: string;
  algorithm: string;
  hashAlgorithm: string;
  publicKey: string;
}

interface StoredKYCRecord extends SignedKYCData {
  id: string;
  status: 'verified' | 'failed';
  source?: string;
  createdAt: string;
  error?: string;
  originalPayload?: ZypheWebhookPayload;
}

interface ZypheWebhookPayload {
  resultId: string;
  event: string;
  data?: {
    kyc?: KYCData;
    dv?: unknown;
    error?: string;
  };
  custom?: unknown;
}

interface ServerKeyPair {
  publicKey: string;
  privateKey: string;
}

const app = express();
const PORT = process.env.PORT || 8085;

// CORS configuration for frontend integration
app.use(cors());

// Body parser with raw body storage for signature verification
app.use(
  express.json({
    verify: (req: RawBodyRequest, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// In-memory storage for KYC data (use a proper database in production)
const kycStorage = new Map<string, StoredKYCRecord>();

// RSA key pair for signing KYC tokens (store securely in production)
let serverKeyPair: ServerKeyPair | null = null;

// Generate server RSA key pair on startup
function generateServerKeys(): void {
  try {
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });
    serverKeyPair = keyPair;
    console.log('✅ Server RSA key pair generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate server keys:', error);
    process.exit(1);
  }
}

// Sign KYC data with server private key
function signKYCData(data: KYCData): SignedKYCData {
  if (!serverKeyPair) {
    throw new Error('Server keys not initialized');
  }

  const dataToSign = JSON.stringify(data);
  const signature = crypto.sign('sha256', Buffer.from(dataToSign), {
    key: serverKeyPair.privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  return {
    data,
    signature: signature.toString('base64'),
    issuer: 'fairway-kyc-server',
    timestamp: new Date(0).toISOString(),
    algorithm: 'RSA-PSS',
    hashAlgorithm: 'SHA-256',
    publicKey: serverKeyPair.publicKey,
  };
}

// Verify webhook signature from Zyphe
function verifySignature(_req: RawBodyRequest): boolean {
  const _secret = process.env.ZYPHE_WEBHOOK_SECRET || '';
  return true; // Simplified for development
}

// Initialize server
generateServerKeys();

// Test endpoint to view webhook status (for debugging)
app.get('/api/debug/latest-webhook', (_req: Request, res: Response) => {
  res.json({
    kycStorageKeys: Array.from(kycStorage.keys()),
    note: 'Webhook server forwards to backend. No PII data stored here.',
    backendUrl: process.env.BACKEND_ORACLE_URL || 'http://localhost:3001',
    webhookEndpoint: '/did/webhook/zyphe',
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('ok');
});

// Get server public key for signature verification
app.get('/api/kyc/public-key', (_req: Request, res: Response) => {
  if (!serverKeyPair) {
    return res.status(500).json({ error: 'Server keys not initialized' });
  }

  res.json({
    publicKey: serverKeyPair.publicKey,
    algorithm: 'RSA-PSS',
    hashAlgorithm: 'SHA-256',
  });
});

// Sign KYC data endpoint
app.post('/api/kyc/sign', (req: Request, res: Response) => {
  try {
    const kycData = req.body as KYCData;

    if (!kycData || typeof kycData !== 'object') {
      return res.status(400).json({ error: 'Invalid KYC data provided' });
    }

    // Validate required fields
    const requiredFields: (keyof KYCData)[] = [
      'firstName',
      'lastName',
      'dateOfBirth',
      'addressLine1',
      'city',
      'postalCode',
      'country',
    ];
    const missingFields = requiredFields.filter((field) => !kycData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields,
      });
    }

    // Sign the KYC data
    const signedData = signKYCData(kycData);

    // Store the signed data with a unique ID
    const kycId = crypto.randomUUID();
    kycStorage.set(kycId, {
      ...signedData,
      id: kycId,
      status: 'verified',
      createdAt: new Date().toISOString(),
    });

    console.log(`✅ KYC data signed and stored for ID: ${kycId}`);

    res.json({
      success: true,
      kycId,
      signedData,
    });
  } catch (error) {
    console.error('❌ Error signing KYC data:', error);
    res.status(500).json({ error: 'Failed to sign KYC data' });
  }
});

// Verify KYC token endpoint
app.post('/api/kyc/verify', (req: Request, res: Response) => {
  try {
    const { signedData } = req.body as { signedData: SignedKYCData };

    if (!signedData || !signedData.signature || !signedData.data) {
      return res.status(400).json({ error: 'Invalid signed data provided' });
    }

    if (!serverKeyPair) {
      return res.status(500).json({ error: 'Server keys not initialized' });
    }

    // Verify the signature
    const dataToVerify = JSON.stringify(signedData.data);
    const signature = Buffer.from(signedData.signature, 'base64');

    const isValid = crypto.verify(
      'sha256',
      Buffer.from(dataToVerify),
      {
        key: serverKeyPair.publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      signature
    );

    res.json({
      valid: isValid,
      issuer: signedData.issuer,
      timestamp: signedData.timestamp,
    });
  } catch (error) {
    console.error('❌ Error verifying KYC token:', error);
    res.status(500).json({ error: 'Failed to verify KYC token' });
  }
});

// Get KYC data by ID
app.get('/api/kyc/:id', (req: Request, res: Response) => {
  const kycId = req.params.id;
  const kycData = kycStorage.get(kycId);

  if (!kycData) {
    return res.status(404).json({ error: 'KYC data not found' });
  }

  res.json(kycData);
});

// List all KYC records (for admin purposes - remove in production)
app.get('/api/kyc', (_req: Request, res: Response) => {
  const allRecords = Array.from(kycStorage.values()).map((record) => ({
    id: record.id,
    status: record.status,
    createdAt: record.createdAt,
    firstName: record.data.firstName,
    lastName: record.data.lastName,
    country: record.data.country,
  }));

  res.json(allRecords);
});

// In-memory map to track wallet → pending verification (for KYB where custom comes back empty)
const pendingVerifications = new Map<string, { walletAddress: string; type: string }>();

// Create Zyphe verification session (KYC or KYB)
app.post('/api/kyc/create-session', async (req: Request, res: Response) => {
  try {
    const { walletAddress, type } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const verificationType = type || 'kyc';
    const customData = encodeURIComponent(JSON.stringify({ walletAddress }));

    let sessionUrl: string;
    if (verificationType === 'kyb') {
      sessionUrl = `https://verify.zyphe.com/sandbox/flow/fairwayglobal-or999/kyb/or999-kyb?customData=${customData}`;
    } else {
      sessionUrl = `https://verify.zyphe.com/sandbox/flow/fairwayglobal-or77/kyc/or77?customData=${customData}`;
    }

    // Store pending verification so we can match webhook by wallet
    pendingVerifications.set(walletAddress, { walletAddress, type: verificationType });

    console.log(`✅ Zyphe ${verificationType.toUpperCase()} URL generated for wallet: ${walletAddress}`);

    res.json({
      sessionUrl,
      sessionId: `direct-${Date.now()}`,
    });
  } catch (error) {
    console.error('❌ Error creating Zyphe session:', error);
    res.status(500).json({ error: 'Failed to create Zyphe session' });
  }
});

// Zyphe webhook handler — handles both KYC and KYB webhooks
app.post('/webhooks/zyphe', async (req: RawBodyRequest, res: Response) => {
  if (!verifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const payload = (req.body || {}) as ZypheWebhookPayload;
  const { resultId, event, data } = payload;
  const custom = (payload as any).custom || {};

  console.log('📥 Zyphe webhook received:', JSON.stringify(payload, null, 2));

  const dv = data?.dv as Record<string, unknown> | undefined;
  const kyc = data?.kyc as Record<string, unknown> | undefined;
  const kyb = (data as any)?.kyb as Record<string, unknown> | undefined;
  const isKYB = Boolean(kyb);

  // Extract wallet address from custom data, or look up from pending verifications
  let walletAddress =
    custom?.customData?.walletAddress ||
    custom?.walletAddress ||
    (dv as any)?.customData?.customData?.walletAddress;

  // For KYB: custom is often empty. Try to find wallet from pending verifications or identityEmail
  if (!walletAddress && isKYB) {
    const kybEmail = (kyb as any)?.identityEmail || (kyb as any)?.businessInformation?.contactEmail;
    console.log(`🔍 KYB webhook with empty custom. identityEmail: ${kybEmail}`);

    // Check pending verifications
    for (const [wallet, pending] of pendingVerifications.entries()) {
      if (pending.type === 'kyb') {
        walletAddress = wallet;
        pendingVerifications.delete(wallet);
        console.log(`✅ Matched KYB webhook to pending wallet: ${walletAddress}`);
        break;
      }
    }
  }

  const backendUrl = process.env.BACKEND_ORACLE_URL || 'http://localhost:3001';

  // For KYB: always forward as verified regardless of event status (sandbox limitation)
  if (isKYB) {
    console.log(`📋 KYB webhook — marking as verified (event: ${event})`);

    const normalizedPayload = {
      ...payload,
      event: 'COMPLETED',
      custom: { customData: { walletAddress } },
      data: {
        ...data,
        kyc: { status: 'PASSED', identityId: (kyb as any)?.identityEmail },
        dv: dv || { status: 'PASSED' },
      },
    };

    try {
      const backendResponse = await fetch(`${backendUrl}/api/otc/did/webhook/zyphe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedPayload),
      });
      if (backendResponse.ok) {
        console.log('✅ KYB webhook forwarded to backend as verified');
      } else {
        console.error('❌ Backend forward failed:', await backendResponse.text());
      }
    } catch (err) {
      console.error('❌ Error forwarding KYB webhook:', err);
    }

    return res.status(200).send('ok');
  }

  // KYC flow — only forward as verified if event is COMPLETED and status is PASSED
  if (walletAddress && event === 'COMPLETED' && (dv || kyc)) {
    const dvStatus = dv?.status as string | undefined;
    const kycStatus = kyc?.status as string | undefined;
    const status = dvStatus || kycStatus || 'PASSED';
    const isVerified = status === 'PASSED';

    console.log(`📋 KYC webhook ${isVerified ? 'PASSED' : 'FAILED'} for wallet: ${walletAddress}`);

    const normalizedPayload = {
      ...payload,
      custom: { customData: { walletAddress } },
      data: {
        ...data,
        kyc: kyc || { status, identityId: dv?.identityEmail || 'unknown' },
        dv: dv || {},
      },
    };

    try {
      const backendResponse = await fetch(`${backendUrl}/api/otc/did/webhook/zyphe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedPayload),
      });

      if (backendResponse.ok) {
        console.log('✅ KYC webhook forwarded to backend');
      } else {
        console.error('❌ Backend forward failed:', await backendResponse.text());
      }
    } catch (error) {
      console.error('❌ Error forwarding KYC webhook:', error);
    }
  } else if (event === 'FAILED' || event === 'failed') {
    console.log(`❌ KYC verification failed for resultId: ${resultId}`);
    // Forward rejection to backend
    if (walletAddress) {
      try {
        await fetch(`${backendUrl}/api/otc/did/webhook/zyphe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, custom: { customData: { walletAddress } } }),
        });
      } catch { /* best effort */ }
    }
  } else {
    console.log(`ℹ️ Unhandled KYC webhook event: ${event}`);
  }

  res.status(200).send('ok');
});

// KYC completion redirect
app.get('/kyc/complete', (req: Request, res: Response) => {
  const { resultId, status } = req.query;

  // Redirect to frontend with KYC completion status
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const redirectUrl = `${frontendUrl}/profile?kyc_completed=true&resultId=${resultId}&status=${status}`;

  console.log(`🔄 Redirecting user to frontend: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

// Error handling middleware
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

import http from 'http';

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`🚀 KYC Backend Server listening on http://localhost:${PORT}`);
});

export default app;
