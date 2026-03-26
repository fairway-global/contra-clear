/**
 * create-mocks-with-metadata.ts
 * 
 * Creates mock stablecoin Token-2022 mints on Solana devnet with on-chain metadata.
 * Each token appears with proper name/symbol in Phantom, Solflare, etc.
 * 
 * Usage:
 *   npm install
 *   npx tsx create-mocks-with-metadata.ts
 * 
 * Optional env vars:
 *   KEYPAIR_PATH  — path to your keypair (default: ~/.config/solana/id.json)
 *   RPC_URL       — devnet RPC (default: https://api.devnet.solana.com)
 *   SUPPLY        — initial supply per token (default: 1000000)
 */

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  ExtensionType,
  createInitializeMetadataPointerInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || path.join(os.homedir(), ".config/solana/id.json");
const INITIAL_SUPPLY = parseInt(process.env.SUPPLY || "1000000");
const DECIMALS = 6;
const OUTPUT_FILE = "mint-addresses.json";

interface StablecoinConfig {
  symbol: string;
  name: string;
  uri: string; // metadata JSON URI (can be empty)
}

// ============================================================================
// HOW ICONS WORK:
// ============================================================================
// Phantom fetches the `uri` field via HTTP → expects a JSON with an `image` key.
// 
// STEP 1: Run `npx tsx generate-metadata.ts` to create metadata/ folder
// STEP 2: Host the metadata/ folder (see options below)
// STEP 3: Replace METADATA_BASE_URL with your hosted URL
// STEP 4: Run this script to create mints
//
// Hosting options:
//   GitHub:    "https://raw.githubusercontent.com/YOU/REPO/main/metadata"
//   npoint.io: paste each JSON → get URL per token (free, no signup)
//   Arweave:   permanent hosting via arkb or irys
// ============================================================================

// CHANGE THIS to your hosted metadata URL base:
const METADATA_BASE_URL = "https://raw.githubusercontent.com/fairway-global/otc-stablecoins/main/metadata"
function metadataUri(symbol: string): string {
  if (METADATA_BASE_URL) {
    return `${METADATA_BASE_URL}/${symbol}.json`;
  }
  // Fallback: try to read local metadata and create an inline data URI
  try {
    const jsonPath = `./metadata/${symbol}.json`;
    const content = fs.readFileSync(jsonPath, "utf-8");
    // NOTE: data URIs may not work in all wallets, hosting is recommended
    return `data:application/json;base64,${Buffer.from(content).toString("base64")}`;
  } catch {
    return ""; // no metadata, Phantom will show name/symbol only
  }
}

const STABLECOINS: StablecoinConfig[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    uri: "", // filled dynamically below
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    uri: "",
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    uri: "",
  },
  {
    symbol: "PYUSD",
    name: "PayPal USD",
    uri: "",
  },
  {
    symbol: "USDG",
    name: "Global Dollar",
    uri: "",
  },
  {
    symbol: "USX",
    name: "USX",
    uri: "",
  },
  {
    symbol: "CHF",
    name: "Swiss Franc Stable",
    uri: "",
  },
  {
    symbol: "GBP",
    name: "British Pound Stable",
    uri: "",
  },
  {
    symbol: "JPY",
    name: "Japanese Yen Stable",
    uri: "",
  },
  {
    symbol: "SGD",
    name: "Singapore Dollar Stable",
    uri: "",
  },
  {
    symbol: "AED",
    name: "UAE Dirham Stable",
    uri: "",
  },
];

// Resolve URIs at runtime
for (const coin of STABLECOINS) {
  coin.uri = metadataUri(coin.symbol);
}

// ============================================================================
// Helpers
// ============================================================================

function loadKeypair(filepath: string): Keypair {
  const raw = fs.readFileSync(filepath, "utf-8");
  const secretKey = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}

function formatSupply(amount: number, decimals: number): string {
  return (amount).toLocaleString();
}

async function ensureBalance(connection: Connection, wallet: PublicKey): Promise<void> {
  const balance = await connection.getBalance(wallet);
  const solBalance = balance / 1e9;
  console.log(`  Wallet balance: ${solBalance.toFixed(4)} SOL`);

  if (solBalance < 0.5) {
    console.log("  Low balance — requesting airdrop...");
    try {
      const sig = await connection.requestAirdrop(wallet, 2e9);
      await connection.confirmTransaction(sig, "confirmed");
      console.log("  Airdrop received: 2 SOL");
    } catch (e) {
      console.log("  Airdrop failed. Fund manually: solana airdrop 2");
      console.log("  Or use https://faucet.solana.com");
    }
  }
}

// ============================================================================
// Main: Create a single Token-2022 mint with metadata
// ============================================================================

async function createMockStablecoin(
  connection: Connection,
  payer: Keypair,
  config: StablecoinConfig
): Promise<{ mint: string; ata: string }> {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;

  // Build the metadata
  const metadata: TokenMetadata = {
    mint: mint,
    name: config.name,
    symbol: config.symbol,
    uri: config.uri,
    additionalMetadata: [
      ["description", `Mock ${config.symbol} stablecoin for OTC desk testing on devnet`],
      ["decimals", DECIMALS.toString()],
    ],
  };

  // Calculate space needed
  const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
  const metadataLen = pack(metadata).length;
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const lamports = await connection.getMinimumBalanceForRentExemption(
    mintLen + metadataExtension + metadataLen
  );

  // Build transaction
  const tx = new Transaction().add(
    // 1. Create the account
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),

    // 2. Initialize metadata pointer (points to itself)
    createInitializeMetadataPointerInstruction(
      mint,
      payer.publicKey,  // authority
      mint,             // metadata address = the mint itself
      TOKEN_2022_PROGRAM_ID
    ),

    // 3. Initialize the mint
    createInitializeMintInstruction(
      mint,
      DECIMALS,
      payer.publicKey,  // mint authority
      payer.publicKey,  // freeze authority (needed for stablecoin compliance testing)
      TOKEN_2022_PROGRAM_ID
    ),

    // 4. Initialize metadata on the mint
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint,
      metadata: mint,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority: payer.publicKey,
      updateAuthority: payer.publicKey,
    })
  );

  // Send create mint transaction
  await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair], {
    commitment: "confirmed",
  });

  // 5. Create ATA for the payer
  const ata = getAssociatedTokenAddressSync(
    mint,
    payer.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      payer.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, createAtaTx, [payer], {
    commitment: "confirmed",
  });

  // 6. Mint initial supply
  const rawAmount = BigInt(INITIAL_SUPPLY) * BigInt(10 ** DECIMALS);
  const mintToTx = new Transaction().add(
    createMintToInstruction(
      mint,
      ata,
      payer.publicKey,
      rawAmount,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, mintToTx, [payer], {
    commitment: "confirmed",
  });

  return { mint: mint.toBase58(), ata: ata.toBase58() };
}

// ============================================================================
// Runner
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Solana Mock Stablecoin Factory              ║");
  console.log("║  Token-2022 with on-chain metadata           ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");

  // Load keypair
  console.log(`Loading keypair from: ${KEYPAIR_PATH}`);
  const payer = loadKeypair(KEYPAIR_PATH);
  console.log(`  Wallet: ${payer.publicKey.toBase58()}`);

  // Connect
  const connection = new Connection(RPC_URL, "confirmed");
  console.log(`  RPC:    ${RPC_URL}`);
  await ensureBalance(connection, payer.publicKey);
  console.log("");

  // Create each mock stablecoin
  const results: Record<string, any> = {};

  for (const config of STABLECOINS) {
    console.log(`━━━ ${config.symbol}: ${config.name} ━━━`);

    try {
      const { mint, ata } = await createMockStablecoin(connection, payer, config);
      console.log(`  ✅ Mint:    ${mint}`);
      console.log(`  ✅ ATA:     ${ata}`);
      console.log(`  ✅ Supply:  ${formatSupply(INITIAL_SUPPLY, DECIMALS)} ${config.symbol}`);
      console.log("");

      results[config.symbol] = {
        mint,
        ata,
        name: config.name,
        symbol: config.symbol,
        decimals: DECIMALS,
        initialSupply: INITIAL_SUPPLY,
        program: "Token-2022",
        programId: TOKEN_2022_PROGRAM_ID.toBase58(),
      };
    } catch (err: any) {
      console.log(`  ❌ Failed: ${err.message}`);
      console.log(`     Trying next token...`);
      console.log("");
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Done! All mints created.                    ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
  console.log(`Config saved to: ${OUTPUT_FILE}`);
  console.log("");
  console.log("Summary:");
  console.log("─────────────────────────────────────────");
  for (const [sym, data] of Object.entries(results)) {
    console.log(`  ${sym.padEnd(8)} ${(data as any).mint}`);
  }
  console.log("─────────────────────────────────────────");
  console.log("");
  console.log("Import into your OTC desk:");
  console.log(`  import mints from './${OUTPUT_FILE}';`);
  console.log(`  const usdcMint = new PublicKey(mints.USDC.mint);`);
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
