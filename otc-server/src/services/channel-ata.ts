/**
 * Ensures that both parties in an atomic swap have channel ATAs for the
 * tokens they will RECEIVE. The Contra channel only creates ATAs during the
 * deposit flow, so if a receiver has never deposited a particular token,
 * their channel ATA won't exist and the swap will fail.
 *
 * Fix: The operator deposits 1 unit of the missing token into escrow with
 * `recipient = receiver_wallet`. The Contra indexer creates the ATA when
 * processing this deposit. Tokens are minted via the faucet authority.
 */

import {
  Keypair, PublicKey, Connection, Transaction, SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  createMintToInstruction, getAccount,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { readFileSync } from 'node:fs';
import { buildDepositInstruction } from './escrow.js';
import { getChannelBalance, VALIDATOR_URL } from './contra.js';

// ── Load operator + faucet keypairs ──────────────────────────────────────

function loadOperatorKeypair(): Keypair {
  const envSecret = process.env.FAUCET_MINT_AUTHORITY_SECRET || process.env.SAS_SIGNER_SECRET;
  if (envSecret) {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(envSecret)));
  }
  const keyPath = (process.env.SAS_PAYER_PATH || '~/.config/solana/id.json')
    .replace('~', process.env.HOME || '');
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(keyPath, 'utf-8'))));
}

function loadFaucetAuthority(): Keypair {
  const envSecret = process.env.FAUCET_MINT_AUTHORITY_SECRET;
  if (envSecret) {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(envSecret)));
  }
  return loadOperatorKeypair(); // fallback
}

// ── Core logic ───────────────────────────────────────────────────────────

/**
 * Check if a wallet has a channel ATA for a given token.
 */
async function hasChannelATA(walletAddress: string, mint: string): Promise<boolean> {
  const balance = await getChannelBalance(walletAddress, mint);
  return balance !== null; // null = account not found
}

/**
 * Create a channel ATA for `recipientWallet` by having the operator deposit
 * 1 unit of `mint` into the Contra escrow with `recipient = recipientWallet`.
 *
 * Steps:
 * 1. Ensure operator has an on-chain ATA for the mint (create + mint if needed)
 * 2. Build escrow deposit instruction with recipient = recipientWallet
 * 3. Sign and submit on-chain
 * 4. Wait for the Contra channel to credit the recipient (ATA creation)
 */
async function createChannelATA(
  recipientWallet: string,
  mint: string,
): Promise<void> {
  const connection = new Connection(VALIDATOR_URL, 'confirmed');
  const operator = loadOperatorKeypair();
  const faucet = loadFaucetAuthority();
  const mintPk = new PublicKey(mint);
  const recipientPk = new PublicKey(recipientWallet);

  // All demo tokens are Token-2022
  const tokenProgramId = TOKEN_2022_PROGRAM_ID;
  const depositAmount = 1n; // 1 raw unit (0.000001 with 6 decimals)

  // 1. Ensure operator has an on-chain ATA for this mint
  const operatorAta = await getAssociatedTokenAddress(
    mintPk, operator.publicKey, false, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction();
  let needsAta = false;

  try {
    await getAccount(connection, operatorAta, 'confirmed', tokenProgramId);
  } catch {
    // Operator ATA doesn't exist — create it
    tx.add(createAssociatedTokenAccountInstruction(
      operator.publicKey, operatorAta, operator.publicKey, mintPk,
      tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID,
    ));
    needsAta = true;
  }

  // 2. Mint 1 unit to operator (faucet authority is the mint authority)
  tx.add(createMintToInstruction(
    mintPk, operatorAta, faucet.publicKey, depositAmount,
    [], tokenProgramId,
  ));

  // 3. Build escrow deposit from operator with recipient = recipientWallet
  const { instruction: depositIx } = await buildDepositInstruction(
    operator.publicKey, mintPk, depositAmount, tokenProgramId, recipientPk,
  );
  tx.add(depositIx);

  // 4. Sign and submit on-chain
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = operator.publicKey;

  // Signers: operator (payer + depositor) + faucet (mint authority)
  const signers = operator.publicKey.equals(faucet.publicKey)
    ? [operator]
    : [operator, faucet];

  const sig = await connection.sendTransaction(tx, signers, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction(sig, 'confirmed');

  console.log(`[channel-ata] Deposited 1 unit of ${mint.slice(0, 8)}... to escrow for ${recipientWallet.slice(0, 8)}... (tx: ${sig})`);

  // 5. Wait for the Contra channel to credit the recipient (creates the ATA)
  for (let i = 0; i < 40; i++) {
    const balance = await getChannelBalance(recipientWallet, mint);
    if (balance !== null) {
      console.log(`[channel-ata] Channel ATA created for ${recipientWallet.slice(0, 8)}... / ${mint.slice(0, 8)}... after ${(i + 1) * 3}s`);
      return;
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  throw new Error(
    `Channel ATA for ${recipientWallet.slice(0, 8)}... / ${mint.slice(0, 8)}... was not created after 120s. ` +
    `The escrow deposit succeeded on-chain (${sig}) but the Contra indexer did not credit it.`
  );
}

/**
 * Ensure both parties in a swap have channel ATAs for the tokens they'll receive.
 *
 * - Originator (partyA) will receive buyToken → needs channel ATA for buyToken
 * - Provider (partyB) will receive sellToken → needs channel ATA for sellToken
 *
 * Creates missing ATAs via operator escrow deposits. Returns the list of ATAs created.
 */
export async function ensureChannelATAsForSwap(
  originatorWallet: string,
  providerWallet: string,
  sellToken: string,
  buyToken: string,
): Promise<string[]> {
  const created: string[] = [];

  // Check originator needs buyToken ATA
  const originatorHasBuyToken = await hasChannelATA(originatorWallet, buyToken);
  if (!originatorHasBuyToken) {
    console.log(`[channel-ata] Originator ${originatorWallet.slice(0, 8)}... missing channel ATA for buy token ${buyToken.slice(0, 8)}... — creating...`);
    await createChannelATA(originatorWallet, buyToken);
    created.push(`originator:${buyToken}`);
  }

  // Check provider needs sellToken ATA
  const providerHasSellToken = await hasChannelATA(providerWallet, sellToken);
  if (!providerHasSellToken) {
    console.log(`[channel-ata] Provider ${providerWallet.slice(0, 8)}... missing channel ATA for sell token ${sellToken.slice(0, 8)}... — creating...`);
    await createChannelATA(providerWallet, sellToken);
    created.push(`provider:${sellToken}`);
  }

  if (created.length > 0) {
    console.log(`[channel-ata] Created ${created.length} channel ATA(s): ${created.join(', ')}`);
  }

  return created;
}
