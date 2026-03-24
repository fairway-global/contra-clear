import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, Transaction } from '@solana/web3.js';
import ModalShell from '../../layout/ModalShell';
import { formatRawAmount, getTokenSymbol, SOLANA_VALIDATOR_URL, getSolscanTxUrl } from '../../../lib/constants';
import { buildDepositTx, confirmDeposit } from '../../../lib/api';
import type { EscrowObligation, RFQ } from '../../../lib/otc/types';

type DepositStatus = 'idle' | 'building' | 'signing' | 'confirming' | 'recording' | 'done' | 'error';

interface DepositEscrowModalProps {
  open: boolean;
  rfq: RFQ | null;
  obligation: EscrowObligation | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (txHash: string) => Promise<void> | void;
}

const STATUS_STEPS: { key: DepositStatus; label: string }[] = [
  { key: 'building', label: 'Building escrow transaction' },
  { key: 'signing', label: 'Awaiting wallet signature' },
  { key: 'confirming', label: 'Confirming on-chain' },
  { key: 'recording', label: 'Recording escrow deposit' },
  { key: 'done', label: 'Tokens locked in escrow' },
];

export default function DepositEscrowModal({
  open,
  rfq,
  obligation,
  submitting,
  onClose,
  onSubmit,
}: DepositEscrowModalProps) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [status, setStatus] = useState<DepositStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [txSig, setTxSig] = useState('');

  useEffect(() => {
    if (open) {
      setStatus('idle');
      setErrorMsg('');
      setTxSig('');
    }
  }, [open]);

  const tokenSymbol = obligation ? getTokenSymbol(obligation.tokenMint) : '';
  const amountDisplay = obligation ? formatRawAmount(obligation.amount, obligation.tokenMint) : '';

  const handleLockTokens = async () => {
    if (!publicKey || !signTransaction || !obligation) return;

    setErrorMsg('');
    try {
      // 1. Build the deposit transaction
      setStatus('building');
      const { transaction: txBase64 } = await buildDepositTx(
        publicKey.toString(),
        obligation.tokenMint,
        obligation.amount,
      );

      // 2. Sign with wallet
      setStatus('signing');
      const txBuffer = Buffer.from(txBase64, 'base64');
      const tx = Transaction.from(txBuffer);
      const signed = await signTransaction(tx);

      // 3. Submit and confirm on-chain
      setStatus('confirming');
      const connection = new Connection(SOLANA_VALIDATOR_URL, 'confirmed');
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, 'confirmed');
      setTxSig(sig);

      // 4. Record the deposit on the channel backend
      setStatus('recording');
      await confirmDeposit(publicKey.toString(), obligation.tokenMint, obligation.amount, sig);

      // 5. Record on OTC escrow (calls submitEscrowTxHash)
      await onSubmit(sig);

      setStatus('done');
    } catch (err: any) {
      console.error('Escrow deposit failed:', err);
      const msg = err.message || 'Escrow deposit failed';
      if (msg.includes('has no token account for mint')) {
        setErrorMsg(`Your wallet does not have a ${tokenSymbol} token account on Solana devnet. Import the token in your wallet first.`);
      } else if (msg.includes('User rejected')) {
        setErrorMsg('Transaction was rejected in your wallet.');
      } else if (msg.includes('is not allowed on escrow instance')) {
        setErrorMsg(`${tokenSymbol} is not enabled on the current escrow instance. Contact the admin.`);
      } else {
        setErrorMsg(msg);
      }
      setStatus('error');
    }
  };

  const isProcessing = !['idle', 'done', 'error'].includes(status);
  const canClose = !isProcessing;

  return (
    <ModalShell
      open={open}
      title={rfq ? `Lock Escrow — ${rfq.reference}` : 'Lock Escrow'}
      onClose={canClose ? onClose : () => {}}
      widthClassName="max-w-xl"
      footer={
        status === 'done' ? (
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="btn-secondary" disabled={isProcessing} onClick={onClose}>
              Cancel
            </button>
            {connected && publicKey ? (
              <button
                type="button"
                className="btn-primary"
                disabled={isProcessing || submitting || !obligation}
                onClick={() => void handleLockTokens()}
              >
                {isProcessing ? 'Processing...' : `Lock ${amountDisplay} ${tokenSymbol}`}
              </button>
            ) : null}
          </>
        )
      }
    >
      {obligation ? (
        <div className="space-y-4">
          {/* Escrow obligation summary */}
          <div className="rounded border border-terminal-border bg-terminal-bg p-4">
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Token</div>
                <div className="mt-1 text-terminal-text">{tokenSymbol}</div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Amount to Lock</div>
                <div className="mt-1 text-terminal-accent">{amountDisplay} {tokenSymbol}</div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Party</div>
                <div className="mt-1 text-terminal-text">{obligation.partyName}</div>
              </div>
              <div>
                <div className="uppercase tracking-wider text-terminal-dim">Role</div>
                <div className="mt-1 text-terminal-text">
                  {obligation.partyRole === 'RFQ_ORIGINATOR' ? 'Originator' : 'Liquidity Provider'}
                </div>
              </div>
            </div>
          </div>

          {/* Wallet connection */}
          {!connected || !publicKey ? (
            <div className="rounded border border-yellow-700/60 bg-yellow-950/20 p-4 text-center">
              <div className="font-mono text-xs text-yellow-200">
                Connect your Solana wallet to lock tokens in escrow.
              </div>
              <div className="mt-3 flex justify-center">
                <WalletMultiButton />
              </div>
            </div>
          ) : status === 'idle' ? (
            <div className="rounded border border-terminal-border bg-terminal-bg p-4 font-mono text-xs leading-6 text-terminal-dim">
              Clicking <span className="text-terminal-accent">Lock {amountDisplay} {tokenSymbol}</span> will
              build a deposit transaction, prompt your wallet for approval, and submit it on-chain.
              The tokens will be locked in the Contra escrow until settlement completes.
            </div>
          ) : null}

          {/* Progress steps */}
          {isProcessing || status === 'done' ? (
            <div className="space-y-2 rounded border border-terminal-border bg-terminal-bg p-4">
              {STATUS_STEPS.map((step, i) => {
                const stepIndex = STATUS_STEPS.findIndex((s) => s.key === status);
                const isDone = i < stepIndex || status === 'done';
                const isActive = i === stepIndex && status !== 'done';
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isDone
                          ? 'bg-terminal-green'
                          : isActive
                            ? 'bg-terminal-accent animate-pulse'
                            : 'bg-terminal-muted'
                      }`}
                    />
                    <span
                      className={`font-mono text-xs ${
                        isDone
                          ? 'text-terminal-green'
                          : isActive
                            ? 'text-terminal-accent'
                            : 'text-terminal-dim'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Success */}
          {status === 'done' && txSig ? (
            <div className="rounded border border-terminal-green/30 bg-terminal-green/5 p-4">
              <div className="font-mono text-xs text-terminal-green font-semibold">
                Escrow deposit confirmed on-chain
              </div>
              <div className="mt-2 font-mono text-[11px] text-terminal-dim break-all">
                TX: {txSig}
              </div>
              {getSolscanTxUrl && (
                <a
                  href={getSolscanTxUrl(txSig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-mono text-xs text-terminal-accent hover:underline"
                >
                  View on Solscan
                </a>
              )}
            </div>
          ) : null}

          {/* Error */}
          {status === 'error' && errorMsg ? (
            <div className="rounded border border-red-700/40 bg-red-950/20 p-4">
              <div className="font-mono text-xs text-red-300">{errorMsg}</div>
              <button
                type="button"
                className="btn-secondary mt-3 text-xs"
                onClick={() => setStatus('idle')}
              >
                Try Again
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  );
}
