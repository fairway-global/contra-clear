# ContraClear OTC — Complete Repository Guide

## Overview

ContraClear is an institutional OTC spot trading platform on Solana with on-chain KYC/KYB attestation via the Solana Attestation Service (SAS). It enables private bilateral trades between RFQ originators and liquidity providers with escrow-based settlement, Zyphe identity verification, and Supabase authentication.

**Stack:** React 19 + Vite 7 | Hono.js + SQLite (better-sqlite3) | Express.js webhook | Solana devnet | Supabase Auth | Zyphe KYC/KYB | SAS on-chain attestation | Tailwind CSS | JetBrains Mono font

---

## Architecture (3 Services)

| Service | Port | Tech | Purpose |
|---------|------|------|---------|
| `otc-frontend` | 5173 | React/Vite/Tailwind | Frontend SPA |
| `otc-server` | 3001 | Hono.js/SQLite | Backend API + OTC logic + KYC/SAS |
| `webhook` | 8085 | Express.js | Zyphe webhook receiver + session creation |

WebSocket server runs on port 3002 (started by otc-server).

**External Services:**
- **Supabase** — User authentication (email/password, JWT tokens)
- **Contra Gateway** — Solana channel operations (GCP VM at `35.228.38.233:8899`)
- **Solana Devnet** — On-chain escrow program, deposits, withdrawals, SAS attestations
- **Zyphe** — KYC (individual) and KYB (institution) identity verification sandbox

---

## Directory Structure

```
/otc/
├── otc-server/                    # Backend API (Hono.js + SQLite)
│   ├── src/
│   │   ├── index.ts               # Server entry, mounts all routes, starts WS
│   │   ├── types.ts               # Legacy type definitions
│   │   ├── db/
│   │   │   ├── store.ts           # Legacy tables (clients, deposits, withdrawals, rfqs, quotes, trades)
│   │   │   └── otc-store.ts       # OTC tables + all store functions (~1000 lines)
│   │   ├── routes/
│   │   │   ├── otc.ts             # Main OTC routes (auth, users, rfqs, quotes, escrow, kyc, admin)
│   │   │   ├── auth.ts            # Wallet signature auth
│   │   │   ├── rfq.ts             # Legacy RFQ routes
│   │   │   ├── deposits.ts        # Deposit transaction building + confirmation
│   │   │   ├── withdrawals.ts     # Withdrawal handling
│   │   │   ├── balances.ts        # Channel + on-chain balance queries
│   │   │   ├── trades.ts          # Trade queries
│   │   │   └── clients.ts         # Client registration
│   │   └── services/
│   │       ├── ws.ts              # WebSocket broadcast
│   │       ├── attestation.ts     # SAS on-chain attestation creation
│   │       ├── auth.ts            # Session management
│   │       ├── contra.ts          # Contra gateway RPC
│   │       ├── escrow.ts          # Escrow transaction building
│   │       ├── deposit-status.ts  # Deposit polling/reconciliation
│   │       ├── effective-balance.ts
│   │       └── swap.ts            # Trade settlement
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── otc-frontend/                  # React SPA (Vite)
│   ├── src/
│   │   ├── App.tsx                # Main router + auth guards + KYC gates
│   │   ├── main.tsx               # Entry point with wallet providers
│   │   ├── components/
│   │   │   ├── admin/             # AdminConsole, AdminDashboard, AdminRFQTable, etc.
│   │   │   ├── auth/              # LoginPage, SignupPage, KYCVerificationPage
│   │   │   ├── otc/               # OTCWorkspace + sub-components
│   │   │   │   ├── OTCWorkspace.tsx
│   │   │   │   ├── rfq/           # CreateRFQModal, RFQDetailsHeader, AcceptQuoteModal, QuoteTable
│   │   │   │   ├── quotes/        # SubmitQuoteModal, QuoteNegotiationModal
│   │   │   │   └── escrow/        # DepositEscrowModal, EscrowStatusCard, EscrowTimeline
│   │   │   ├── deposit/           # DepositPanel (on-chain deposit flow)
│   │   │   ├── withdraw/          # WithdrawPanel
│   │   │   ├── portfolio/         # BalanceCard, TradeHistory
│   │   │   ├── home/              # RootDashboard (landing page)
│   │   │   ├── layout/            # Header, Panel, ModalShell
│   │   │   ├── trading/           # PendingTrades, QuotePanel, CreateRFQ
│   │   │   └── wallet/            # WalletConnect
│   │   ├── hooks/
│   │   │   ├── useEmailRoleAuth.ts  # Supabase auth state management
│   │   │   ├── useAuth.ts          # Wallet signature auth
│   │   │   ├── useBalances.ts       # Balance polling
│   │   │   ├── useOTCSession.ts     # OTC role/user selection
│   │   │   └── (others)
│   │   ├── lib/
│   │   │   ├── otc/
│   │   │   │   ├── api.ts          # All OTC API calls (fetch-based, Supabase JWT)
│   │   │   │   ├── types.ts        # Enums, interfaces, label maps
│   │   │   │   └── mockService.bak.ts  # Old mock (disabled)
│   │   │   ├── sas/
│   │   │   │   └── client.ts       # Read on-chain SAS attestations
│   │   │   ├── supabase.ts         # Supabase client singleton
│   │   │   ├── api.ts              # Legacy API client (deposits, withdrawals, trades)
│   │   │   ├── constants.ts        # Token registry, formatters, helpers
│   │   │   └── sendToContra.ts     # Contra gateway transaction submission
│   │   └── styles/
│   │       └── globals.css         # Tailwind + terminal theme
│   ├── package.json
│   ├── vite.config.ts              # Proxy /api→:3001, node polyfills
│   ├── tsconfig.json
│   └── .env
│
├── webhook/                       # Zyphe webhook server (Express.js)
│   ├── src/
│   │   └── server.ts              # Session creation + webhook forwarding
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── contra/                        # Contra infrastructure (Solana programs, configs)
├── scripts/                       # Setup scripts
├── keypairs/                      # Solana keypairs (gitignored)
├── metadata/                      # Token metadata
└── CLAUDE.md                      # This file
```

---

## Database Schema (SQLite — otc-store.ts)

### `otc_users`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| supabase_id | TEXT UNIQUE | Links to Supabase auth user |
| full_name | TEXT | |
| email | TEXT UNIQUE | |
| role | TEXT | `RFQ_ORIGINATOR`, `LIQUIDITY_PROVIDER`, `ADMIN` |
| status | TEXT | `ACTIVE`, `INVITED`, `SUSPENDED` |
| created_at | TEXT | ISO datetime |

### `otc_rfqs`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| reference | TEXT UNIQUE | `RFQ-0001`, auto-incremented |
| sequence | TEXT | Client-provided sequence ID |
| originator_id, originator_name | TEXT | |
| sell_token, sell_amount | TEXT | Token mint + raw amount |
| buy_token, indicative_buy_amount | TEXT | |
| required_tier | INTEGER | 1-5 |
| side | TEXT | Always `sell` |
| status | TEXT | See status flow below |
| selected_quote_id | TEXT | Set after quote acceptance |
| selected_provider_id, selected_provider_name | TEXT | |
| accepted_price | TEXT | |
| filled_amount | TEXT | Tracks partial fills, default `0` |
| created_at, updated_at, expires_at | TEXT | |

### `otc_quotes`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| rfq_id | TEXT | Foreign key |
| provider_id, provider_name | TEXT | |
| submitted_by_role, submitted_by_user_id, submitted_by_name | TEXT | Who submitted this version |
| version | INTEGER | Increments on each counter-quote |
| price, sell_amount, buy_amount | TEXT | |
| status | TEXT | See status flow below |
| note | TEXT | Optional |
| parent_quote_id | TEXT | Links counter-quote chain |
| created_at, updated_at | TEXT | |

### `otc_escrows` (2 rows per RFQ)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| rfq_id | TEXT | |
| party_role | TEXT | `RFQ_ORIGINATOR` or `LIQUIDITY_PROVIDER` |
| party_id, party_name | TEXT | |
| token_mint | TEXT | SPL token mint address |
| amount | TEXT | Raw token amount |
| status | TEXT | See status flow below |
| tx_hash | TEXT | Solana tx signature |
| updated_at | TEXT | |

### `otc_activities` (audit log)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| rfq_id | TEXT | |
| type | TEXT | `RFQ_CREATED`, `QUOTE_SUBMITTED`, `QUOTE_COUNTERED`, `QUOTE_ACCEPTED`, `QUOTE_REJECTED`, `ESCROW_REQUESTED`, `ESCROW_SUBMITTED`, `ESCROW_LOCKED`, `SETTLEMENT_STARTED`, `SETTLEMENT_COMPLETED`, `RFQ_UPDATED`, `RFQ_CANCELLED` |
| actor_id, actor_name | TEXT | |
| summary | TEXT | Human-readable |
| detail | TEXT | Optional extra context |
| related_quote_id | TEXT | |
| created_at | TEXT | |

### `kyc_dids`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| did | TEXT UNIQUE | `did:contra:devnet:{walletAddress}` |
| wallet_address | TEXT UNIQUE | Solana public key (or email for admin bypass) |
| kyc_status | TEXT | `pending`, `verified`, `rejected`, `expired` |
| jurisdiction | TEXT | ISO country code |
| kyc_provider | TEXT | `zyphe` or `admin-bypass` |
| kyc_data | TEXT | JSON blob |
| attestation_pda | TEXT | SAS attestation PDA address |
| attestation_tx | TEXT | Solana tx signature |
| attestation_expiry | INTEGER | Unix seconds |
| created_at, updated_at | TEXT | |

### Legacy tables (store.ts): `clients`, `deposits`, `withdrawals`, `rfqs`, `quotes`, `trades`

---

## Status Flows

### RFQ Status
```
Draft → OpenForQuotes → Negotiating → QuoteSelected
  → AwaitingOriginatorDeposit → AwaitingProviderDeposit
  → ReadyToSettle → Settling → Settled
  (or: Expired, Cancelled, Defaulted)

Partial fill: Settled → OpenForQuotes (if filled_amount < sell_amount)
```

### Quote Status
```
Draft → Submitted → Negotiating → Countered → Accepted
  → AwaitingDeposit → Deposited → Settled
  (or: Rejected, Expired, Cancelled)
```

### Escrow Status
```
NotStarted → DepositRequested → CreditedInContra → LockedForSettlement → Released
  (or: PendingOnChain, ConfirmedOnChain, Withdrawn, Failed, Expired)
```

---

## API Routes

### Authentication (`/api/otc/auth/*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | None | Create Supabase user + OTC user (admin API, bypasses rate limits) |
| POST | `/auth/login` | None | Supabase sign-in, returns JWT + user profile |
| POST | `/auth/logout` | None | Client-side Supabase signout |
| GET | `/auth/me` | JWT | Get current user's OTC profile |

### Users (`/api/otc/users*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users?includeAdmins=bool` | JWT | List OTC users |
| POST | `/users` | JWT | Create user (admin) |
| PUT | `/users/:userId` | JWT | Update user (admin) |
| DELETE | `/users/:userId` | JWT | Delete user (admin) |

### RFQs (`/api/otc/rfqs*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/rfqs` | JWT | List RFQs (role-filtered) |
| POST | `/rfqs` | JWT | Create RFQ |
| GET | `/rfqs/:rfqId` | JWT | Get RFQ detail |

### Quotes (`/api/otc/quotes*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/quotes/:rfqId` | JWT | Get quotes for RFQ (LP sees only their own) |
| POST | `/quotes/submit` | JWT | Submit quote (LP) |
| POST | `/quotes/counter` | JWT | Counter-quote (either party) |
| POST | `/quotes/accept` | JWT | Accept quote, optional `fillAmount` for partial fill |
| POST | `/quotes/reject` | JWT | Reject quote |

### Escrow (`/api/otc/escrow*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/escrow/:rfqId` | JWT | Get escrow obligations for RFQ |
| POST | `/escrow/submit-tx` | JWT | Record escrow deposit tx hash |

### Activity (`/api/otc/activity*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/activity/:rfqId` | JWT | Get negotiation thread |

### Admin (`/api/otc/admin*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/overview` | JWT | Dashboard stats |
| GET | `/admin/rfqs` | JWT | All RFQs with counts |
| GET | `/admin/escrow` | JWT | All escrow obligations |

### KYC/KYB (`/api/otc/kyc*`, `/api/otc/did*`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/kyc/initiate` | None | Register DID + create Zyphe session (accepts `type: 'kyc'|'kyb'`) |
| GET | `/kyc/status?wallet=&email=` | None | Check KYC status |
| POST | `/did/webhook/zyphe` | None | Webhook from Zyphe (forwarded by webhook server) |

---

## Frontend Routes (App.tsx)

| Path | Component | Auth Required | KYC Required |
|------|-----------|---------------|-------------|
| `/` | RootDashboard | No | No |
| `/login` | LoginPage | No | No |
| `/signup` | SignupPage | No | No |
| `/kyc` | KYCVerificationPage (KYC mode) | No | No |
| `/kyb` | KYCVerificationPage (KYB mode) | No | No |
| `/deposit` | DepositPanel + BalanceCard | Email + Wallet | No |
| `/withdraw` | WithdrawPanel + BalanceCard | Email + Wallet | No |
| `/otc/rfqs` | OTCWorkspace | Email | Yes (except ADMIN) |
| `/otc/rfqs/:rfqId` | OTCWorkspace (detail) | Email | Yes |
| `/otc/escrow` | OTCWorkspace (escrow tab) | Email | Yes |
| `/otc/settlements` | OTCWorkspace (settlements) | Email | Yes |
| `/admin/otc` | AdminConsole | Email (ADMIN) | No |
| `/admin/rfqs` | AdminConsole | Email (ADMIN) | No |
| `/admin/users` | AdminConsole | Email (ADMIN) | No |
| `/admin/settlements` | AdminConsole | Email (ADMIN) | No |
| `/admin/escrow` | AdminConsole | Email (ADMIN) | No |

---

## Authentication Flow

### Supabase Auth (Email/Password)
1. **Signup:** Frontend calls backend `/api/otc/auth/signup` → backend uses `supabaseAdmin.auth.admin.createUser()` (bypasses rate limits) → creates Supabase user + `otc_users` row → frontend auto-logs in
2. **Login:** Frontend calls `supabase.auth.signInWithPassword()` → gets JWT → calls `/api/otc/auth/me` to get OTC profile
3. **Every API call:** `otcFetch()` gets token from `supabase.auth.getSession()` → sends as `Bearer` header
4. **Backend middleware:** Verifies JWT via `supabaseAdmin.auth.getUser(token)` → auto-provisions `otc_users` row if first login → sets `x-otc-user-id` header
5. **On 401:** Frontend clears token, only calls `supabase.auth.signOut()` if a token was actually sent

### Wallet Auth (Phantom/Solflare)
- Separate from Supabase auth
- Used for deposit/withdraw operations (requires wallet signature)
- Frontend uses `@solana/wallet-adapter-react` for connection
- Backend uses `tweetnacl` for Ed25519 signature verification

---

## KYC/KYB Verification Flow

### User Journey
1. User signs up → auto-logged in → redirected to `/kyc` (individual) or `/kyb` (institution)
2. Selects jurisdiction → clicks "Start KYC/KYB Verification"
3. Frontend calls `POST /api/otc/kyc/initiate` with `{ walletAddress, jurisdiction, type: 'kyc'|'kyb' }`
4. Backend registers DID in `kyc_dids` table → calls webhook server for Zyphe session URL
5. Frontend opens Zyphe verification in new window
6. User completes document/biometric (KYC) or business verification (KYB)
7. Zyphe sends webhook to webhook server (`POST /webhooks/zyphe`)
8. Webhook server normalizes payload → forwards to backend (`POST /api/otc/did/webhook/zyphe`)
9. Backend updates `kyc_dids.kyc_status` → creates SAS attestation on Solana
10. Frontend polls `GET /api/otc/kyc/status?wallet=` every 5s → detects "verified" → shows success

### Zyphe URLs
- **KYC:** `https://verify.zyphe.com/sandbox/flow/fairwayglobal-or77/kyc/or77?customData={wallet}`
- **KYB:** `https://verify.zyphe.com/sandbox/flow/fairwayglobal-or999/kyb/or999-kyb?customData={wallet}`

### Sandbox Behavior
- **KYB:** Always marked as verified regardless of Zyphe event status (sandbox returns FAILED/PENDING_MODERATION)
- **KYC:** Respects actual verification status (PASSED → verified, FAILED → rejected)
- KYB webhook `custom` field comes back empty — webhook server matches via `pendingVerifications` map

### KYC Gate
- On login, App.tsx checks KYC status (wallet first, then email fallback)
- If not verified → redirects to `/kyc` or `/kyb` based on role
- OTC routes blocked with "KYC Verification Required" if `kycVerified === false`
- Admin users bypass KYC gate

---

## SAS (Solana Attestation Service) Integration

### On-Chain Attestation
- **Program:** `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`
- **Credential PDA:** `5K8c9yZqJv65Z4B5Q9BSPQERtRXkRj1NbzKqHZHf2Unm`
- **Schema PDA:** `oCSwYS25r729mBnWW4bD8yfw4vMCWD53YtgTfJT9UZq`
- **Schema Layout:** `[12, 12, 0, 12, 10]` (String, String, U8, String, Bool)

### Attestation Data Fields
| Field | Type | Values |
|-------|------|--------|
| accreditationLevel | String | `retail`, `professional`, `institutional` |
| jurisdiction | String | `CH`, `US`, `EU`, `UK`, `SG`, `AE`, `HK` |
| complianceTier | U8 | 1-5 |
| provider | String | `zyphe` |
| isAccredited | Bool | `true` |

### Tier Calculation
- Tier 1: Sanctioned countries (KP, IR, CU, SY, RU)
- Tier 2: Default
- Tier 3: Trusted jurisdictions (CH, SG)

### Backend Attestation (attestation.ts)
- Uses `sas-lib`, `gill`, `@solana/kit`
- Loads signer from `SAS_SIGNER_SECRET` env
- Loads payer from `SAS_PAYER_PATH` (~/.config/solana/id.json)
- Derives attestation PDA: `credential + schema + nonce(walletAddress)`
- Expiry: 365 days
- Auto-triggered after successful KYC webhook processing

### Frontend Reading (lib/sas/client.ts)
- Dynamically imported (lazy load) to prevent page crashes
- Uses `readAttestation(wallet)` → derives PDA → fetches from Solana RPC → deserializes
- Only reads if backend KYC status is "verified" first (prevents stale attestation display)

---

## OTC Trading Flow

### Complete Lifecycle
```
1. Originator creates RFQ (sell token + amount, buy token, indicative price, tier, expiry)
2. RFQ published to eligible LPs (role-filtered visibility)
3. LP submits quote (price, buy amount, optional note)
4. Originator can: accept, reject, or counter
5. LP can: accept counter, or revise quote (new version)
6. Negotiation continues via counter-quotes (versioned, linked by parent_quote_id)
7. Originator accepts quote → escrow deposits requested from both parties
8. Both parties lock tokens in escrow (on-chain Solana transaction)
9. When both deposits confirmed → escrows locked → settlement auto-executed
10. Funds released to both counterparties → RFQ marked Settled
```

### Partial Fill Support
- Originator can accept a quote with `fillAmount < sell_amount`
- Escrow sized proportionally to fill amount
- After settlement: if `filled_amount < sell_amount` → RFQ reopens as `OpenForQuotes`
- Multiple partial fills can occur until fully filled

### Escrow Deposit (DepositEscrowModal)
- Not a manual tx hash paste — actual on-chain token locking
- Uses `buildDepositTx()` → wallet signs → submit to Solana → confirm on-chain → record on backend
- Progress steps: Building → Signing → Confirming → Recording → Done

---

## Role-Based Access

| Capability | RFQ_ORIGINATOR | LIQUIDITY_PROVIDER | ADMIN |
|-----------|---|---|---|
| Sign up as | KYC User | Institution | Pre-created only |
| Verification | KYC (Zyphe) | KYB (Zyphe) | No verification |
| Create RFQ | Yes | No | No |
| Submit quote | No | Yes | No |
| Counter quote | Yes | Yes | No |
| Accept/reject quote | Yes | No | No |
| Lock escrow tokens | Yes | Yes | No |
| View own RFQs | Yes | Yes (eligible) | All |
| Manage users | No | No | Yes |
| Admin dashboards | No | No | Yes |
| Deposit/withdraw | Yes | Yes | No |

---

## WebSocket Events

Server on port 3002, broadcasts JSON to all connected clients:

| Event | Trigger |
|-------|---------|
| `otc_rfq_created` | New RFQ created |
| `otc_quote_submitted` | Quote submitted |
| `otc_quote_countered` | Counter-quote sent |
| `otc_quote_accepted` | Quote accepted |
| `otc_quote_rejected` | Quote rejected |
| `otc_escrow_submitted` | Escrow tx hash recorded |
| `rfq_created` | Legacy RFQ created |
| `deposit_credited` | Deposit confirmed on-chain |
| `trade_completed` | Trade settled |

---

## Environment Variables

### otc-server/.env
```
OTC_PORT=3001
WS_PORT=3002
OTC_DB_PATH=./otc.db
CONTRA_GATEWAY_URL=http://35.228.38.233:8899
SOLANA_VALIDATOR_URL=https://api.devnet.solana.com
ESCROW_PROGRAM_ID=GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83
WITHDRAW_PROGRAM_ID=J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi
ESCROW_INSTANCE_ID=Ds5BLM4jsC2XXXE8fW1pZBmRFz7ekuZ5UKoTPykjRMnq
SAS_CREDENTIAL_PDA=<credential_pda>
SAS_SCHEMA_PDA=<schema_pda>
SAS_SIGNER_SECRET=<keypair_json_array>
SAS_PAYER_PATH=~/.config/solana/id.json
ZYPHE_WEBHOOK_URL=http://localhost:8085
SUPABASE_URL=<supabase_project_url>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
DEMO_TOKEN_MINTS=<comma_separated_mint_addresses>
```

### otc-frontend/.env
```
VITE_API_PROXY_TARGET=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
VITE_CONTRA_GATEWAY_URL=http://35.228.38.233:8899
VITE_SOLANA_VALIDATOR_URL=https://api.devnet.solana.com
VITE_SAS_CREDENTIAL_PDA=<credential_pda>
VITE_SAS_SCHEMA_PDA=<schema_pda>
VITE_SUPABASE_URL=<supabase_project_url>
VITE_SUPABASE_ANON_KEY=<supabase_anon_key>
VITE_DEMO_TOKEN_MINTS=<comma_separated_mint_addresses>
```

### webhook/.env
```
PORT=8085
BACKEND_ORACLE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
ZYPHE_CLIENT_KEY=<zyphe_api_key>
ZYPHE_FLOW_ID=<zyphe_flow_id>
ZYPHE_WEBHOOK_SECRET=<optional>
```

---

## Running the Project

```bash
# Terminal 1: Backend
cd otc-server && npx tsx src/index.ts

# Terminal 2: Frontend
cd otc-frontend && npm run dev

# Terminal 3: Webhook server
cd webhook && npx tsx src/server.ts
```

### First-time setup
1. Copy `.env.example` files and fill in Supabase + SAS credentials
2. Delete `otc-server/otc.db` if schema changes were made (auto-recreated)
3. Create demo users in Supabase via admin API or signup flow
4. For KYC bypass: insert rows directly into `kyc_dids` with `kyc_status='verified'`

---

## Key Implementation Details

### Frontend Proxy (vite.config.ts)
- `/api/*` and `/health` proxied to `localhost:3001`
- Frontend `otcFetch()` uses relative paths (`/api/otc/...`)
- Supabase client initialized from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

### Supabase Auto-Provisioning
- Backend middleware verifies Supabase JWT → looks up `otc_users` by `supabase_id`
- If not found, creates `otc_users` row from Supabase user metadata (`role`, `full_name`, `email`)
- Also checks by email (for users created before Supabase was linked)

### KYC Status Check Priority
- Frontend checks KYC by **wallet address first**, then **email fallback**
- Both `useEffect` on mount and `handleEmailLogin` do this dual check
- Email-based KYC bypass: insert `kyc_dids` with `wallet_address = email`

### React Rules of Hooks
- `KYCVerificationPage` has all hooks declared before any early returns
- `authLoading` guard placed after all hooks but before render logic

### Token Registry (constants.ts)
- 12 pre-seeded stablecoin overrides (USDC, USDT, EURC, etc.)
- Unknown tokens lazy-fetched from Jupiter API
- `formatRawAmount(raw, mint)` handles decimal conversion
- `toRawAmount(human, mint)` converts display amounts to raw

---

## Supabase Project
- **Project:** contra
- **Project ID:** vscnrvvbpsasbjckodia
- **URL:** https://vscnrvvbpsasbjckodia.supabase.co
- **Auth:** Email/password with email confirmation disabled for hackathon
- **User metadata:** `full_name`, `role`, `institution_name` stored in `user_metadata`

### Pre-created demo users (password: `contra123`)
| Email | Role |
|-------|------|
| originator@contraotc.dev | RFQ_ORIGINATOR |
| lp1@contraotc.dev | LIQUIDITY_PROVIDER |
| lp2@contraotc.dev | LIQUIDITY_PROVIDER |
| admin@contraotc.dev | ADMIN |
| rfq@contraotc.dev | RFQ_ORIGINATOR (KYC bypassed) |
| lp@contraotc.dev | LIQUIDITY_PROVIDER (KYC bypassed) |

---

## Contra Payment Channel Infrastructure

The `contra/` directory contains the core Contra infrastructure — a **payment channel with direct access to Solana Mainnet liquidity**. ContraClear OTC is built on top of this.

### What Contra Is
Contra is an off-chain payment channel that enables instant, private transactions while assets remain accessible to/from Solana. It consists of:

- **Contra Channel** — Private transaction batching system. Executes transactions with instant finality, full control over participants and rules.
- **Contra Escrow Program** (`GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83`) — On-chain Solana program. Users deposit SPL tokens which are locked in escrow for use within the channel.
- **Contra Withdrawal Program** (`J231K9UEpS4y4KAPwGc4gsMNCjKFRMYcQBcjVW7vBhVi`) — Tokens sent to withdraw program inside the channel are burned, and SPL tokens are released from escrow back to the user.
- **Contra Gateway** — HTTP/RPC server (runs on GCP at `35.228.38.233:8899`) that the backend communicates with for channel operations, balance queries, and state sync.

### How Deposits Work (Escrow Program)
```
User Wallet (SPL tokens on Solana)
  → Escrow Program locks tokens
  → Tokens appear in user's Contra Channel balance
  → User can trade within the channel (instant, private)
```

The escrow program:
- Derives `allowed_mint` PDA for whitelisted token mints
- Takes user's ATA → transfers to escrow instance ATA
- Instruction discriminator: `6` for deposits
- Escrow Instance: `Ds5BLM4jsC2XXXE8fW1pZBmRFz7ekuZ5UKoTPykjRMnq`

### How Withdrawals Work
```
User requests withdrawal in channel
  → Withdraw program burns channel tokens
  → Escrow program releases SPL tokens back to user's wallet
```

### How OTC Settlement Uses Contra
When both parties in an RFQ accept terms and lock escrow:
1. Originator deposits sell tokens → locked in Contra escrow
2. LP deposits buy tokens → locked in Contra escrow
3. Both deposits confirmed → settlement auto-executes
4. Channel transfers: originator's sell tokens → LP, LP's buy tokens → originator
5. Escrow status → Released, RFQ → Settled

### Contra Directory Structure
```
contra/
├── contra-escrow-program/    # Solana BPF program (Rust) for token escrow
├── contra-withdraw-program/  # Solana BPF program (Rust) for withdrawals
├── core/                     # Channel core logic
├── gateway/                  # HTTP/RPC gateway server
├── admin-ui/                 # Admin dashboard for channel operations
├── demo/                     # Demo scripts
├── docs/                     # Architecture documentation
├── docker-compose.yml        # Infrastructure deployment
└── Cargo.toml                # Rust workspace
```

### Gateway API (used by otc-server)
The backend's `contra.ts` service communicates with the gateway for:
- `getSlot()` — Current Solana slot from the channel
- Channel balance queries (per wallet, per mint)
- Escrow account state checks
- The gateway doesn't support `getTokenAccountsByOwner` — must check known mints individually

---

## Design System

- **Font:** JetBrains Mono (monospace everywhere)
- **Theme:** Terminal-dark with accent color (`terminal-accent`)
- **Colors:** `terminal-bg`, `terminal-text`, `terminal-dim`, `terminal-border`, `terminal-accent`, `terminal-green`, `terminal-red`
- **Components:** `panel`, `btn-primary`, `btn-secondary`, `input-field`, `select-field`
- **Layout:** Two-column grid on desktop, single column on mobile
