import type { TokenInfo } from './api';

export const API_BASE = '/api';

export const CONTRA_GATEWAY_URL =
  import.meta.env.VITE_CONTRA_GATEWAY_URL || 'http://localhost:8899';

export const SOLANA_VALIDATOR_URL =
  import.meta.env.VITE_SOLANA_VALIDATOR_URL || 'http://localhost:18899';


export const ESCROW_PROGRAM_ID = 'GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83';
export const WITHDRAW_PROGRAM_ID = 'J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi';

// Demo token registry — updated by setup script
export const DEMO_TOKENS: TokenInfo[] = [
  {
    mint: '', // Set after running setup-demo.sh
    symbol: 'USDX',
    name: 'Demo USDX',
    decimals: 6,
  },
  {
    mint: '', // Set after running setup-demo.sh
    symbol: 'wSOL',
    name: 'Wrapped SOL',
    decimals: 9,
  },
];

// Load token mints from env if available
const envMints = (import.meta.env.VITE_DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);
if (envMints.length >= 1 && DEMO_TOKENS[0]) DEMO_TOKENS[0].mint = envMints[0];
if (envMints.length >= 2 && DEMO_TOKENS[1]) DEMO_TOKENS[1].mint = envMints[1];

export function getTokenInfo(mint: string): TokenInfo | undefined {
  return DEMO_TOKENS.find(t => t.mint === mint);
}

export function getTokenSymbol(mint: string): string {
  return getTokenInfo(mint)?.symbol || truncateAddress(mint);
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

// Convert human amount (e.g. "1.5") to raw units string based on token decimals
export function toRawAmount(humanAmount: string, mint: string): string {
  const token = getTokenInfo(mint);
  if (!token) return humanAmount;
  const num = parseFloat(humanAmount);
  if (isNaN(num)) return '0';
  return Math.floor(num * Math.pow(10, token.decimals)).toString();
}

// Convert raw amount string to human-readable number
export function toHumanAmount(rawAmount: string, mint: string): number {
  const token = getTokenInfo(mint);
  if (!token) return parseFloat(rawAmount);
  return parseFloat(rawAmount) / Math.pow(10, token.decimals);
}

// Format raw amount to display string with token symbol
export function formatRawAmount(rawAmount: string, mint: string): string {
  const token = getTokenInfo(mint);
  if (!token) return rawAmount;
  const human = parseFloat(rawAmount) / Math.pow(10, token.decimals);
  return formatUiAmount(human);
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  // SQLite dates lack timezone — treat as UTC by appending Z if needed
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
