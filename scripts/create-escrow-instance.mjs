// Creates an escrow instance on the local validator, allows mints, and adds operator
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';

const VALIDATOR_URL = 'http://localhost:18899';
const ESCROW_PROGRAM_ID = new PublicKey('GokvZqD2yP696rzNBNbQvcZ4VsLW7jNvFXU1kW9m7k83');

const connection = new Connection(VALIDATOR_URL, 'confirmed');

// Load admin keypair
const adminBytes = JSON.parse(fs.readFileSync('./keypairs/admin.json', 'utf8'));
const admin = Keypair.fromSecretKey(new Uint8Array(adminBytes));
console.log('Admin:', admin.publicKey.toString());

// Generate instance seed keypair (used to derive the instance PDA)
const instanceSeed = Keypair.generate();
console.log('Instance seed:', instanceSeed.publicKey.toString());

// Derive instance PDA
const [instancePda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('instance'), instanceSeed.publicKey.toBuffer()],
  ESCROW_PROGRAM_ID
);
console.log('Instance PDA:', instancePda.toString());

// Step 1: Create Instance (discriminator = 0)
async function createInstance() {
  const discriminator = Buffer.from([0]); // CreateInstance
  const data = discriminator;

  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },   // payer
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },   // admin
    { pubkey: instanceSeed.publicKey, isSigner: true, isWritable: false }, // instance_seed
    { pubkey: instancePda, isSigner: false, isWritable: true },       // instance (PDA)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ keys, programId: ESCROW_PROGRAM_ID, data });
  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(admin, instanceSeed);

  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('CreateInstance tx:', sig);
  return instancePda;
}

// Step 2: AllowMint (discriminator = 1)
async function allowMint(instance, mint) {
  const [allowedMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('allowed_mint'), instance.toBuffer(), mint.toBuffer()],
    ESCROW_PROGRAM_ID
  );

  // Derive instance ATA for this mint
  const instanceAta = PublicKey.findProgramAddressSync(
    [instance.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];

  const discriminator = Buffer.from([1]); // AllowMint
  const data = discriminator;

  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },    // payer
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },    // admin
    { pubkey: instance, isSigner: false, isWritable: false },          // instance
    { pubkey: mint, isSigner: false, isWritable: false },              // mint
    { pubkey: allowedMintPda, isSigner: false, isWritable: true },     // allowed_mint (PDA)
    { pubkey: instanceAta, isSigner: false, isWritable: true },        // instance_ata
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
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

// Step 3: AddOperator (discriminator = 3)
async function addOperator(instance, operatorPubkey) {
  const [operatorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('operator'), instance.toBuffer(), operatorPubkey.toBuffer()],
    ESCROW_PROGRAM_ID
  );

  const discriminator = Buffer.from([3]); // AddOperator
  const data = discriminator;

  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },    // payer
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },    // admin
    { pubkey: instance, isSigner: false, isWritable: false },          // instance
    { pubkey: operatorPubkey, isSigner: false, isWritable: false },    // operator wallet
    { pubkey: operatorPda, isSigner: false, isWritable: true },        // operator PDA
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
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

// Run setup
const USDC_MINT = new PublicKey('3ihwUnDJAWtFDb7HU8nFHXMgh5bSCvUt1nTsB6oEEJcU');
const WSOL_MINT = new PublicKey('FHG3oiEThwWMhVnQvnrAm7iLjJdbid2mM3Ua649fisJJ');

try {
  console.log('\n--- Creating Escrow Instance ---');
  const instance = await createInstance();

  console.log('\n--- Allowing USDC Mint ---');
  await allowMint(instance, USDC_MINT);

  console.log('\n--- Allowing wSOL Mint ---');
  await allowMint(instance, WSOL_MINT);

  console.log('\n--- Adding Admin as Operator ---');
  await addOperator(instance, admin.publicKey);

  console.log('\n========================================');
  console.log('ESCROW_INSTANCE_ID=' + instance.toString());
  console.log('========================================');
  console.log('\nAdd this to your .env.local and restart the OTC server with:');
  console.log(`ESCROW_INSTANCE_ID=${instance.toString()}`);
} catch (err) {
  console.error('Error:', err.message || err);
  if (err.logs) console.error('Logs:', err.logs);
}
