# ContraClear OTC
## Stack

React 19 + Vite | Hono.js + SQLite | Solana devnet | Contra channel | Supabase Auth | Zyphe KYC/KYB | SAS attestation

## Services

| Port | Service | Description |
|------|---------|-------------|
| 5173 | `otc-frontend` | React SPA (Vite) |
| 3001 | `otc-server` | Backend API (Hono.js + SQLite) |
| 3002 | WebSocket | Real-time push events |
| 8085 | `webhook` | Zyphe KYC/KYB webhook receiver |
| 8899 | Contra Gateway | Channel RPC (GCP: `35.228.38.233:8899`) |
| 18899 | Solana Validator | Local devnet with escrow programs |

## On-Chain Addresses

| Key | Address |
|-----|---------|
| Escrow Program | `GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83` |
| Withdraw Program | `J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi` |
| Escrow Instance | `Ds5BLM4jsC2XXXE8fW1pZBmRFz7ekuZ5UKoTPykjRMnq` |
| SAS Program | `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG` |
| SAS Credential PDA | `5K8c9yZqJv65Z4B5Q9BSPQERtRXkRj1NbzKqHZHf2Unm` |
| Operator | `DrMxF9H3vLv8ZWUp8iS1629oTBHnYF6bsUpB42KXaUdi` |

## Quick Start

```bash
# Terminal 1: Backend
cd otc-server 
cp .env.example .env
npm i
npx run dev

# Terminal 2: Frontend
cd otc-frontend
cp .env.example .env
npm i
npm run dev

# Terminal 3: Webhook (for KYC)
cd webhook 
cp .env.example .env
npm i
npm run build && npm start
```


## Demo Accounts

All use password `contra123`:

| Email | Role |
|-------|------|
| `rfq@contraotc.dev` | RFQ Originator (KYC bypassed) |
| `lp@contraotc.dev` | Liquidity Provider (KYC bypassed) |
| `admin@contraotc.dev` | Admin |

## Trading Flow

1. **RFQ** — Originator creates an RFQ (sell token, amount, buy token)
2. **Quote** — LP submits a quote with price. Counter-quotes supported.
3. **Accept** — Originator accepts a quote. Both parties deposit escrow tokens on-chain into the Contra channel.
4. **Settlement** — Each party signs a transfer of their tokens to the operator. When both have signed, the operator releases tokens to the correct recipients server-side. This is atomic — tokens are held by the operator until both parties commit.

## Settlement (Operator-Escrow)

The Contra channel has ~20s blockhash validity, making multi-signer transactions impractical. Instead, the operator acts as escrow:

1. Party A clicks "Sign Settlement" → builds fresh tx (A → operator) → wallet signs → submitted instantly to Contra
2. Party B clicks "Sign Settlement" (any time later) → same flow (B → operator)
3. Backend detects both deposits → operator signs and submits two release txs server-side with fresh blockhashes:
   - Operator → B (sell token)
   - Operator → A (buy token)

Channel ATAs for receiving tokens are auto-created by the backend via `channel-ata.ts` (operator deposits 1 raw unit with `recipient` parameter).

## Contra Channel

Contra is an off-chain payment channel with instant finality. Users deposit SPL tokens on Solana into the escrow program — tokens appear on the channel. Withdrawals reverse the process.

- Gateway RPC: `http://35.228.38.233:8899` (Solana JSON-RPC compatible)
- Channel uses `TOKEN_PROGRAM_ID` for ATAs (not Token-2022)
- All demo tokens are Token-2022 on Solana devnet with 6 decimals
- `getBalance` and `getTransaction` are not supported on the gateway
- `getSignatureStatuses` works for verifying tx execution

## KYC/KYB

Zyphe integration (sandbox). Individual users go through KYC, institutions through KYB. On verification, a SAS attestation is created on Solana. Admin users and demo accounts (`rfq@`, `lp@`, `admin@`) bypass KYC.

## Faucet

`/faucet` route in the frontend. Mints up to 1000 of any demo token (USDC, USDT, EURC, PYUSD, USDG, USX, CHF, GBP, JPY, SGD, AED) to any wallet on devnet.


