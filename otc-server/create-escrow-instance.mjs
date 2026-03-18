import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

const VALIDATOR_URL = 'http://localhost:18899';
const ESCROW_PROGRAM_ID = new PublicKey('GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83');

const connection = new Connection(VALIDATOR_URL, 'confirmed');

const adminBytes = JSON.parse(fs.readFileSync('../keypairs/admin.json', 'utf8'));
const admin = Keypair.fromSecretKey(new Uint8Array(adminBytes));
console.log('Admin:', admin.publicKey.toString());

const instanceSeed = Keypair.generate();
console.log('Instance seed:', instanceSeed.publicKey.toString());

const [instancePda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('instance'), instanceSeed.publicKey.toBuffer()],
  ESCROW_PROGRAM_ID
);
console.log('Instance PDA:', instancePda.toString(), 'bump:', bump);

const [eventAuthority] = PublicKey.findProgramAddressSync(
  [Buffer.from('event_authority')],
  ESCROW_PROGRAM_ID
);

async function createInstance() {
  const data = Buffer.from([0, bump]); // discriminator + bump
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: instanceSeed.publicKey, isSigner: true, isWritable: false },
    { pubkey: instancePda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: ESCROW_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({ keys, programId: ESCROW_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin, instanceSeed);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('CreateInstance tx:', sig);
}

async function allowMint(mint) {
  const [allowedMintPda, allowedMintBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('allowed_mint'), instancePda.toBuffer(), mint.toBuffer()],
    ESCROW_PROGRAM_ID
  );
  const instanceAta = PublicKey.findProgramAddressSync(
    [instancePda.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
  const data = Buffer.from([1, allowedMintBump]); // discriminator + bump
  // Account order from source: payer, admin, instance, mint, allowed_mint, instance_ata, system, token, ata, event_authority, program
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: instancePda, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: allowedMintPda, isSigner: false, isWritable: true },
    { pubkey: instanceAta, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: ESCROW_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({ keys, programId: ESCROW_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  console.log(`AllowMint ${mint.toString()} tx:`, sig);
}

async function addOperator(operatorPubkey) {
  const [operatorPda, operatorBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('operator'), instancePda.toBuffer(), operatorPubkey.toBuffer()],
    ESCROW_PROGRAM_ID
  );
  const data = Buffer.from([3, operatorBump]); // discriminator + bump
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: instancePda, isSigner: false, isWritable: false },
    { pubkey: operatorPubkey, isSigner: false, isWritable: false },
    { pubkey: operatorPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: ESCROW_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({ keys, programId: ESCROW_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  console.log(`AddOperator ${operatorPubkey.toString()} tx:`, sig);
}

const USDC_MINT = new PublicKey('3T7V1PrpVv2WwGky2pskesXGSbDXqAEvV7HaZDtcKUsB');
const WSOL_MINT = new PublicKey('H3RcEJs7EYYXsusJx28AQvMMNncWAmAVw3H61ZGYMTsu');

try {
  console.log('\n--- Creating Escrow Instance ---');
  await createInstance();
  console.log('\n--- Allowing USDC Mint ---');
  await allowMint(USDC_MINT);
  console.log('\n--- Allowing wSOL Mint ---');
  await allowMint(WSOL_MINT);
  console.log('\n--- Adding Admin as Operator ---');
  await addOperator(admin.publicKey);
  console.log('\n========================================');
  console.log('ESCROW_INSTANCE_ID=' + instancePda.toString());
  console.log('========================================');
} catch (err) {
  console.error('Error:', err.message || err);
  if (err.logs) console.error('Logs:', err.logs);
}
