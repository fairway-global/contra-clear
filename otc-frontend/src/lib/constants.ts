import type { ChannelBalance, TokenInfo } from './api';

export const API_BASE = '/api';

export const CONTRA_GATEWAY_URL = import.meta.env.VITE_CONTRA_GATEWAY_URL || 'http://localhost:8899';
export const SOLANA_VALIDATOR_URL = import.meta.env.VITE_SOLANA_VALIDATOR_URL || 'http://localhost:18899';

export const ESCROW_PROGRAM_ID = 'GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83';
export const WITHDRAW_PROGRAM_ID = 'J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi';

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
};

const TOKEN_REGISTRY = new Map<string, TokenInfo>();

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

  TOKEN_REGISTRY.set(token.mint, next);
  return next;
}

export function registerBalanceTokens(balances: ChannelBalance[]): void {
  balances.forEach((balance) => {
    registerTokenInfo({
      mint: balance.mint,
      decimals: balance.decimals,
    });
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
  return Array.from(new Set(mints.filter(Boolean))).map((mint) => registerTokenInfo({ mint }));
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
