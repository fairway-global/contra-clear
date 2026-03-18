import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import type { Client, DepositRecord, WithdrawalRecord, RFQ, Quote, Trade } from '../types.js';

const DB_PATH = process.env.OTC_DB_PATH || './otc.db';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      amount TEXT NOT NULL,
      tx_signature TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      amount TEXT NOT NULL,
      channel_tx_signature TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rfqs (
      id TEXT PRIMARY KEY,
      creator TEXT NOT NULL,
      sell_token TEXT NOT NULL,
      sell_amount TEXT NOT NULL,
      buy_token TEXT NOT NULL,
      side TEXT NOT NULL DEFAULT 'sell',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      rfq_id TEXT NOT NULL REFERENCES rfqs(id),
      quoter TEXT NOT NULL,
      price TEXT NOT NULL,
      amount TEXT NOT NULL,
      buy_amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      rfq_id TEXT NOT NULL,
      quote_id TEXT NOT NULL,
      party_a TEXT NOT NULL,
      party_b TEXT NOT NULL,
      sell_token TEXT NOT NULL,
      sell_amount TEXT NOT NULL,
      buy_token TEXT NOT NULL,
      buy_amount TEXT NOT NULL,
      price TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_signatures',
      leg_a_sig TEXT,
      leg_b_sig TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);
}

// Client operations
export function registerClient(walletAddress: string, label: string): Client {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM clients WHERE wallet_address = ?').get(walletAddress) as any;
  if (existing) {
    return mapClient(existing);
  }
  const id = uuid();
  d.prepare('INSERT INTO clients (id, wallet_address, label) VALUES (?, ?, ?)').run(id, walletAddress, label);
  return { id, walletAddress, label, createdAt: new Date().toISOString() };
}

export function getClients(): Client[] {
  return getDb().prepare('SELECT * FROM clients ORDER BY created_at DESC').all().map(mapClient);
}

export function getClient(walletAddress: string): Client | null {
  const row = getDb().prepare('SELECT * FROM clients WHERE wallet_address = ?').get(walletAddress) as any;
  return row ? mapClient(row) : null;
}

// Deposit operations
export function createDeposit(walletAddress: string, tokenMint: string, amount: string, txSignature: string): DepositRecord {
  const d = getDb();
  const id = uuid();
  d.prepare('INSERT INTO deposits (id, wallet_address, token_mint, amount, tx_signature, status) VALUES (?, ?, ?, ?, ?, ?)').run(id, walletAddress, tokenMint, amount, txSignature, 'pending');
  return { id, walletAddress, tokenMint, amount, txSignature, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function updateDepositStatus(id: string, status: DepositRecord['status']) {
  getDb().prepare('UPDATE deposits SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);
}

export function getDeposit(id: string): DepositRecord | null {
  const row = getDb().prepare('SELECT * FROM deposits WHERE id = ?').get(id) as any;
  return row ? mapDeposit(row) : null;
}

export function getDepositByTxSig(txSig: string): DepositRecord | null {
  const row = getDb().prepare('SELECT * FROM deposits WHERE tx_signature = ?').get(txSig) as any;
  return row ? mapDeposit(row) : null;
}

export function getDepositsByWallet(walletAddress: string): DepositRecord[] {
  return getDb().prepare('SELECT * FROM deposits WHERE wallet_address = ? ORDER BY created_at DESC').all(walletAddress).map(mapDeposit);
}

// Withdrawal operations
export function createWithdrawal(walletAddress: string, tokenMint: string, amount: string): WithdrawalRecord {
  const d = getDb();
  const id = uuid();
  d.prepare('INSERT INTO withdrawals (id, wallet_address, token_mint, amount, status) VALUES (?, ?, ?, ?, ?)').run(id, walletAddress, tokenMint, amount, 'pending');
  return { id, walletAddress, tokenMint, amount, channelTxSignature: null, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function updateWithdrawal(id: string, updates: Partial<WithdrawalRecord>) {
  const d = getDb();
  if (updates.status) {
    d.prepare('UPDATE withdrawals SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(updates.status, id);
  }
  if (updates.channelTxSignature) {
    d.prepare('UPDATE withdrawals SET channel_tx_signature = ?, updated_at = datetime(\'now\') WHERE id = ?').run(updates.channelTxSignature, id);
  }
}

export function getWithdrawal(id: string): WithdrawalRecord | null {
  const row = getDb().prepare('SELECT * FROM withdrawals WHERE id = ?').get(id) as any;
  return row ? mapWithdrawal(row) : null;
}

// RFQ operations
export function createRFQ(creator: string, sellToken: string, sellAmount: string, buyToken: string, side: 'sell' | 'buy'): RFQ {
  const d = getDb();
  const id = uuid();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min expiry
  d.prepare('INSERT INTO rfqs (id, creator, sell_token, sell_amount, buy_token, side, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, creator, sellToken, sellAmount, buyToken, side, expiresAt);
  return { id, creator, sellToken, sellAmount, buyToken, side, status: 'active', createdAt: new Date().toISOString(), expiresAt };
}

export function getActiveRFQs(): RFQ[] {
  return getDb().prepare("SELECT * FROM rfqs WHERE status = 'active' AND expires_at > datetime('now') ORDER BY created_at DESC").all().map(mapRFQ);
}

export function getRFQ(id: string): RFQ | null {
  const row = getDb().prepare('SELECT * FROM rfqs WHERE id = ?').get(id) as any;
  return row ? mapRFQ(row) : null;
}

export function updateRFQStatus(id: string, status: RFQ['status']) {
  getDb().prepare('UPDATE rfqs SET status = ? WHERE id = ?').run(status, id);
}

// Quote operations
export function createQuote(rfqId: string, quoter: string, price: string, amount: string, buyAmount: string): Quote {
  const d = getDb();
  const id = uuid();
  d.prepare('INSERT INTO quotes (id, rfq_id, quoter, price, amount, buy_amount) VALUES (?, ?, ?, ?, ?, ?)').run(id, rfqId, quoter, price, amount, buyAmount);
  return { id, rfqId, quoter, price, amount, buyAmount, status: 'pending', createdAt: new Date().toISOString() };
}

export function getQuotesForRFQ(rfqId: string): Quote[] {
  return getDb().prepare('SELECT * FROM quotes WHERE rfq_id = ? ORDER BY created_at DESC').all(rfqId).map(mapQuote);
}

export function getQuote(id: string): Quote | null {
  const row = getDb().prepare('SELECT * FROM quotes WHERE id = ?').get(id) as any;
  return row ? mapQuote(row) : null;
}

export function updateQuoteStatus(id: string, status: Quote['status']) {
  getDb().prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, id);
}

// Trade operations
export function createTrade(rfqId: string, quoteId: string, partyA: string, partyB: string, sellToken: string, sellAmount: string, buyToken: string, buyAmount: string, price: string): Trade {
  const d = getDb();
  const id = uuid();
  d.prepare('INSERT INTO trades (id, rfq_id, quote_id, party_a, party_b, sell_token, sell_amount, buy_token, buy_amount, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, rfqId, quoteId, partyA, partyB, sellToken, sellAmount, buyToken, buyAmount, price);
  return { id, rfqId, quoteId, partyA, partyB, sellToken, sellAmount, buyToken, buyAmount, price, status: 'pending_signatures', legASig: null, legBSig: null, createdAt: new Date().toISOString(), completedAt: null };
}

export function getTrade(id: string): Trade | null {
  const row = getDb().prepare('SELECT * FROM trades WHERE id = ?').get(id) as any;
  return row ? mapTrade(row) : null;
}

export function getAllTrades(limit = 50): Trade[] {
  return getDb().prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT ?').all(limit).map(mapTrade);
}

export function getTradesByWallet(walletAddress: string, limit = 50): Trade[] {
  return getDb().prepare('SELECT * FROM trades WHERE party_a = ? OR party_b = ? ORDER BY created_at DESC LIMIT ?').all(walletAddress, walletAddress, limit).map(mapTrade);
}

export function updateTrade(id: string, updates: Partial<Trade>) {
  const d = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.legASig !== undefined) { fields.push('leg_a_sig = ?'); values.push(updates.legASig); }
  if (updates.legBSig !== undefined) { fields.push('leg_b_sig = ?'); values.push(updates.legBSig); }
  if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
  if (fields.length > 0) {
    values.push(id);
    d.prepare(`UPDATE trades SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
}

// Mappers
function mapClient(row: any): Client {
  return { id: row.id, walletAddress: row.wallet_address, label: row.label, createdAt: row.created_at };
}

function mapDeposit(row: any): DepositRecord {
  return { id: row.id, walletAddress: row.wallet_address, tokenMint: row.token_mint, amount: row.amount, txSignature: row.tx_signature, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapWithdrawal(row: any): WithdrawalRecord {
  return { id: row.id, walletAddress: row.wallet_address, tokenMint: row.token_mint, amount: row.amount, channelTxSignature: row.channel_tx_signature, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapRFQ(row: any): RFQ {
  return { id: row.id, creator: row.creator, sellToken: row.sell_token, sellAmount: row.sell_amount, buyToken: row.buy_token, side: row.side, status: row.status, createdAt: row.created_at, expiresAt: row.expires_at };
}

function mapQuote(row: any): Quote {
  return { id: row.id, rfqId: row.rfq_id, quoter: row.quoter, price: row.price, amount: row.amount, buyAmount: row.buy_amount, status: row.status, createdAt: row.created_at };
}

function mapTrade(row: any): Trade {
  return { id: row.id, rfqId: row.rfq_id, quoteId: row.quote_id, partyA: row.party_a, partyB: row.party_b, sellToken: row.sell_token, sellAmount: row.sell_amount, buyToken: row.buy_token, buyAmount: row.buy_amount, price: row.price, status: row.status, legASig: row.leg_a_sig, legBSig: row.leg_b_sig, createdAt: row.created_at, completedAt: row.completed_at };
}
