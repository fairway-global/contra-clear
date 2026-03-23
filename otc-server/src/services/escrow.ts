import {
  Connection, PublicKey, Transaction, TransactionInstruction,
  Keypair, SystemProgram, LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { VALIDATOR_URL, getLatestBlockhash, getAccountInfo } from './contra.js';

const ESCROW_PROGRAM_ID = new PublicKey(process.env.ESCROW_PROGRAM_ID || 'GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83');
const ESCROW_INSTANCE_ID = process.env.ESCROW_INSTANCE_ID || '';

export function getEscrowProgramId(): PublicKey {
  return ESCROW_PROGRAM_ID;
}

export function getEscrowInstanceId(): string {
  return ESCROW_INSTANCE_ID;
}

async function resolveMintTokenProgram(mint: PublicKey): Promise<PublicKey> {
  const mintInfo = await getAccountInfo(VALIDATOR_URL, mint.toString());

  if (!mintInfo) {
    throw new Error(`Mint ${mint.toString()} not found on Solana RPC ${VALIDATOR_URL}`);
  }

  if (mintInfo.owner === TOKEN_PROGRAM_ID.toString()) {
    return TOKEN_PROGRAM_ID;
  }

  if (mintInfo.owner === TOKEN_2022_PROGRAM_ID.toString()) {
    return TOKEN_2022_PROGRAM_ID;
  }

  throw new Error(`Mint ${mint.toString()} is owned by unsupported program ${mintInfo.owner}`);
}

// Build deposit instruction for the escrow program
// The user will sign this on the frontend and send to the configured Solana RPC
export async function buildDepositInstruction(
  userPubkey: PublicKey,
  mint: PublicKey,
  amount: bigint,
  tokenProgramId: PublicKey,
  recipient?: PublicKey
): Promise<{ instruction: TransactionInstruction; accounts: string[] }> {
  if (!ESCROW_INSTANCE_ID) {
    throw new Error('ESCROW_INSTANCE_ID not configured');
  }

  const instancePda = new PublicKey(ESCROW_INSTANCE_ID);

  // Derive the allowed_mint PDA
  const [allowedMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('allowed_mint'), instancePda.toBuffer(), mint.toBuffer()],
    ESCROW_PROGRAM_ID
  );

  // Get ATAs
  const userAta = await getAssociatedTokenAddress(mint, userPubkey, false, tokenProgramId);
  const instanceAta = await getAssociatedTokenAddress(mint, instancePda, true, tokenProgramId);

  // Event authority PDA
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('event_authority')],
    ESCROW_PROGRAM_ID
  );

  // Build deposit instruction data
  // Discriminator: 6 (deposit), then amount (u64 LE), then option<pubkey>
  const discriminator = Buffer.from([6]);
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);

  let data: Buffer;
  if (recipient) {
    // Some(pubkey): 1 byte option tag + 32 bytes pubkey
    data = Buffer.concat([discriminator, amountBuf, Buffer.from([1]), recipient.toBuffer()]);
  } else {
    // None: 1 byte option tag
    data = Buffer.concat([discriminator, amountBuf, Buffer.from([0])]);
  }

  // Account order must match Rust source exactly:
  // payer, user, instance, mint, allowed_mint, user_ata, instance_ata,
  // system_program, token_program, associated_token_program, event_authority, contra_escrow_program
  const keys = [
    { pubkey: userPubkey, isSigner: true, isWritable: true },       // payer
    { pubkey: userPubkey, isSigner: true, isWritable: false },       // user
    { pubkey: instancePda, isSigner: false, isWritable: false },     // instance
    { pubkey: mint, isSigner: false, isWritable: false },            // mint
    { pubkey: allowedMintPda, isSigner: false, isWritable: false },  // allowed_mint
    { pubkey: userAta, isSigner: false, isWritable: true },          // user_ata
    { pubkey: instanceAta, isSigner: false, isWritable: true },      // instance_ata
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },       // system_program
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },                // token_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // associated_token_program
    { pubkey: eventAuthority, isSigner: false, isWritable: false },                // event_authority
    { pubkey: ESCROW_PROGRAM_ID, isSigner: false, isWritable: false },             // contra_escrow_program
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: ESCROW_PROGRAM_ID,
    data,
  });

  return {
    instruction,
    accounts: keys.map(k => k.pubkey.toString()),
  };
}

// Build a serialized deposit transaction for the frontend to sign
export async function buildDepositTransaction(
  userPubkey: string,
  mint: string,
  amount: string,
  recipient?: string
): Promise<{ transaction: string; message: string }> {
  const user = new PublicKey(userPubkey);
  const mintPk = new PublicKey(mint);
  const amountBigInt = BigInt(amount);
  const recipientPk = recipient ? new PublicKey(recipient) : undefined;
  const tokenProgramId = await resolveMintTokenProgram(mintPk);
  const instancePda = new PublicKey(ESCROW_INSTANCE_ID);
  const [allowedMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('allowed_mint'), instancePda.toBuffer(), mintPk.toBuffer()],
    ESCROW_PROGRAM_ID
  );
  const userAta = await getAssociatedTokenAddress(mintPk, user, false, tokenProgramId);
  const instanceAta = await getAssociatedTokenAddress(mintPk, instancePda, true, tokenProgramId);

  const instanceInfo = await getAccountInfo(VALIDATOR_URL, ESCROW_INSTANCE_ID);
  if (!instanceInfo) {
    throw new Error(`Escrow instance ${ESCROW_INSTANCE_ID} not found on Solana RPC ${VALIDATOR_URL}`);
  }

  if (instanceInfo.owner !== ESCROW_PROGRAM_ID.toString()) {
    throw new Error(`Escrow instance ${ESCROW_INSTANCE_ID} is not owned by program ${ESCROW_PROGRAM_ID.toString()}`);
  }

  const allowedMintInfo = await getAccountInfo(VALIDATOR_URL, allowedMintPda.toString());
  if (!allowedMintInfo) {
    throw new Error(`Mint ${mint} is not allowed on escrow instance ${ESCROW_INSTANCE_ID}`);
  }

  if (allowedMintInfo.owner !== ESCROW_PROGRAM_ID.toString()) {
    throw new Error(`Allowed mint PDA ${allowedMintPda.toString()} is not owned by program ${ESCROW_PROGRAM_ID.toString()}`);
  }

  const userAtaInfo = await getAccountInfo(VALIDATOR_URL, userAta.toString());
  if (!userAtaInfo) {
    throw new Error(`Wallet ${userPubkey} has no token account for mint ${mint} on ${VALIDATOR_URL}`);
  }

  const instanceAtaInfo = await getAccountInfo(VALIDATOR_URL, instanceAta.toString());
  if (!instanceAtaInfo) {
    throw new Error(`Escrow token account ${instanceAta.toString()} is missing for mint ${mint}`);
  }

  const { instruction } = await buildDepositInstruction(user, mintPk, amountBigInt, tokenProgramId, recipientPk);
  const { blockhash } = await getLatestBlockhash(VALIDATOR_URL);

  const tx = new Transaction();
  tx.add(instruction);
  tx.recentBlockhash = blockhash;
  tx.feePayer = user;

  // Serialize the transaction (without signatures) for the frontend to sign
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

  return {
    transaction: serialized.toString('base64'),
    message: `Deposit ${amount} tokens to Contra channel`,
  };
}
