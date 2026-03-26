/**
 * mint-more.ts — Mint additional mock stablecoins to any wallet
 * 
 * Usage:
 *   npx tsx mint-more.ts <SYMBOL> <AMOUNT> [RECIPIENT_WALLET]
 * 
 * Examples:
 *   npx tsx mint-more.ts USDC 500000                      # mint 500k to yourself
 *   npx tsx mint-more.ts CHF 100000 AbC123...pubkey...     # mint 100k to another wallet
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

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || path.join(os.homedir(), ".config/solana/id.json");
const MINTS_FILE = "mint-addresses.json";

async function main() {
  const [,, symbol, amountStr, recipientStr] = process.argv;

  if (!symbol || !amountStr) {
    console.log("Usage: npx tsx mint-more.ts <SYMBOL> <AMOUNT> [RECIPIENT_WALLET]");
    console.log("");
    console.log("Examples:");
    console.log("  npx tsx mint-more.ts USDC 500000");
    console.log("  npx tsx mint-more.ts CHF 100000 AbC123...");
    process.exit(1);
  }

  // Load config
  if (!fs.existsSync(MINTS_FILE)) {
    console.error(`Error: ${MINTS_FILE} not found. Run create-mocks-with-metadata.ts first.`);
    process.exit(1);
  }

  const mints = JSON.parse(fs.readFileSync(MINTS_FILE, "utf-8"));
  const tokenConfig = mints[symbol.toUpperCase()];

  if (!tokenConfig) {
    console.error(`Error: ${symbol} not found in ${MINTS_FILE}`);
    console.log(`Available: ${Object.keys(mints).join(", ")}`);
    process.exit(1);
  }

  const amount = parseInt(amountStr);
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")))
  );
  const recipient = recipientStr ? new PublicKey(recipientStr) : payer.publicKey;
  const mintPubkey = new PublicKey(tokenConfig.mint);
  const connection = new Connection(RPC_URL, "confirmed");

  console.log(`Minting ${amount.toLocaleString()} ${symbol} to ${recipient.toBase58()}`);

  // Ensure ATA exists
  const ata = getAssociatedTokenAddressSync(
    mintPubkey,
    recipient,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction();

  try {
    await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch {
    console.log("  Creating token account...");
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

  const rawAmount = BigInt(amount) * BigInt(10 ** tokenConfig.decimals);
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

  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  console.log(`  ✅ Done! Signature: ${sig}`);
  console.log(`  Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch(console.error);
