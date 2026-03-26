# Setup Guide (Judges + Technical Reviewers)

This guide has two paths:

- `Path A` - quick local app run against existing RPC endpoints (best for judges)
- `Path B` - full local infra run with Contra + local validator (best for technical deep dive)

## Path A: Quick Run (Recommended)

## 1) Prerequisites

- Node.js `22+`
- `npm`
- A Solana wallet extension (Phantom recommended)

## 2) Install dependencies

```bash
cd otc-server
cp .env.example .env
npm install

cd ../otc-frontend
cp .env.example .env
npm install

cd ../webhook
npm install
```

## 3) Configure auth variables

Add these to `otc-server/.env`:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Add these to `otc-frontend/.env`:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Without Supabase values, the landing page still loads, but OTC login/signup flows will not work.

## 4) Start services

Terminal 1:

```bash
cd otc-server
npm run dev
```

Terminal 2:

```bash
cd otc-frontend
npm run dev
```

Terminal 3 (optional, for KYC webhook forwarding):

```bash
cd webhook
npm run dev
```

Open: `http://localhost:5173`

## 5) Quick health checks

```bash
curl http://localhost:3001/health
curl http://localhost:8085/health
```

## Path B: Full Local Infra (Contra + Solana)

Use this only if you need fully local chain/channel infrastructure.

## 1) Additional prerequisites

- PostgreSQL `14+`
- Rust toolchain
- Solana CLI (`agave-install init 2.2.19` used in project runbook)
- `spl-token`
- `jq`

## 2) Bring Contra source locally

This repo expects a local `contra` directory at:

```text
./contra
```

## 3) Create local databases

```bash
psql postgres -c "CREATE USER contra WITH PASSWORD 'contra_password' SUPERUSER;" 2>/dev/null
psql postgres -c "CREATE DATABASE contra OWNER contra;" 2>/dev/null
psql postgres -c "CREATE DATABASE indexer OWNER contra;" 2>/dev/null
```

## 4) Build Contra binaries and programs

From `./contra`, build escrow/withdraw programs and node/gateway/indexer binaries.
Use the command sequence in [`RUN.txt`](../RUN.txt) under `FIRST-TIME SETUP` and `START ALL SERVICES`.

## 5) Start Contra/Solana services

Start in this order (separate terminals):

1. Solana validator
2. Contra write node
3. Contra read node
4. Contra gateway
5. Indexer-solana
6. Indexer-contra
7. Operator-solana
8. Operator-contra

Reference commands are in [`RUN.txt`](../RUN.txt).

## 6) Bootstrap demo assets

From repo root:

```bash
bash scripts/setup-demo.sh
```

This creates local keypairs, demo token mints, and `.env.demo`.

Important: this repository does not currently include a committed escrow-instance creation helper script.
You must provide a valid `ESCROW_INSTANCE_ID` in `otc-server/.env` for deposit flows to work.

## 7) Point app services to local infra

In `otc-server/.env`, ensure:

- `CONTRA_GATEWAY_URL=http://localhost:8899`
- `SOLANA_VALIDATOR_URL=http://localhost:18899`
- `DEMO_TOKEN_MINTS` matches `.env.demo`
- `ESCROW_INSTANCE_ID` is set

In `otc-frontend/.env`, ensure:

- `VITE_CONTRA_GATEWAY_URL=http://localhost:8899`
- `VITE_SOLANA_VALIDATOR_URL=http://localhost:18899`
- `VITE_DEMO_TOKEN_MINTS` matches `.env.demo`

Then start `otc-server` and `otc-frontend` as in Path A.

## Environment Reference

## OTC Server (`otc-server/.env`)

- `OTC_PORT` (default `3001`)
- `WS_PORT` (default `3002`)
- `OTC_DB_PATH` (default `./otc.db`)
- `CONTRA_GATEWAY_URL` (required)
- `SOLANA_VALIDATOR_URL` (required)
- `ESCROW_PROGRAM_ID` (has fallback default in code)
- `WITHDRAW_PROGRAM_ID` (has fallback default in code)
- `ESCROW_INSTANCE_ID` (required for escrow deposit builder)
- `DEMO_TOKEN_MINTS` (recommended)
- `SUPABASE_URL` (required for email-role auth)
- `SUPABASE_SERVICE_ROLE_KEY` (required for email-role auth)
- `ZYPHE_WEBHOOK_URL` (required for KYC initiation to webhook service)
- `SAS_CREDENTIAL_PDA` (optional, required only for SAS attestation writes)
- `SAS_SCHEMA_PDA` (optional, required only for SAS attestation writes)
- `SAS_SIGNER_SECRET` (optional, required only for SAS attestation writes)
- `SAS_PAYER_PATH` (optional, defaults to `~/.config/solana/id.json`)

## Frontend (`otc-frontend/.env`)

- `VITE_API_PROXY_TARGET` (default `http://localhost:3001`)
- `VITE_WS_URL` (default `ws://localhost:3002`)
- `VITE_CONTRA_GATEWAY_URL` (required)
- `VITE_SOLANA_VALIDATOR_URL` (required)
- `VITE_DEMO_TOKEN_MINTS` (recommended)
- `VITE_SUPABASE_URL` (required for login/signup)
- `VITE_SUPABASE_ANON_KEY` (required for login/signup)
- `VITE_SAS_CREDENTIAL_PDA` (optional, for on-chain attestation reads)
- `VITE_SAS_SCHEMA_PDA` (optional, for on-chain attestation reads)

## Webhook (`webhook/.env`)

- `PORT` (default `8085`)
- `BACKEND_ORACLE_URL` (default `http://localhost:3001`)
- `FRONTEND_URL` (default `http://localhost:5173`)
- `ZYPHE_WEBHOOK_SECRET` (optional in current code path)

## Troubleshooting

- `CONTRA_GATEWAY_URL is not set`:
  - Ensure `otc-server/.env` exists and includes required values.
- `SOLANA_VALIDATOR_URL is not set`:
  - Same as above.
- `Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY`:
  - Add frontend Supabase variables before testing login/signup.
- `Mint ... is not allowed on escrow instance`:
  - Your mint is not registered for the current escrow instance.
- KYC page stuck in polling:
  - Confirm webhook service is running and `ZYPHE_WEBHOOK_URL` points to it.
- Health endpoint returns `degraded`:
  - API cannot reach configured Contra gateway RPC.

## Known Repo Gaps (Current State)

- `docker-compose.override.yml` references frontend/server Dockerfiles that are not committed in this repository.
- Full local escrow instance bootstrapping helper script is not committed (`create-escrow-instance.mjs` is gitignored).

Use the live demo + video for primary evaluation, and use this setup guide for technical reproducibility checks.
