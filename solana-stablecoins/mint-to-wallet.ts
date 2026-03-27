/**
 * mint-to-wallet.ts — Mint 100 of each mock stablecoin to a wallet
 *
 * Usage:
 *   npx tsx mint-to-wallet.ts
 *
 * Change RECIPIENT below to the target wallet address.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// CHANGE THIS to the target wallet address
// ============================================================================
const RECIPIENT = "4BMEZwL7XzjhNDLt5wAceh5KCp5Yh2Hystf5Cmk2dFSE";
const AMOUNT = 100; // tokens (human-readable, before decimals)
// ============================================================================

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || path.join(os.homedir(), ".config/solana/id.json");
const MINTS_FILE = "mint-addresses.json";

async function main() {
  // Load mint authority keypair
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")))
  );

  // Load all token configs
  const mints = JSON.parse(fs.readFileSync(MINTS_FILE, "utf-8"));
  const symbols = Object.keys(mints);

  const connection = new Connection(RPC_URL, "confirmed");
  const recipient = new PublicKey(RECIPIENT);

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Mint 100 of each token to wallet            ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Recipient:  ${recipient.toBase58()}`);
  console.log(`  Amount:     ${AMOUNT} per token`);
  console.log(`  Tokens:     ${symbols.join(", ")}`);
  console.log(`  Payer/Auth: ${payer.publicKey.toBase58()}`);
  console.log("");

  for (const symbol of symbols) {
    const config = mints[symbol];
    const mintPubkey = new PublicKey(config.mint);
    const decimals: number = config.decimals;
    const rawAmount = BigInt(AMOUNT) * BigInt(10 ** decimals);

    const ata = getAssociatedTokenAddressSync(
      mintPubkey,
      recipient,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction();

    // Create ATA if it doesn't exist
    try {
      await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          ata,
          recipient,
          mintPubkey,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    // Mint tokens
    tx.add(
      createMintToInstruction(
        mintPubkey,
        ata,
        payer.publicKey,
        rawAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
        commitment: "confirmed",
      });
      console.log(`  ✅ ${symbol.padEnd(6)} — ${AMOUNT} minted → https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    } catch (err: any) {
      console.log(`  ❌ ${symbol.padEnd(6)} — ${err.message}`);
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("");
  console.log("Done!");
}

main().catch(console.error);
