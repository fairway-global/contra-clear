export interface Client {
  id: string;
  walletAddress: string;
  label: string;
  createdAt: string;
}

export interface DepositRecord {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: string;
  txSignature: string;
  status: 'pending' | 'confirming' | 'credited' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRecord {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: string;
  channelTxSignature: string | null;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface RFQ {
  id: string;
  creator: string;
  sellToken: string;
  sellAmount: string;
  buyToken: string;
  side: 'sell' | 'buy';
  status: 'active' | 'quoted' | 'accepted' | 'filled' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface Quote {
  id: string;
  rfqId: string;
  quoter: string;
  price: string;
  amount: string;
  buyAmount: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
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
  status: 'pending_signatures' | 'executing' | 'completed' | 'failed';
  legASig: string | null;
  legBSig: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ChannelBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}
