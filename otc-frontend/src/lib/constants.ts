import type { ChannelBalance, TokenInfo } from './api';

export const API_BASE = '/api';

const _gatewayUrl = import.meta.env.VITE_CONTRA_GATEWAY_URL;
const _validatorUrl = import.meta.env.VITE_SOLANA_VALIDATOR_URL;

if (!_gatewayUrl) throw new Error('VITE_CONTRA_GATEWAY_URL is not set. Check your .env file.');
if (!_validatorUrl) throw new Error('VITE_SOLANA_VALIDATOR_URL is not set. Check your .env file.');

export const CONTRA_GATEWAY_URL: string = _gatewayUrl;
export const SOLANA_VALIDATOR_URL: string = _validatorUrl;

export const ESCROW_PROGRAM_ID = 'GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83';
export const WITHDRAW_PROGRAM_ID = 'J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi';
const JUPITER_TOKEN_SEARCH_URL = 'https://lite-api.jup.ag/tokens/v2/search';

const KNOWN_TOKEN_OVERRIDES: Record<string, TokenInfo> = {
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': {
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    decimals: 6,
  },
  'So11111111111111111111111111111111111111112': {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'wSOL',
    name: 'Wrapped SOL',
    decimals: 9,
  },
  'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr': {
    mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
    symbol: 'EURC',
    name: 'Euro Coin',
    decimals: 6,
  },
};

const TOKEN_REGISTRY = new Map<string, TokenInfo>();
const TOKEN_REGISTRY_LISTENERS = new Set<() => void>();
const TOKEN_LOOKUP_PROMISES = new Map<string, Promise<TokenInfo | null>>();

function createFallbackTokenInfo(mint: string, decimals = 6): TokenInfo {
  return {
    mint,
    symbol: truncateAddress(mint),
    name: `SPL Token ${truncateAddress(mint, 6)}`,
    decimals,
  };
}

function seedRegistry() {
  Object.values(KNOWN_TOKEN_OVERRIDES).forEach(token => {
    TOKEN_REGISTRY.set(token.mint, token);
  });

  const envMints = (import.meta.env.VITE_DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);
  envMints.forEach((mint: string) => registerTokenInfo({ mint }));
}

seedRegistry();

function notifyTokenRegistryListeners(): void {
  TOKEN_REGISTRY_LISTENERS.forEach((listener) => listener());
}

function isResolvedTokenInfo(token: TokenInfo | undefined): boolean {
  if (!token) {
    return false;
  }

  return token.symbol !== truncateAddress(token.mint) && token.name !== `SPL Token ${truncateAddress(token.mint, 6)}`;
}

async function fetchRemoteTokenInfo(mint: string): Promise<TokenInfo | null> {
  try {
    const response = await fetch(`${JUPITER_TOKEN_SEARCH_URL}?query=${encodeURIComponent(mint)}`);
    if (!response.ok) {
      return null;
    }

    const results = await response.json() as Array<{
      id?: string;
      name?: string;
      symbol?: string;
      decimals?: number;
    }>;
    const match = results.find((item) => item.id === mint);
    if (!match || !match.symbol || !match.name) {
      return null;
    }

    return registerTokenInfo({
      mint,
      symbol: match.symbol,
      name: match.name,
      decimals: match.decimals,
    });
  } catch {
    return null;
  }
}

function ensureRemoteTokenInfo(mint: string): Promise<TokenInfo | null> {
  const existing = TOKEN_REGISTRY.get(mint);
  if (isResolvedTokenInfo(existing)) {
    return Promise.resolve(existing || null);
  }

  const inFlight = TOKEN_LOOKUP_PROMISES.get(mint);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchRemoteTokenInfo(mint).finally(() => {
    TOKEN_LOOKUP_PROMISES.delete(mint);
  });
  TOKEN_LOOKUP_PROMISES.set(mint, request);
  return request;
}

export function registerTokenInfo(token: Partial<TokenInfo> & { mint: string }): TokenInfo {
  const known = KNOWN_TOKEN_OVERRIDES[token.mint];
  const existing = TOKEN_REGISTRY.get(token.mint);
  const fallback = createFallbackTokenInfo(token.mint, token.decimals ?? known?.decimals ?? existing?.decimals ?? 6);

  const next: TokenInfo = {
    mint: token.mint,
    symbol: token.symbol || existing?.symbol || known?.symbol || fallback.symbol,
    name: token.name || existing?.name || known?.name || fallback.name,
    decimals: token.decimals ?? existing?.decimals ?? known?.decimals ?? fallback.decimals,
  };

  const changed =
    !existing ||
    existing.symbol !== next.symbol ||
    existing.name !== next.name ||
    existing.decimals !== next.decimals;

  TOKEN_REGISTRY.set(token.mint, next);
  if (changed) {
    notifyTokenRegistryListeners();
  }
  return next;
}

export function registerBalanceTokens(balances: ChannelBalance[]): void {
  balances.forEach((balance) => {
    registerTokenInfo({
      mint: balance.mint,
      decimals: balance.decimals,
    });
    void ensureRemoteTokenInfo(balance.mint);
  });
}

export function getAllKnownTokens(): TokenInfo[] {
  return Array.from(TOKEN_REGISTRY.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function getTokenInfo(mint: string): TokenInfo | undefined {
  return TOKEN_REGISTRY.get(mint);
}

export function getTokenSymbol(mint: string): string {
  return getTokenInfo(mint)?.symbol || truncateAddress(mint);
}

export function getTokenName(mint: string): string {
  return getTokenInfo(mint)?.name || `SPL Token ${truncateAddress(mint, 6)}`;
}

export function getTokensForMints(mints: string[]): TokenInfo[] {
  return Array.from(new Set(mints.filter(Boolean))).map((mint) => {
    const token = registerTokenInfo({ mint });
    void ensureRemoteTokenInfo(mint);
    return token;
  });
}

export function subscribeTokenRegistry(listener: () => void): () => void {
  TOKEN_REGISTRY_LISTENERS.add(listener);
  return () => {
    TOKEN_REGISTRY_LISTENERS.delete(listener);
  };
}

export function truncateAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function formatAmount(amount: string | number, decimals: number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const adjusted = num / Math.pow(10, decimals);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.min(decimals, 6),
  }).format(adjusted);
}

export function formatUiAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
}

export function toRawAmount(humanAmount: string, mint: string): string {
  const token = getTokenInfo(mint);
  if (!token) return humanAmount;
  const num = parseFloat(humanAmount);
  if (isNaN(num)) return '0';
  return Math.floor(num * Math.pow(10, token.decimals)).toString();
}

export function toHumanAmount(rawAmount: string, mint: string): number {
  const token = getTokenInfo(mint);
  if (!token) return parseFloat(rawAmount);
  return parseFloat(rawAmount) / Math.pow(10, token.decimals);
}

export function formatRawAmount(rawAmount: string, mint: string): string {
  const token = getTokenInfo(mint);
  if (!token) return rawAmount;
  const human = parseFloat(rawAmount) / Math.pow(10, token.decimals);
  return formatUiAmount(human);
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T')
    ? dateStr
    : dateStr.replace(' ', 'T') + 'Z';
  const then = new Date(normalized).getTime();
  const diff = now - then;

  if (isNaN(diff) || diff < 0) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
