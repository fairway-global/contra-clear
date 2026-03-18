import { API_BASE } from './constants';

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface ChannelBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface Client {
  id: string;
  walletAddress: string;
  label: string;
  createdAt: string;
}

export interface RFQ {
  id: string;
  creator: string;
  sellToken: string;
  sellAmount: string;
  buyToken: string;
  side: 'sell' | 'buy';
  status: string;
  createdAt: string;
  expiresAt: string;
  quotes?: Quote[];
}

export interface Quote {
  id: string;
  rfqId: string;
  quoter: string;
  price: string;
  amount: string;
  buyAmount: string;
  status: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  rfqId: string;
  quoteId: string;
  partyA: string;
  partyB: string;
  sellToken: string;
  sellAmount: string;
  buyToken: string;
  buyAmount: string;
  price: string;
  status: string;
  legASig: string | null;
  legBSig: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DepositRecord {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: string;
  txSignature: string;
  status: string;
  createdAt: string;
}

export interface WithdrawalRecord {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: string;
  channelTxSignature: string | null;
  status: string;
  createdAt: string;
}

export interface AdminOverview {
  clients: number;
  deposits: number;
  activeRFQs: number;
  completedTrades: number;
  totalTrades: number;
  withdrawals: number;
  contraSlot: number;
}

// Import auth token getter dynamically to avoid circular deps
function getToken(): string | null {
  try {
    // Access the module-level variable from useAuth
    const mod = (window as any).__authToken;
    return mod || null;
  } catch { return null; }
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function post<T>(url: string, body: object): Promise<T> {
  return fetchJSON(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Client API
export const registerClient = (walletAddress: string, label = '') =>
  post<Client>(`${API_BASE}/clients/register`, { walletAddress, label });

export const getClients = () =>
  fetchJSON<Client[]>(`${API_BASE}/clients`);

// Balance API
export const getBalances = (walletAddress: string) =>
  fetchJSON<{ channel: ChannelBalance[]; onChain: ChannelBalance[] }>(`${API_BASE}/balances/${walletAddress}`);

export const getChannelBalances = (walletAddress: string) =>
  fetchJSON<{ balances: ChannelBalance[] }>(`${API_BASE}/balances/channel/${walletAddress}`);

// Deposit API
export const buildDepositTx = (walletAddress: string, tokenMint: string, amount: string) =>
  post<{ transaction: string; message: string }>(`${API_BASE}/deposit`, { walletAddress, tokenMint, amount });

export const confirmDeposit = (walletAddress: string, tokenMint: string, amount: string, txSignature: string) =>
  post<DepositRecord>(`${API_BASE}/deposit/confirm`, { walletAddress, tokenMint, amount, txSignature });

export const getDepositStatus = (txSig: string) =>
  fetchJSON<DepositRecord>(`${API_BASE}/deposit/status/${txSig}`);

// RFQ API
export const createRFQ = (creator: string, sellToken: string, sellAmount: string, buyToken: string, side = 'sell') =>
  post<RFQ>(`${API_BASE}/rfq/create`, { creator, sellToken, sellAmount, buyToken, side });

export const getActiveRFQs = () =>
  fetchJSON<RFQ[]>(`${API_BASE}/rfq/active`);

export const getRFQ = (id: string) =>
  fetchJSON<RFQ & { quotes: Quote[] }>(`${API_BASE}/rfq/${id}`);

export const submitQuote = (rfqId: string, quoter: string, price: string, amount: string) =>
  post<Quote>(`${API_BASE}/rfq/${rfqId}/quote`, { quoter, price, amount });

export const acceptQuote = (rfqId: string, quoteId: string) =>
  post<{
    trade: Trade;
    settled: boolean;
    transactions?: {
      legA: { transaction: string; signer: string; description: string };
      legB: { transaction: string; signer: string; description: string };
    };
  }>(`${API_BASE}/rfq/${rfqId}/accept`, { quoteId });

export const submitTradeLeg = (rfqId: string, tradeId: string, leg: 'A' | 'B', signedTransaction: string) =>
  post<Trade>(`${API_BASE}/rfq/${rfqId}/trade/${tradeId}/submit`, { leg, signedTransaction });

export const rejectQuote = (rfqId: string, quoteId: string) =>
  post<{ success: boolean }>(`${API_BASE}/rfq/${rfqId}/quote/${quoteId}/reject`, {});

export const cancelRFQ = (rfqId: string) =>
  post<{ success: boolean }>(`${API_BASE}/rfq/${rfqId}/cancel`, {});

// Trade API
export const getAllTrades = (limit = 50) =>
  fetchJSON<Trade[]>(`${API_BASE}/trades?limit=${limit}`);

export const getWalletTrades = (walletAddress: string, limit = 50) =>
  fetchJSON<Trade[]>(`${API_BASE}/trades/wallet/${walletAddress}?limit=${limit}`);

export interface PendingTrade extends Trade {
  myLeg: 'A' | 'B';
  myTx: string;
}

export const getPendingTrades = (walletAddress: string) =>
  fetchJSON<PendingTrade[]>(`${API_BASE}/trades/pending/${walletAddress}`);

// Withdrawal API
export const buildWithdrawTx = (walletAddress: string, tokenMint: string, amount: string) =>
  post<{ withdrawalId: string; transaction: string; message: string }>(`${API_BASE}/withdraw`, { walletAddress, tokenMint, amount });

export const confirmWithdrawal = (withdrawalId: string, txSignature: string) =>
  post<WithdrawalRecord>(`${API_BASE}/withdraw/confirm`, { withdrawalId, txSignature });

export const getWithdrawalStatus = (id: string) =>
  fetchJSON<WithdrawalRecord>(`${API_BASE}/withdraw/status/${id}`);

// Admin API
export const getAdminOverview = () =>
  fetchJSON<AdminOverview>(`${API_BASE}/admin/overview`);

export const getAdminTrades = () =>
  fetchJSON<any[]>(`${API_BASE}/admin/trades`);

export const getAdminDeposits = () =>
  fetchJSON<any[]>(`${API_BASE}/admin/deposits`);

export const getAdminWithdrawals = () =>
  fetchJSON<any[]>(`${API_BASE}/admin/withdrawals`);

// Health
export const getHealth = () =>
  fetchJSON<{ status: string; contraSlot: number }>('/health');
