/**
 * check-balances.ts — Display all mock stablecoin balances for your wallet
 * 
 * Usage:
 *   npx tsx check-balances.ts [WALLET_ADDRESS]
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || path.join(os.homedir(), ".config/solana/id.json");
const MINTS_FILE = "mint-addresses.json";

// Also check real devnet mints
const REAL_DEVNET_TOKENS: Record<string, { mint: string; decimals: number; programId: string }> = {
  "USDC (real)": {
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // legacy SPL Token
  },
  "PYUSD (real)": {
    mint: "CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM",
    decimals: 6,
    programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
  },
  "DUMMY (Credix)": {
    mint: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    decimals: 6,
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  },
};

async function main() {
  const walletArg = process.argv[2];

  let wallet: PublicKey;
  if (walletArg) {
    wallet = new PublicKey(walletArg);
  } else {
    const payer = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")))
    );
    wallet = payer.publicKey;
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const solBalance = await connection.getBalance(wallet);

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Stablecoin Balance Checker                              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Wallet:  ${wallet.toBase58()}`);
  console.log(`  SOL:     ${(solBalance / 1e9).toFixed(4)}`);
  console.log(`  Network: ${RPC_URL}`);
  console.log("");

  // Check mock tokens
  if (fs.existsSync(MINTS_FILE)) {
    const mints = JSON.parse(fs.readFileSync(MINTS_FILE, "utf-8"));
    console.log("  ─── Mock Stablecoins (from your mints) ───");

    for (const [symbol, config] of Object.entries(mints) as [string, any][]) {
      try {
        const programId = new PublicKey(config.programId);
        const ata = getAssociatedTokenAddressSync(
          new PublicKey(config.mint),
          wallet,
          false,
          programId
        );
        const account = await getAccount(connection, ata, "confirmed", programId);
        const balance = Number(account.amount) / 10 ** config.decimals;
        console.log(`  ${symbol.padEnd(10)} ${balance.toLocaleString().padStart(15)} │ ${config.mint}`);
      } catch {
        console.log(`  ${symbol.padEnd(10)} ${"0".padStart(15)} │ ${config.mint} (no ATA)`);
      }
    }
    console.log("");
  }

  // Check real devnet tokens
  console.log("  ─── Real Devnet Tokens ───");
  for (const [label, config] of Object.entries(REAL_DEVNET_TOKENS)) {
    try {
      const programId = new PublicKey(config.programId);
      const ata = getAssociatedTokenAddressSync(
        new PublicKey(config.mint),
        wallet,
        false,
        programId
      );
      const account = await getAccount(connection, ata, "confirmed", programId);
      const balance = Number(account.amount) / 10 ** config.decimals;
      console.log(`  ${label.padEnd(16)} ${balance.toLocaleString().padStart(15)} │ ${config.mint}`);
    } catch {
      console.log(`  ${label.padEnd(16)} ${"0".padStart(15)} │ ${config.mint} (no ATA)`);
    }
  }

  console.log("");
}

main().catch(console.error);
