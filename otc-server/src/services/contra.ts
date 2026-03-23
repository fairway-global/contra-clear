import { Connection } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { ChannelBalance } from '../types.js';

// Contra gateway (channel operations) — MUST be set via .env
if (!process.env.CONTRA_GATEWAY_URL) throw new Error('CONTRA_GATEWAY_URL is not set. Check your .env file.');
const GATEWAY_URL: string = process.env.CONTRA_GATEWAY_URL;

// Source-chain Solana RPC (deposits/withdrawals) — MUST be set via .env
if (!process.env.SOLANA_VALIDATOR_URL) throw new Error('SOLANA_VALIDATOR_URL is not set. Check your .env file.');
const VALIDATOR_URL: string = process.env.SOLANA_VALIDATOR_URL;

export function getGatewayConnection(): Connection {
  return new Connection(GATEWAY_URL, 'confirmed');
}

export function getValidatorConnection(): Connection {
  return new Connection(VALIDATOR_URL, 'confirmed');
}

const mintDecimalsCache = new Map<string, number>();

async function rpcCall(url: string, method: string, params: any[] = []): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
  } catch (err: any) {
    throw new Error(`Cannot reach RPC ${url} for ${method}: ${err?.message || 'fetch failed'}`);
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Invalid RPC response from ${url} for ${method}: HTTP ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(json?.error?.message || `RPC ${method} failed at ${url}: HTTP ${response.status}`);
  }

  if (json.error) {
    throw new Error(json.error.message || `RPC error at ${url}: ${method}`);
  }
  return json.result;
}

export async function getChannelBalance(walletAddress: string, mint: string): Promise<ChannelBalance | null> {
  try {
    // Use direct ATA balance check — gateway doesn't support getTokenAccountsByOwner
    const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
    const { PublicKey } = await import('@solana/web3.js');
    const ata = await getAssociatedTokenAddress(new PublicKey(mint), new PublicKey(walletAddress), false, TOKEN_PROGRAM_ID);
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

export async function getChannelBalances(walletAddress: string, mints?: string[]): Promise<ChannelBalance[]> {
  // Gateway doesn't support getTokenAccountsByOwner, so we must check known mints individually
  const mintsToCheck = mints?.length ? mints : DEMO_MINTS;
  if (!mintsToCheck.length) return [];
  const results = await Promise.all(mintsToCheck.map(mint => getChannelBalance(walletAddress, mint)));
  return results.filter((b): b is ChannelBalance => b !== null);
}

// Known token mints from env
const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);

export async function getOnChainBalance(walletAddress: string, mint: string): Promise<ChannelBalance | null> {
  try {
    const balances = await getOwnedTokenBalances(VALIDATOR_URL, walletAddress, { mint });
    return balances.find(balance => balance.mint === mint) || null;
  } catch {
    return null;
  }
}

export async function getOnChainBalances(walletAddress: string, mints?: string[]): Promise<ChannelBalance[]> {
  if (mints?.length) {
    const balances = await Promise.all(mints.map(mint => getOnChainBalance(walletAddress, mint)));
    return balances.filter((b): b is ChannelBalance => b !== null);
  }

  return getOwnedTokenBalances(VALIDATOR_URL, walletAddress);
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
  const result = await rpcCall(url, 'getAccountInfo', [pubkey, { encoding: 'base64' }]);
  return result?.value ?? null;
}

export async function getMintDecimals(mint: string, url: string = VALIDATOR_URL): Promise<number> {
  const cached = mintDecimalsCache.get(mint);
  if (cached !== undefined) return cached;

  const result = await rpcCall(url, 'getTokenSupply', [mint]);
  const decimals = Number(result?.value?.decimals ?? 0);
  mintDecimalsCache.set(mint, decimals);
  return decimals;
}

type ParsedTokenBalance = {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
};

function normalizeParsedTokenBalance(balance: ParsedTokenBalance): ChannelBalance {
  return {
    mint: balance.mint,
    amount: balance.amount,
    decimals: balance.decimals,
    uiAmount: balance.uiAmount,
  };
}

function collapseBalances(balances: ParsedTokenBalance[]): ChannelBalance[] {
  const grouped = new Map<string, ChannelBalance>();

  for (const balance of balances) {
    const existing = grouped.get(balance.mint);
    if (!existing) {
      grouped.set(balance.mint, normalizeParsedTokenBalance(balance));
      continue;
    }

    const nextAmount = BigInt(existing.amount) + BigInt(balance.amount);
    existing.amount = nextAmount.toString();
    existing.uiAmount = Number(nextAmount) / Math.pow(10, existing.decimals);
  }

  return Array.from(grouped.values()).sort((a, b) => b.uiAmount - a.uiAmount);
}

async function getOwnedTokenBalances(
  url: string,
  walletAddress: string,
  filter?: { mint?: string }
): Promise<ChannelBalance[]> {
  const filters = filter?.mint
    ? [{ mint: filter.mint }]
    : [
        { programId: TOKEN_PROGRAM_ID.toString() },
        { programId: TOKEN_2022_PROGRAM_ID.toString() },
      ];

  const responses = await Promise.all(filters.map(async (ownerFilter) => {
    try {
      const result = await rpcCall(url, 'getTokenAccountsByOwner', [
        walletAddress,
        ownerFilter,
        { encoding: 'jsonParsed' },
      ]);
      return result?.value || [];
    } catch {
      return [];
    }
  }));

  const balances = responses.flatMap((accounts: any[]) =>
    accounts.flatMap((account) => {
      const parsed = account?.account?.data?.parsed?.info;
      const mint = parsed?.mint as string | undefined;
      const amount = parsed?.tokenAmount?.amount as string | undefined;
      const decimals = Number(parsed?.tokenAmount?.decimals ?? 0);
      const uiAmountString = parsed?.tokenAmount?.uiAmountString as string | undefined;

      if (!mint || !amount || BigInt(amount) <= 0n) return [];

      return [{
        mint,
        amount,
        decimals,
        uiAmount: parseFloat(uiAmountString || '0'),
      }];
    })
  );

  return collapseBalances(balances);
}

export { GATEWAY_URL, VALIDATOR_URL };
