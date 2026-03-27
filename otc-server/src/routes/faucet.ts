import { Hono } from 'hono';
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// All tokens are Token-2022 with 6 decimals
const TOKENS: { symbol: string; name: string; mint: string }[] = [
  { symbol: 'USDC', name: 'USD Coin', mint: '5L9sUJJHL73YjaJ66MSD1BtNqZo1pgidPtcNKBvVdQ2J' },
  { symbol: 'USDT', name: 'Tether USD', mint: '7mqJuABCcbrk4UYJJtE4d3GZwR5n2a8BpaSURCq752hu' },
  { symbol: 'EURC', name: 'Euro Coin', mint: '42k8yVzBkueqEf1cPPhVHxipvUufg5Z9PpV3DRZJxq1h' },
  { symbol: 'PYUSD', name: 'PayPal USD', mint: '7D3ePHxhAzg1RAoCXwNLvCsgPo91NiVwE2BVm1vX9Loi' },
  { symbol: 'USDG', name: 'Global Dollar', mint: 'azTaDSr4bbhqsxFao8jUH2yz52r1sy5ihKu4XHHBkoE' },
  { symbol: 'USX', name: 'USX Stablecoin', mint: '7UAwp1VTSJyhuhHF3DQifyebNey9DnCcyADcvmkky4pC' },
  { symbol: 'CHF', name: 'Swiss Franc Stable', mint: '8sKLVxMHswSVUXwR5sPox8cR4f88z49WtvmYY6J1URGd' },
  { symbol: 'GBP', name: 'British Pound Stable', mint: '2CMNySecfv9V9kA7LS2VsWzvTv7Kp35Y3jXKGKTH6qv3' },
  { symbol: 'JPY', name: 'Japanese Yen Stable', mint: 'FnTA78B6wp9i3tZG3NxFXZdd85rQtqzHEwpmwWkbx8PB' },
  { symbol: 'SGD', name: 'Singapore Dollar Stable', mint: 'DnDP4L3mEztefrhq1UedBkGbnhzmeKLxqJ7AYtiawL4f' },
  { symbol: 'AED', name: 'UAE Dirham Stable', mint: 'BSCwHCEkNUAgW3uXWEnrgNH2NsSqhiwgmd9dVQLkbshC' },
];

const DECIMALS = 6;
const MAX_AMOUNT = 1000; // max 1000 tokens per mint
const MAX_RAW = BigInt(MAX_AMOUNT) * BigInt(10 ** DECIMALS);

function loadMintAuthority(): Keypair {
  // Prefer FAUCET_MINT_AUTHORITY_SECRET env var (JSON array of bytes)
  const envSecret = process.env.FAUCET_MINT_AUTHORITY_SECRET;
  if (envSecret) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(envSecret)));
  }
  // Fallback to file path
  const keyPath = resolve((process.env.FAUCET_KEYPAIR_PATH || process.env.SAS_PAYER_PATH || '~/.config/solana/id.json').replace('~', process.env.HOME || ''));
  const raw = JSON.parse(readFileSync(keyPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

const faucetRouter = new Hono();

// List available tokens
faucetRouter.get('/tokens', (c) => {
  return c.json({ tokens: TOKENS, maxAmount: MAX_AMOUNT, decimals: DECIMALS });
});

// Mint tokens to a wallet
faucetRouter.post('/mint', async (c) => {
  try {
    const { walletAddress, mint, amount } = await c.req.json();

    if (!walletAddress || !mint || !amount) {
      return c.json({ error: 'walletAddress, mint, and amount are required' }, 400);
    }

    const token = TOKENS.find(t => t.mint === mint);
    if (!token) {
      return c.json({ error: `Unknown token mint. Available: ${TOKENS.map(t => t.symbol).join(', ')}` }, 400);
    }

    const numAmount = Number(amount);
    if (numAmount <= 0 || numAmount > MAX_AMOUNT) {
      return c.json({ error: `Amount must be between 0 and ${MAX_AMOUNT}` }, 400);
    }

    const rawAmount = BigInt(Math.floor(numAmount * (10 ** DECIMALS)));

    const connection = new Connection(process.env.SOLANA_VALIDATOR_URL || 'https://api.devnet.solana.com', 'confirmed');
    const mintAuthority = loadMintAuthority();
    const mintPubkey = new PublicKey(mint);
    const walletPubkey = new PublicKey(walletAddress);

    // Get or create ATA (Token-2022)
    const ata = await getAssociatedTokenAddress(
      mintPubkey, walletPubkey, false,
      TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const { Transaction } = await import('@solana/web3.js');
    const tx = new Transaction();

    // Check if ATA exists
    try {
      await getAccount(connection, ata, 'confirmed', TOKEN_2022_PROGRAM_ID);
    } catch {
      // ATA doesn't exist — create it
      tx.add(
        createAssociatedTokenAccountInstruction(
          mintAuthority.publicKey, ata, walletPubkey, mintPubkey,
          TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        )
      );
    }

    // Mint tokens
    tx.add(
      createMintToInstruction(
        mintPubkey, ata, mintAuthority.publicKey, rawAmount,
        [], TOKEN_2022_PROGRAM_ID,
      )
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = mintAuthority.publicKey;

    const signature = await connection.sendTransaction(tx, [mintAuthority], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(signature, 'confirmed');

    console.log(`Faucet: minted ${numAmount} ${token.symbol} to ${walletAddress} (tx: ${signature})`);

    return c.json({
      success: true,
      token: token.symbol,
      amount: numAmount,
      walletAddress,
      signature,
      ata: ata.toString(),
    });
  } catch (err: any) {
    console.error('Faucet mint error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});

export default faucetRouter;
