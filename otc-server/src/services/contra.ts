import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { ChannelBalance } from '../types.js';

// Contra gateway (channel operations)
const GATEWAY_URL = process.env.CONTRA_GATEWAY_URL || 'http://localhost:8899';
// Local validator (mainnet-equivalent for deposits/withdrawals)
const VALIDATOR_URL = process.env.SOLANA_VALIDATOR_URL || 'http://localhost:18899';

export function getGatewayConnection(): Connection {
  return new Connection(GATEWAY_URL, 'confirmed');
}

export function getValidatorConnection(): Connection {
  return new Connection(VALIDATOR_URL, 'confirmed');
}

async function rpcCall(url: string, method: string, params: any[] = []): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message || `RPC error: ${method}`);
  }
  return json.result;
}

export async function getChannelBalance(walletAddress: string, mint: string): Promise<ChannelBalance | null> {
  try {
    const owner = new PublicKey(walletAddress);
    const mintPk = new PublicKey(mint);
    const ata = await getAssociatedTokenAddress(mintPk, owner, false, TOKEN_PROGRAM_ID);
    const result = await rpcCall(GATEWAY_URL, 'getTokenAccountBalance', [ata.toString()]);
    if (result?.value) {
      return {
        mint,
        amount: result.value.amount,
        decimals: result.value.decimals,
        uiAmount: parseFloat(result.value.uiAmountString || '0'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getChannelBalances(walletAddress: string, mints: string[]): Promise<ChannelBalance[]> {
  const results = await Promise.all(mints.map(mint => getChannelBalance(walletAddress, mint)));
  return results.filter((b): b is ChannelBalance => b !== null);
}

export async function getOnChainBalance(walletAddress: string, mint: string): Promise<ChannelBalance | null> {
  try {
    const owner = new PublicKey(walletAddress);
    const mintPk = new PublicKey(mint);
    const ata = await getAssociatedTokenAddress(mintPk, owner, false, TOKEN_PROGRAM_ID);
    const result = await rpcCall(VALIDATOR_URL, 'getTokenAccountBalance', [ata.toString()]);
    if (result?.value) {
      return {
        mint,
        amount: result.value.amount,
        decimals: result.value.decimals,
        uiAmount: parseFloat(result.value.uiAmountString || '0'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getLatestBlockhash(url: string = GATEWAY_URL): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = await rpcCall(url, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
  return result.value;
}

export async function sendRawTransaction(url: string, rawTx: string): Promise<string> {
  const result = await rpcCall(url, 'sendTransaction', [rawTx]);
  return result;
}

export async function getTransactionStatus(url: string, signature: string): Promise<any> {
  return rpcCall(url, 'getTransaction', [signature, { encoding: 'json' }]);
}

export async function checkTransactionConfirmed(url: string, signature: string, maxRetries = 30, intervalMs = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await getTransactionStatus(url, signature);
      if (result) return true;
    } catch {
      // not found yet
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

export async function getSlot(): Promise<number> {
  return rpcCall(GATEWAY_URL, 'getSlot');
}

export async function getAccountInfo(url: string, pubkey: string): Promise<any> {
  return rpcCall(url, 'getAccountInfo', [pubkey, { encoding: 'base64' }]);
}

export { GATEWAY_URL, VALIDATOR_URL };
