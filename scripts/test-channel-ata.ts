/**
 * Test that ensureChannelATAsForSwap correctly creates missing channel ATAs.
 *
 * 1. Create two wallets
 * 2. Fund with SOL, mint + deposit only their respective tokens (not the other)
 * 3. Verify the RECEIVING token ATA is missing on channel
 * 4. Call ensureChannelATAsForSwap
 * 5. Verify both receiving ATAs now exist
 * 6. Run the atomic swap
 * 7. Verify balances
 *
 * Usage: cd otc-server && npx tsx ../scripts/test-channel-ata.ts
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
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import nacl from 'tweetnacl';
import { readFileSync } from 'node:fs';
// Run from otc-server dir: cd otc-server && npx tsx ../scripts/test-channel-ata.ts
import { ensureChannelATAsForSwap } from './src/services/channel-ata.js';
import { getChannelBalance, GATEWAY_URL } from './src/services/contra.js';

const VALIDATOR_URL = process.env.SOLANA_VALIDATOR_URL || 'https://api.devnet.solana.com';
const DEMO_MINTS = (process.env.DEMO_TOKEN_MINTS || '').split(',').filter(Boolean);
const ESCROW_PROGRAM_ID = new PublicKey(process.env.ESCROW_PROGRAM_ID!);
const ESCROW_INSTANCE_ID = process.env.ESCROW_INSTANCE_ID!;

const FAUCET_SECRET = process.env.FAUCET_MINT_AUTHORITY_SECRET;
const faucetKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(FAUCET_SECRET!)));

const OPERATOR_PATH = (process.env.SAS_PAYER_PATH || '').replace('~', process.env.HOME || '');
const operatorKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(OPERATOR_PATH, 'utf-8'))));

const devnet = new Connection(VALIDATOR_URL, 'confirmed');

function log(msg: string) { console.log(`[channel-ata-test] ${msg}`); }

async function rpcCall(url: string, method: string, params: any[] = []): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json() as any;
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

async function getChannelTokenBalance(wallet: PublicKey, mint: PublicKey): Promise<bigint | null> {
  const ata = await getAssociatedTokenAddress(mint, wallet, false, TOKEN_PROGRAM_ID);
  try {
    const result = await rpcCall(GATEWAY_URL, 'getTokenAccountBalance', [ata.toString()]);
    if (result?.value) return BigInt(result.value.amount);
    return null;
  } catch {
    return null;
  }
}

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

async function main() {
  log('Starting channel ATA auto-creation test');

  const mintA = new PublicKey(DEMO_MINTS[0]); // e.g., USDC
  const mintB = new PublicKey(DEMO_MINTS[1]); // e.g., USDT

  const walletA = Keypair.generate();
  const walletB = Keypair.generate();
  log(`Wallet A: ${walletA.publicKey.toBase58()}`);
  log(`Wallet B: ${walletB.publicKey.toBase58()}`);
  log(`Token A (sell): ${mintA.toBase58()}`);
  log(`Token B (buy):  ${mintB.toBase58()}`);

  const SWAP_AMOUNT = 1_000_000n;
  const FUND_SOL = 0.05 * LAMPORTS_PER_SOL;

  // 1. Fund wallets
  log('Funding wallets...');
  {
    const tx = new Transaction();
    tx.add(
      SystemProgram.transfer({ fromPubkey: operatorKeypair.publicKey, toPubkey: walletA.publicKey, lamports: FUND_SOL }),
      SystemProgram.transfer({ fromPubkey: operatorKeypair.publicKey, toPubkey: walletB.publicKey, lamports: FUND_SOL }),
    );
    await sendAndConfirmTransaction(devnet, tx, [operatorKeypair]);
  }

  // 2. Mint ONLY their respective sell tokens (not the other)
  log('Minting tokens (each wallet gets ONLY their sell token)...');
  {
    const tx = new Transaction();
    const ataA = await getAssociatedTokenAddress(mintA, walletA.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const ataB = await getAssociatedTokenAddress(mintB, walletB.publicKey, false, TOKEN_2022_PROGRAM_ID);

    tx.add(
      createAssociatedTokenAccountInstruction(operatorKeypair.publicKey, ataA, walletA.publicKey, mintA, TOKEN_2022_PROGRAM_ID),
      createAssociatedTokenAccountInstruction(operatorKeypair.publicKey, ataB, walletB.publicKey, mintB, TOKEN_2022_PROGRAM_ID),
      createMintToInstruction(mintA, ataA, faucetKeypair.publicKey, SWAP_AMOUNT, [], TOKEN_2022_PROGRAM_ID),
      createMintToInstruction(mintB, ataB, faucetKeypair.publicKey, SWAP_AMOUNT, [], TOKEN_2022_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(devnet, tx, [operatorKeypair, faucetKeypair]);
  }

  // 3. Deposit ONLY their sell token into Contra
  log('Depositing sell tokens into Contra...');
  {
    const txA = await buildEscrowDeposit(walletA.publicKey, mintA, SWAP_AMOUNT);
    await sendAndConfirmTransaction(devnet, txA, [walletA]);
    const txB = await buildEscrowDeposit(walletB.publicKey, mintB, SWAP_AMOUNT);
    await sendAndConfirmTransaction(devnet, txB, [walletB]);
  }

  // 4. Wait for sell token deposits to credit
  log('Waiting for sell token deposits to credit...');
  for (let i = 0; i < 30; i++) {
    const a = await getChannelTokenBalance(walletA.publicKey, mintA);
    const b = await getChannelTokenBalance(walletB.publicKey, mintB);
    if (a !== null && a > 0n && b !== null && b > 0n) break;
    await new Promise(r => setTimeout(r, 3000));
  }

  // 5. Verify receiving token ATAs DON'T exist
  const origHasBuy = await getChannelTokenBalance(walletA.publicKey, mintB);
  const provHasSell = await getChannelTokenBalance(walletB.publicKey, mintA);
  log(`Before ensureChannelATAs:`);
  log(`  Originator has buy token ATA: ${origHasBuy !== null}`);
  log(`  Provider has sell token ATA:  ${provHasSell !== null}`);

  if (origHasBuy !== null || provHasSell !== null) {
    log('WARNING: Receiver ATAs already exist. Test may not be meaningful.');
  }

  // 6. Call ensureChannelATAsForSwap
  log('Calling ensureChannelATAsForSwap...');
  const created = await ensureChannelATAsForSwap(
    walletA.publicKey.toBase58(),
    walletB.publicKey.toBase58(),
    mintA.toBase58(),
    mintB.toBase58(),
  );
  log(`Created ATAs: ${created.length > 0 ? created.join(', ') : 'none (already existed)'}`);

  // 7. Verify receiving token ATAs NOW exist
  const origHasBuyAfter = await getChannelTokenBalance(walletA.publicKey, mintB);
  const provHasSellAfter = await getChannelTokenBalance(walletB.publicKey, mintA);
  log(`After ensureChannelATAs:`);
  log(`  Originator has buy token ATA: ${origHasBuyAfter !== null} (balance: ${origHasBuyAfter})`);
  log(`  Provider has sell token ATA:  ${provHasSellAfter !== null} (balance: ${provHasSellAfter})`);

  if (origHasBuyAfter === null || provHasSellAfter === null) {
    log('FAILURE: Receiver ATAs were not created!');
    process.exit(1);
  }

  // 8. Now run the atomic swap
  log('Building and executing atomic swap...');
  const ataA_sell = await getAssociatedTokenAddress(mintA, walletA.publicKey, false, TOKEN_PROGRAM_ID);
  const ataB_recv = await getAssociatedTokenAddress(mintA, walletB.publicKey, false, TOKEN_PROGRAM_ID);
  const ataB_sell = await getAssociatedTokenAddress(mintB, walletB.publicKey, false, TOKEN_PROGRAM_ID);
  const ataA_recv = await getAssociatedTokenAddress(mintB, walletA.publicKey, false, TOKEN_PROGRAM_ID);

  const legA = createTransferInstruction(ataA_sell, ataB_recv, walletA.publicKey, SWAP_AMOUNT, [], TOKEN_PROGRAM_ID);
  const legB = createTransferInstruction(ataB_sell, ataA_recv, walletB.publicKey, SWAP_AMOUNT, [], TOKEN_PROGRAM_ID);

  const { blockhash } = await rpcCall(GATEWAY_URL, 'getLatestBlockhash', [{ commitment: 'confirmed' }]).then((r: any) => r.value);
  const msg = new TransactionMessage({
    payerKey: walletA.publicKey,
    recentBlockhash: blockhash,
    instructions: [legA, legB],
  }).compileToV0Message();

  const vtx = VersionedTransaction.deserialize(new VersionedTransaction(msg).serialize());
  const msgBytes = vtx.message.serialize();
  const sigA = nacl.sign.detached(msgBytes, walletA.secretKey);
  const sigB = nacl.sign.detached(msgBytes, walletB.secretKey);

  for (let i = 0; i < vtx.message.header.numRequiredSignatures; i++) {
    const key = vtx.message.staticAccountKeys[i].toBase58();
    if (key === walletA.publicKey.toBase58()) vtx.signatures[i] = sigA;
    if (key === walletB.publicKey.toBase58()) vtx.signatures[i] = sigB;
  }

  const serialized = Buffer.from(vtx.serialize()).toString('base64');
  const txSig = await rpcCall(GATEWAY_URL, 'sendTransaction', [serialized, { skipPreflight: true, encoding: 'base64' }]);
  log(`Swap submitted: ${txSig}`);

  // Wait and check
  await new Promise(r => setTimeout(r, 3000));
  const finalA_tokenA = await getChannelTokenBalance(walletA.publicKey, mintA);
  const finalA_tokenB = await getChannelTokenBalance(walletA.publicKey, mintB);
  const finalB_tokenA = await getChannelTokenBalance(walletB.publicKey, mintA);
  const finalB_tokenB = await getChannelTokenBalance(walletB.publicKey, mintB);

  log('Final balances:');
  log(`  WalletA tokenA: ${finalA_tokenA} (should be ~0)`);
  log(`  WalletA tokenB: ${finalA_tokenB} (should be ~${SWAP_AMOUNT})`);
  log(`  WalletB tokenA: ${finalB_tokenA} (should be ~${SWAP_AMOUNT})`);
  log(`  WalletB tokenB: ${finalB_tokenB} (should be ~0)`);

  if (finalA_tokenA === 0n && finalB_tokenB === 0n &&
      finalA_tokenB !== null && finalA_tokenB >= SWAP_AMOUNT &&
      finalB_tokenA !== null && finalB_tokenA >= SWAP_AMOUNT) {
    log('SUCCESS: Atomic swap with auto-ATA creation worked!');
  } else {
    // Check signature status for debugging
    const status = await rpcCall(GATEWAY_URL, 'getSignatureStatuses', [[txSig]]);
    log(`Signature status: ${JSON.stringify(status?.value?.[0])}`);
    log('FAILURE: Swap did not execute correctly');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[channel-ata-test] FATAL:', err);
  process.exit(1);
});
