# Solana Mock Stablecoin Factory — OTC Desk Devnet Setup

Create multiple mock stablecoin mints on Solana devnet with proper metadata,
so Phantom/Solflare display them with correct names, symbols, and logos.

## What this creates

| Symbol | Name                | Decimals | Token Program |
|--------|---------------------|----------|---------------|
| USDC   | USD Coin (Mock)     | 6        | Token-2022    |
| USDT   | Tether USD (Mock)   | 6        | Token-2022    |
| EURC   | Euro Coin (Mock)    | 6        | Token-2022    |
| PYUSD  | PayPal USD (Mock)   | 6        | Token-2022    |
| USDG   | Global Dollar (Mock)| 6        | Token-2022    |
| CHF    | Swiss Franc (Mock)  | 6        | Token-2022    |
| GBP    | British Pound (Mock)| 6        | Token-2022    |
| JPY    | Japanese Yen (Mock) | 6        | Token-2022    |
| SGD    | Singapore Dollar (Mock)| 6     | Token-2022    |
| AED    | UAE Dirham (Mock)   | 6        | Token-2022    |

Each mint gets 1,000,000 tokens minted to your wallet.

## Prerequisites

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Install Node.js >= 18
# https://nodejs.org

# Configure for devnet
solana config set --url https://api.devnet.solana.com

# Create or import a keypair
solana-keygen new --outfile ~/.config/solana/id.json
# OR if you already have one:
# solana config set --keypair ~/.config/solana/id.json

# Fund your wallet with devnet SOL
solana airdrop 2
```

## Quick Start (Option A — Shell Script)

Fastest way. Uses `spl-token` CLI directly.

```bash
chmod +x create-mocks.sh
./create-mocks.sh
```

This outputs a `mint-addresses.json` you can import into your OTC desk code.

## Full Setup (Option B — TypeScript with Metadata)

Creates Token-2022 mints with on-chain metadata so wallets display
proper names, symbols, and URIs.

```bash
npm install
npx ts-node create-mocks-with-metadata.ts
```

## Using in your OTC desk

After running either script, import the generated config:

```typescript
import mints from './mint-addresses.json';

// mints looks like:
// {
//   "USDC": { "mint": "ABC123...", "decimals": 6, "name": "USD Coin (Mock)" },
//   "CHF":  { "mint": "DEF456...", "decimals": 6, "name": "Swiss Franc (Mock)" },
//   ...
// }

// Transfer mock USDC for mock CHF — your OTC swap
const usdcMint = new PublicKey(mints.USDC.mint);
const chfMint  = new PublicKey(mints.CHF.mint);
```

## Minting more tokens

```bash
# Mint 500,000 more mock USDC to your wallet
spl-token mint <USDC_MINT_ADDRESS> 500000 --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# Mint to a different wallet
spl-token mint <USDC_MINT_ADDRESS> 500000 -- <RECIPIENT_TOKEN_ACCOUNT>
```