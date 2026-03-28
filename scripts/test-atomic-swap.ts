/**
 * End-to-end test for the atomic swap on Contra channel.
 *
 * Steps:
 * 1. Create two fresh keypairs (walletA, walletB)
 * 2. Airdrop SOL to both on devnet for tx fees
 * 3. Pick two demo token mints from .env
 * 4. Mint tokens to both wallets (via faucet authority in .env)
 * 5. Deposit tokens into Contra escrow (on-chain)
 * 6. Build the atomic swap transaction (single tx, two signers)
 * 7. Both wallets partially sign
 * 8. Assemble + submit to Contra
 * 9. Verify balances — both got their tokens
 *
 * Usage: cd otc-server && npx tsx ../scripts/test-atomic-swap.ts
 */

import 'dotenv/config';
import {
  Keypair, Connection, PublicKey, Transaction,
  TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL,
  SystemProgram, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress, createTransferInstruction,
  createAssociatedTokenAccountInstruction, createMintToInstruction,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount,
} from '@solana/spl-token';
import nacl from 'tweetnacl';
import { readFileSync } from 'node:fs';

// ── Config ───────────────────────────────────────────────────────────────

const GATEWAY_URL = process.env.CONTRA_GATEWAY_URL || 'http://35.228.38.233:8899';
const VALIDATOR_URL = process.env.SOLANA_VALIDATOR_URL || 'https://api.devnet.solana.com';
const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);
const ESCROW_PROGRAM_ID = new PublicKey(process.env.ESCROW_PROGRAM_ID || 'GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83');
const ESCROW_INSTANCE_ID = process.env.ESCROW_INSTANCE_ID || '';

// Faucet / mint authority from .env
const FAUCET_SECRET = process.env.FAUCET_MINT_AUTHORITY_SECRET;
const faucetKeypair = FAUCET_SECRET
  ? Keypair.fromSecretKey(new Uint8Array(JSON.parse(FAUCET_SECRET)))
  : null;

// Operator keypair (for SOL transfers and escrow deposits on behalf of test wallets)
const OPERATOR_PATH = process.env.SAS_PAYER_PATH?.replace('~', process.env.HOME || '');
let operatorKeypair: Keypair | null = null;
try {
  if (OPERATOR_PATH) {
    const raw = JSON.parse(readFileSync(OPERATOR_PATH, 'utf-8'));
    operatorKeypair = Keypair.fromSecretKey(new Uint8Array(raw));
  }
} catch { /* ignore */ }

const devnet = new Connection(VALIDATOR_URL, 'confirmed');

function log(msg: string) {
  console.log(`[atomic-swap-test] ${msg}`);
}

// ── RPC helpers ──────────────────────────────────────────────────────────

async function rpcCall(url: string, method: string, params: any[] = []): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

async function getChannelTokenBalance(wallet: PublicKey, mint: PublicKey): Promise<bigint> {
  // Contra channel uses TOKEN_PROGRAM_ID for ATA derivation regardless of on-chain program
  const ata = await getAssociatedTokenAddress(mint, wallet, false, TOKEN_PROGRAM_ID);
  try {
    const result = await rpcCall(GATEWAY_URL, 'getTokenAccountBalance', [ata.toString()]);
    return BigInt(result?.value?.amount || '0');
  } catch {
    return 0n;
  }
}

async function sendRawToGateway(rawBase64: string): Promise<string> {
  return rpcCall(GATEWAY_URL, 'sendTransaction', [rawBase64, { skipPreflight: true, encoding: 'base64' }]);
}

async function waitForConfirmation(url: string, sig: string, maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await rpcCall(url, 'getTransaction', [sig, { encoding: 'json' }]);
      if (result) return true;
    } catch { /* not found yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// ── Build escrow deposit instruction ─────────────────────────────────────

async function buildEscrowDeposit(user: PublicKey, mint: PublicKey, amount: bigint): Promise<Transaction> {
  const instancePda = new PublicKey(ESCROW_INSTANCE_ID);
  const [allowedMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('allowed_mint'), instancePda.toBuffer(), mint.toBuffer()],
    ESCROW_PROGRAM_ID,
  );
  const userAta = await getAssociatedTokenAddress(mint, user, false, TOKEN_2022_PROGRAM_ID);
  const instanceAta = await getAssociatedTokenAddress(mint, instancePda, true, TOKEN_2022_PROGRAM_ID);
  const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from('event_authority')], ESCROW_PROGRAM_ID);

  const discriminator = Buffer.from([6]);
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);
  const data = Buffer.concat([discriminator, amountBuf, Buffer.from([0])]);

  const keys = [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: false },
    { pubkey: instancePda, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: allowedMintPda, isSigner: false, isWritable: false },
    { pubkey: userAta, isSigner: false, isWritable: true },
    { pubkey: instanceAta, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: ESCROW_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const tx = new Transaction();
  tx.add({ keys, programId: ESCROW_PROGRAM_ID, data });
  tx.recentBlockhash = (await devnet.getLatestBlockhash()).blockhash;
  tx.feePayer = user;
  return tx;
}

// ── Main test ────────────────────────────────────────────────────────────

async function main() {
  log('Starting atomic swap end-to-end test');

  if (!ESCROW_INSTANCE_ID) throw new Error('ESCROW_INSTANCE_ID not set in .env');
  if (DEMO_MINTS.length < 2) throw new Error('Need at least 2 DEMO_TOKEN_MINTS in .env');
  if (!operatorKeypair) throw new Error('Operator keypair not found');

  // Pick two tokens
  const mintA = new PublicKey(DEMO_MINTS[0]); // Token A: walletA sells to walletB
  const mintB = new PublicKey(DEMO_MINTS[1]); // Token B: walletB sells to walletA

  // 1. Create two fresh wallets
  const walletA = Keypair.generate();
  const walletB = Keypair.generate();
  log(`Wallet A: ${walletA.publicKey.toBase58()}`);
  log(`Wallet B: ${walletB.publicKey.toBase58()}`);
  log(`Token A (sell): ${mintA.toBase58()}`);
  log(`Token B (buy):  ${mintB.toBase58()}`);

  // 2. Fund wallets with SOL from operator
  const FUND_SOL = 0.05 * LAMPORTS_PER_SOL;
  log('Funding wallets with SOL from operator...');
  {
    const tx = new Transaction();
    tx.add(
      SystemProgram.transfer({ fromPubkey: operatorKeypair.publicKey, toPubkey: walletA.publicKey, lamports: FUND_SOL }),
      SystemProgram.transfer({ fromPubkey: operatorKeypair.publicKey, toPubkey: walletB.publicKey, lamports: FUND_SOL }),
    );
    const sig = await sendAndConfirmTransaction(devnet, tx, [operatorKeypair]);
    log(`SOL funded: ${sig}`);
  }

  // 3. Create ATAs and mint tokens
  const SWAP_AMOUNT = 1_000_000n; // 1 token (6 decimals)

  log('Creating token accounts and minting...');
  {
    const tx = new Transaction();
    // ATAs for walletA (Token-2022)
    const ataA_mintA = await getAssociatedTokenAddress(mintA, walletA.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const ataA_mintB = await getAssociatedTokenAddress(mintB, walletA.publicKey, false, TOKEN_2022_PROGRAM_ID);
    // ATAs for walletB (Token-2022)
    const ataB_mintA = await getAssociatedTokenAddress(mintA, walletB.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const ataB_mintB = await getAssociatedTokenAddress(mintB, walletB.publicKey, false, TOKEN_2022_PROGRAM_ID);

    // Create all ATAs (Token-2022)
    tx.add(
      createAssociatedTokenAccountInstruction(operatorKeypair.publicKey, ataA_mintA, walletA.publicKey, mintA, TOKEN_2022_PROGRAM_ID),
      createAssociatedTokenAccountInstruction(operatorKeypair.publicKey, ataA_mintB, walletA.publicKey, mintB, TOKEN_2022_PROGRAM_ID),
      createAssociatedTokenAccountInstruction(operatorKeypair.publicKey, ataB_mintA, walletB.publicKey, mintA, TOKEN_2022_PROGRAM_ID),
      createAssociatedTokenAccountInstruction(operatorKeypair.publicKey, ataB_mintB, walletB.publicKey, mintB, TOKEN_2022_PROGRAM_ID),
    );

    if (faucetKeypair) {
      // Mint BOTH tokens to BOTH wallets (so both can deposit both, creating all 4 channel ATAs)
      const DEPOSIT_AMOUNT = 1n; // Tiny amount just to create channel ATA for receiving token
      tx.add(
        createMintToInstruction(mintA, ataA_mintA, faucetKeypair.publicKey, SWAP_AMOUNT, [], TOKEN_2022_PROGRAM_ID),
        createMintToInstruction(mintB, ataB_mintB, faucetKeypair.publicKey, SWAP_AMOUNT, [], TOKEN_2022_PROGRAM_ID),
        // Mint tiny amount of the OTHER token to each wallet (for channel ATA creation)
        createMintToInstruction(mintB, ataA_mintB, faucetKeypair.publicKey, DEPOSIT_AMOUNT, [], TOKEN_2022_PROGRAM_ID),
        createMintToInstruction(mintA, ataB_mintA, faucetKeypair.publicKey, DEPOSIT_AMOUNT, [], TOKEN_2022_PROGRAM_ID),
      );
      const signers = [operatorKeypair, faucetKeypair];
      const sig = await sendAndConfirmTransaction(devnet, tx, signers);
      log(`ATAs created + tokens minted: ${sig}`);
    } else {
      throw new Error('Faucet mint authority not found — cannot mint tokens');
    }
  }

  // 4. Deposit tokens into Contra escrow (all 4 deposits to create all channel ATAs)
  log('Depositing tokens into Contra (4 deposits for all channel ATAs)...');
  {
    // Main deposits: walletA deposits tokenA, walletB deposits tokenB
    const txA = await buildEscrowDeposit(walletA.publicKey, mintA, SWAP_AMOUNT);
    const sigA = await sendAndConfirmTransaction(devnet, txA, [walletA]);
    log(`  WalletA tokenA deposit: ${sigA}`);

    const txB = await buildEscrowDeposit(walletB.publicKey, mintB, SWAP_AMOUNT);
    const sigB = await sendAndConfirmTransaction(devnet, txB, [walletB]);
    log(`  WalletB tokenB deposit: ${sigB}`);

    // Small deposits to create receiver ATAs on channel
    const txA2 = await buildEscrowDeposit(walletA.publicKey, mintB, 1n);
    const sigA2 = await sendAndConfirmTransaction(devnet, txA2, [walletA]);
    log(`  WalletA tokenB deposit (ATA creation): ${sigA2}`);

    const txB2 = await buildEscrowDeposit(walletB.publicKey, mintA, 1n);
    const sigB2 = await sendAndConfirmTransaction(devnet, txB2, [walletB]);
    log(`  WalletB tokenA deposit (ATA creation): ${sigB2}`);
  }

  // Wait for ALL 4 deposits to be credited on channel (all accounts must exist)
  log('Waiting for all 4 deposits to be credited on Contra channel (polling up to 120s)...');
  let balA_before = 0n;
  let balB_before = 0n;
  let allCredited = false;
  for (let i = 0; i < 40; i++) {
    balA_before = await getChannelTokenBalance(walletA.publicKey, mintA);
    balB_before = await getChannelTokenBalance(walletB.publicKey, mintB);
    const balA_mintB = await getChannelTokenBalance(walletA.publicKey, mintB);
    const balB_mintA = await getChannelTokenBalance(walletB.publicKey, mintA);
    if (balA_before > 0n && balB_before > 0n && balA_mintB > 0n && balB_mintA > 0n) {
      allCredited = true;
      log(`  All 4 accounts credited after ${i + 1} polls`);
      break;
    }
    if (i % 5 === 0) log(`  Poll ${i + 1}/40: A-tokenA=${balA_before}, B-tokenB=${balB_before}, A-tokenB=${balA_mintB}, B-tokenA=${balB_mintA}`);
    await new Promise(r => setTimeout(r, 3000));
  }

  if (!allCredited) {
    throw new Error('Not all 4 channel accounts were credited. Check the indexer.');
  }

  const balA_mintB_before = await getChannelTokenBalance(walletA.publicKey, mintB);
  const balB_mintA_before = await getChannelTokenBalance(walletB.publicKey, mintA);
  log(`Channel balances before swap:`);
  log(`  WalletA tokenA: ${balA_before}`);
  log(`  WalletA tokenB: ${balA_mintB_before}`);
  log(`  WalletB tokenA: ${balB_mintA_before}`);
  log(`  WalletB tokenB: ${balB_before}`);

  if (balA_before === 0n || balB_before === 0n) {
    throw new Error('Main deposits not credited on Contra channel after 90s. Check the gateway/indexer.');
  }

  // 5. Build atomic swap transaction
  log('Building atomic swap transaction...');

  // Contra channel uses TOKEN_PROGRAM_ID for ATAs regardless of on-chain token program
  const ataA_sellFrom = await getAssociatedTokenAddress(mintA, walletA.publicKey, false, TOKEN_PROGRAM_ID);
  const ataB_sellTo = await getAssociatedTokenAddress(mintA, walletB.publicKey, false, TOKEN_PROGRAM_ID);
  const ataB_buyFrom = await getAssociatedTokenAddress(mintB, walletB.publicKey, false, TOKEN_PROGRAM_ID);
  const ataA_buyTo = await getAssociatedTokenAddress(mintB, walletA.publicKey, false, TOKEN_PROGRAM_ID);

  // Leg A: walletA sends tokenA to walletB (on Contra channel, uses TOKEN_PROGRAM_ID)
  const legA = createTransferInstruction(ataA_sellFrom, ataB_sellTo, walletA.publicKey, SWAP_AMOUNT, [], TOKEN_PROGRAM_ID);
  // Leg B: walletB sends tokenB to walletA (on Contra channel, uses TOKEN_PROGRAM_ID)
  const legB = createTransferInstruction(ataB_buyFrom, ataA_buyTo, walletB.publicKey, SWAP_AMOUNT, [], TOKEN_PROGRAM_ID);

  const { blockhash } = await rpcCall(GATEWAY_URL, 'getLatestBlockhash', [{ commitment: 'confirmed' }]).then((r: any) => r.value);

  const messageV0 = new TransactionMessage({
    payerKey: walletA.publicKey,
    recentBlockhash: blockhash,
    instructions: [legA, legB],
  }).compileToV0Message();

  const vtx = VersionedTransaction.deserialize(new VersionedTransaction(messageV0).serialize());

  // Verify we have 2 required signers
  const numSigners = vtx.message.header.numRequiredSignatures;
  const signerKeys = vtx.message.staticAccountKeys.slice(0, numSigners).map(k => k.toBase58());
  log(`Required signers (${numSigners}): ${signerKeys.join(', ')}`);

  if (numSigners !== 2) {
    throw new Error(`Expected 2 required signers, got ${numSigners}`);
  }

  // 6. Both wallets sign their slot
  log('Wallet A signing...');
  const messageBytes = vtx.message.serialize();
  const sigA = nacl.sign.detached(messageBytes, walletA.secretKey);
  const sigB = nacl.sign.detached(messageBytes, walletB.secretKey);

  // Find the correct signature slot for each wallet
  for (let i = 0; i < numSigners; i++) {
    const key = vtx.message.staticAccountKeys[i].toBase58();
    if (key === walletA.publicKey.toBase58()) {
      vtx.signatures[i] = sigA;
    } else if (key === walletB.publicKey.toBase58()) {
      vtx.signatures[i] = sigB;
    }
  }
  log('Both wallets signed.');

  // 7. Submit to Contra
  log('Submitting fully-signed atomic swap to Contra...');
  const serialized = Buffer.from(vtx.serialize()).toString('base64');
  const txSig = await sendRawToGateway(serialized);
  log(`Atomic swap submitted: ${txSig}`);

  // 8. Wait for swap to take effect by polling balances
  //    (gateway doesn't support getTransaction, so we check balance changes)
  log('Waiting for atomic swap to settle (polling balances)...');
  let swapSuccess = false;
  for (let i = 0; i < 15; i++) {
    const balA_tokenA_now = await getChannelTokenBalance(walletA.publicKey, mintA);
    const balA_tokenB_now = await getChannelTokenBalance(walletA.publicKey, mintB);
    const balB_tokenA_now = await getChannelTokenBalance(walletB.publicKey, mintA);
    const balB_tokenB_now = await getChannelTokenBalance(walletB.publicKey, mintB);

    // Check if balances changed (swap executed)
    if (balA_tokenA_now < balA_before && balA_tokenB_now > balA_mintB_before) {
      swapSuccess = true;
      log(`Swap detected after ${i + 1} polls!`);
      break;
    }
    if (i % 3 === 0) log(`  Poll ${i + 1}/15: A-tokenA=${balA_tokenA_now}, A-tokenB=${balA_tokenB_now}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  // 9. Verify final balances
  const balA_tokenA_after = await getChannelTokenBalance(walletA.publicKey, mintA);
  const balA_tokenB_after = await getChannelTokenBalance(walletA.publicKey, mintB);
  const balB_tokenA_after = await getChannelTokenBalance(walletB.publicKey, mintA);
  const balB_tokenB_after = await getChannelTokenBalance(walletB.publicKey, mintB);

  log('Channel balances after swap:');
  log(`  WalletA tokenA: ${balA_tokenA_after} (was ${balA_before})`);
  log(`  WalletA tokenB: ${balA_tokenB_after} (was ${balA_mintB_before})`);
  log(`  WalletB tokenA: ${balB_tokenA_after} (was ${balB_mintA_before})`);
  log(`  WalletB tokenB: ${balB_tokenB_after} (was ${balB_before})`);

  // Validate: walletA lost SWAP_AMOUNT of tokenA and gained SWAP_AMOUNT of tokenB
  const aLostTokenA = balA_tokenA_after === balA_before - SWAP_AMOUNT;
  const aGainedTokenB = balA_tokenB_after === balA_mintB_before + SWAP_AMOUNT;
  const bGainedTokenA = balB_tokenA_after === balB_mintA_before + SWAP_AMOUNT;
  const bLostTokenB = balB_tokenB_after === balB_before - SWAP_AMOUNT;

  if (aLostTokenA && aGainedTokenB && bGainedTokenA && bLostTokenB) {
    log('SUCCESS: Atomic swap worked correctly! Both parties received their tokens.');
  } else if (!swapSuccess) {
    log('Swap did not execute (balances unchanged). Checking signature status...');
    const statusRes = await rpcCall(GATEWAY_URL, 'getSignatureStatuses', [[txSig]]);
    log(`Signature status: ${JSON.stringify(statusRes?.value?.[0] || 'not found')}`);
    log('FAILURE: Atomic swap did not execute. Check the error above.');
    process.exit(1);
  } else {
    log('FAILURE: Balance mismatch after atomic swap!');
    process.exit(1);
  }

  // 10. Test atomicity: Submit tx with only ONE signature, verify balances DON'T change
  //     (Gateway accepts all txs but silently fails invalid ones)
  log('\n--- Atomicity test: Submit with only walletA signature (balances should not change) ---');

  // Snapshot current balances
  const snap_A_tokenB = await getChannelTokenBalance(walletA.publicKey, mintB);
  const snap_B_tokenA = await getChannelTokenBalance(walletB.publicKey, mintA);

  // Build a new swap tx (walletB sends tokenA to walletA, walletA sends tokenB to walletB)
  const { blockhash: bh2 } = await rpcCall(GATEWAY_URL, 'getLatestBlockhash', [{ commitment: 'confirmed' }]).then((r: any) => r.value);
  const reverseA = createTransferInstruction(
    await getAssociatedTokenAddress(mintB, walletA.publicKey, false, TOKEN_PROGRAM_ID),
    await getAssociatedTokenAddress(mintB, walletB.publicKey, false, TOKEN_PROGRAM_ID),
    walletA.publicKey, SWAP_AMOUNT, [], TOKEN_PROGRAM_ID,
  );
  const reverseB = createTransferInstruction(
    await getAssociatedTokenAddress(mintA, walletB.publicKey, false, TOKEN_PROGRAM_ID),
    await getAssociatedTokenAddress(mintA, walletA.publicKey, false, TOKEN_PROGRAM_ID),
    walletB.publicKey, SWAP_AMOUNT, [], TOKEN_PROGRAM_ID,
  );
  const msg2 = new TransactionMessage({
    payerKey: walletA.publicKey,
    recentBlockhash: bh2,
    instructions: [reverseA, reverseB],
  }).compileToV0Message();
  const vtx2 = VersionedTransaction.deserialize(new VersionedTransaction(msg2).serialize());

  // Only sign with walletA (leave walletB's slot as zeros)
  const sigA_only = nacl.sign.detached(vtx2.message.serialize(), walletA.secretKey);
  for (let i = 0; i < vtx2.message.header.numRequiredSignatures; i++) {
    if (vtx2.message.staticAccountKeys[i].toBase58() === walletA.publicKey.toBase58()) {
      vtx2.signatures[i] = sigA_only;
    }
  }

  const serialized2 = Buffer.from(vtx2.serialize()).toString('base64');
  await sendRawToGateway(serialized2); // Gateway accepts it but tx should fail

  // Wait a bit and check balances haven't changed
  await new Promise(r => setTimeout(r, 3000));
  const post_A_tokenB = await getChannelTokenBalance(walletA.publicKey, mintB);
  const post_B_tokenA = await getChannelTokenBalance(walletB.publicKey, mintA);

  if (post_A_tokenB === snap_A_tokenB && post_B_tokenA === snap_B_tokenA) {
    log('PASS: Single-signature tx did NOT execute — balances unchanged. Atomicity verified!');
  } else {
    log(`FAILURE: Balances changed! A-tokenB: ${snap_A_tokenB} → ${post_A_tokenB}, B-tokenA: ${snap_B_tokenA} → ${post_B_tokenA}`);
    process.exit(1);
  }

  log('\nAll tests passed!');
}

main().catch((err) => {
  console.error('[atomic-swap-test] FATAL:', err);
  process.exit(1);
});
