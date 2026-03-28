import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { CONTRA_GATEWAY_URL } from './constants';

/**
 * Sign a transaction with the wallet and submit to Contra gateway.
 * Supports both legacy Transaction and VersionedTransaction (v0).
 */
export async function signAndSendToContra(
  unsignedTxBase64: string,
  signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
): Promise<string> {
  const txBytes = Buffer.from(unsignedTxBase64, 'base64');

  // Detect if it's a versioned transaction (first byte is a version prefix)
  // VersionedTransaction: first byte has high bit set or is 0x80
  // Legacy Transaction: first byte is the number of signatures
  let signed: Transaction | VersionedTransaction;
  let isVersioned = false;

  try {
    // Try VersionedTransaction first
    const vtx = VersionedTransaction.deserialize(txBytes);
    signed = await signTransaction(vtx);
    isVersioned = true;
  } catch {
    // Fall back to legacy Transaction
    const tx = Transaction.from(txBytes);
    signed = await signTransaction(tx) as Transaction;
  }

  const serialized = signed.serialize();
  const base64 = Buffer.from(serialized).toString('base64');

  // Submit to Contra gateway via JSON-RPC
  const response = await fetch(CONTRA_GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [base64, { skipPreflight: true, encoding: 'base64' }],
    }),
  });

  const json = await response.json();

  console.log('Contra gateway response:', JSON.stringify(json));

  if (json.error) {
    console.error('Gateway error:', JSON.stringify(json.error));
    throw new Error(json.error.message || 'Gateway rejected transaction');
  }

  // Extract signature
  if (json.result) {
    return json.result;
  }

  // Fallback: extract signature from the signed transaction
  if (isVersioned) {
    const vtx = signed as VersionedTransaction;
    if (vtx.signatures[0]) {
      return toBase58(vtx.signatures[0]);
    }
  } else {
    const tx = signed as Transaction;
    const sig = tx.signatures[0];
    if (sig?.signature) {
      return toBase58(new Uint8Array(sig.signature));
    }
  }

  throw new Error('No signature found in signed transaction');
}

/**
 * Partially sign an atomic swap transaction (do NOT submit to Contra).
 * The wallet signs its own slot in the VersionedTransaction.
 * Returns the FULL signed transaction as base64 so the backend can extract
 * the exact signature bytes without any browser Buffer encoding issues.
 */
export async function partialSignForContra(
  unsignedTxBase64: string,
  walletPublicKey: string,
  signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
): Promise<string> {
  const txBytes = Buffer.from(unsignedTxBase64, 'base64');

  // Atomic swap txs are always VersionedTransaction (v0)
  const vtx = VersionedTransaction.deserialize(txBytes);
  const signed = await signTransaction(vtx) as VersionedTransaction;

  // Verify the wallet actually signed
  const accountKeys = signed.message.staticAccountKeys;
  const numSigners = signed.message.header.numRequiredSignatures;

  let signerIndex = -1;
  for (let i = 0; i < numSigners; i++) {
    if (accountKeys[i].toBase58() === walletPublicKey) {
      signerIndex = i;
      break;
    }
  }

  if (signerIndex === -1) {
    throw new Error('Connected wallet is not a required signer for this transaction');
  }

  const sigBytes = signed.signatures[signerIndex];
  if (!sigBytes || sigBytes.every(b => b === 0)) {
    throw new Error('Wallet did not produce a signature');
  }

  // Return the full signed transaction as base64 — backend extracts the signature
  return Buffer.from(signed.serialize()).toString('base64');
}

function toBase58(bytes: Uint8Array): string {
  const bs58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) str += '1';
  for (let i = digits.length - 1; i >= 0; i--) str += bs58chars[digits[i]];
  return str;
}
