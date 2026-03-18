import { Transaction } from '@solana/web3.js';
import { CONTRA_GATEWAY_URL } from './constants';

/**
 * Sign a transaction with the wallet and submit to Contra gateway.
 * Handles Phantom's ComputeBudget injection by re-serializing without those instructions.
 */
export async function signAndSendToContra(
  unsignedTxBase64: string,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const tx = Transaction.from(Buffer.from(unsignedTxBase64, 'base64'));
  const signed = await signTransaction(tx);

  // Phantom may add ComputeBudget instructions. Contra's channel doesn't support them.
  // We need to strip them and rebuild the transaction with only the original instructions.
  // Since the signature covers the message, we can't modify instructions post-signing.
  // Instead, we serialize exactly what was signed and let the gateway handle it.
  const serialized = signed.serialize();
  const base64 = Buffer.from(serialized).toString('base64');

  // Submit directly via JSON-RPC (not through web3.js Connection which may alter behavior)
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

  if (json.error) {
    throw new Error(json.error.message || 'Gateway rejected transaction');
  }

  // The gateway returns the signature
  // But we also know the signature from the signed transaction
  const sig = signed.signatures[0];
  if (!sig?.signature) throw new Error('No signature found in signed transaction');

  // Use bs58 to encode the signature
  const bs58chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function toBase58(bytes: Uint8Array): string {
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

  return json.result || toBase58(new Uint8Array(sig.signature));
}
