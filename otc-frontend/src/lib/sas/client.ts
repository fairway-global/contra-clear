import {
  fetchAttestation,
  fetchSchema,
  deserializeAttestationData,
  deriveAttestationPda,
} from 'sas-lib';
import { createSolanaClient } from 'gill';
import type { Address } from '@solana/kit';

export interface KYCAttestationData {
  accreditationLevel: string;
  jurisdiction: string;
  complianceTier: number;
  provider: string;
  isAccredited: boolean;
}

export interface SASAttestationResult {
  exists: boolean;
  attestationPda: string;
  data: KYCAttestationData | null;
  signer: string | null;
  expiry: number | null;
  expired: boolean;
}

const client = createSolanaClient({ urlOrMoniker: 'devnet' });

export async function readAttestation(userWallet: string): Promise<SASAttestationResult> {
  const credentialPda = (import.meta as any).env?.VITE_SAS_CREDENTIAL_PDA as Address;
  const schemaPda = (import.meta as any).env?.VITE_SAS_SCHEMA_PDA as Address;

  if (!credentialPda || !schemaPda) {
    return { exists: false, attestationPda: '', data: null, signer: null, expiry: null, expired: false };
  }

  const [attestationPda] = await deriveAttestationPda({
    credential: credentialPda,
    schema: schemaPda,
    nonce: userWallet as Address,
  });

  try {
    const attestation = await fetchAttestation(client.rpc, attestationPda);
    const schema = await fetchSchema(client.rpc, schemaPda);

    const data = deserializeAttestationData<KYCAttestationData>(
      schema.data,
      attestation.data.data as Uint8Array,
    );

    const expiry = Number(attestation.data.expiry);
    const now = Math.floor(Date.now() / 1000);

    return {
      exists: true,
      attestationPda: attestationPda.toString(),
      data,
      signer: attestation.data.signer.toString(),
      expiry,
      expired: expiry > 0 && expiry < now,
    };
  } catch {
    return { exists: false, attestationPda: attestationPda.toString(), data: null, signer: null, expiry: null, expired: false };
  }
}
