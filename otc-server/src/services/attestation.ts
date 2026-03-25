/**
 * SAS Attestation Service — creates on-chain attestations after KYC verification.
 */

import {
  getCreateAttestationInstruction,
  deriveAttestationPda,
  fetchSchema,
  serializeAttestationData,
} from 'sas-lib';
import {
  createSolanaClient,
  createTransaction,
  createKeypairSignerFromBase58,
} from 'gill';
import { getBase58Decoder, type Address } from '@solana/kit';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function calculateTier(jurisdiction: string): number {
  const sanctioned = ['KP', 'IR', 'CU', 'SY', 'RU'];
  if (sanctioned.includes(jurisdiction)) return 1;
  if (['CH', 'SG'].includes(jurisdiction)) return 3;
  return 2;
}

function loadSigner() {
  const secret = process.env.SAS_SIGNER_SECRET;
  if (!secret) throw new Error('SAS_SIGNER_SECRET not configured');
  const bytes = new Uint8Array(JSON.parse(secret));
  const b58 = getBase58Decoder().decode(bytes);
  return createKeypairSignerFromBase58(b58);
}

function loadPayer() {
  const payerPath = process.env.SAS_PAYER_PATH || '~/.config/solana/id.json';
  const resolved = resolve(payerPath.replace('~', process.env.HOME || ''));
  const raw = readFileSync(resolved, 'utf-8');
  const bytes = new Uint8Array(JSON.parse(raw));
  const b58 = getBase58Decoder().decode(bytes);
  return createKeypairSignerFromBase58(b58);
}

export interface AttestationResult {
  attestationPda: string;
  signature: string;
  expiry: number;
}

export async function createSASAttestation(
  walletAddress: string,
  jurisdiction: string,
): Promise<AttestationResult> {
  const credentialPda = process.env.SAS_CREDENTIAL_PDA as Address;
  const schemaPda = process.env.SAS_SCHEMA_PDA as Address;

  if (!credentialPda || !schemaPda) {
    throw new Error('SAS_CREDENTIAL_PDA / SAS_SCHEMA_PDA not configured');
  }

  const client = createSolanaClient({ urlOrMoniker: 'devnet' });
  const payer = await loadPayer();
  const signer = await loadSigner();

  const schema = await fetchSchema(client.rpc, schemaPda);
  const tier = calculateTier(jurisdiction);

  const data = serializeAttestationData(schema.data, {
    accreditationLevel: 'professional',
    jurisdiction,
    complianceTier: tier,
    provider: 'zyphe',
    isAccredited: true,
  });

  const nonce = walletAddress as Address;
  const [attestationPda] = await deriveAttestationPda({
    credential: credentialPda,
    schema: schemaPda,
    nonce,
  });

  const expiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  const ix = getCreateAttestationInstruction({
    payer,
    authority: signer,
    credential: credentialPda,
    schema: schemaPda,
    attestation: attestationPda,
    nonce,
    data,
    expiry,
  });

  const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send();

  const tx = createTransaction({
    version: 'legacy',
    feePayer: payer,
    instructions: [ix],
    latestBlockhash,
    computeUnitLimit: 200_000,
    computeUnitPrice: 1,
  });

  const signature = await client.sendAndConfirmTransaction(tx);

  console.log(`SAS attestation created: ${attestationPda.toString()} tx=${signature}`);

  return {
    attestationPda: attestationPda.toString(),
    signature,
    expiry,
  };
}
