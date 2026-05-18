import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import toast from 'react-hot-toast';
import Panel from '../layout/Panel';
import RFQDetailsHeader from '../otc/rfq/RFQDetailsHeader';
import QuoteTable from '../otc/rfq/QuoteTable';
import EscrowTimeline from '../otc/escrow/EscrowTimeline';
import SubmitQuoteModal from '../otc/quotes/SubmitQuoteModal';
import AuthGateModal from '../auth/AuthGateModal';
import {
  getPublicRFQ,
  getPublicQuotesForRFQ,
  getPublicNegotiationThread,
  submitQuote,
} from '../../lib/otc/api';
import { toRawAmount } from '../../lib/constants';
import type { ActivityEvent, Quote, RFQ, User } from '../../lib/otc/types';
import { RFQStatus, UserRole } from '../../lib/otc/types';

interface PublicRFQDetailProps {
  rfqId: string;
  currentUser: User | null;
  loginByEmail: (email: string, password: string) => Promise<User>;
  onNavigate: (path: string) => void;
}

type QuotePayload = { price: string; buyAmount: string; note: string };

const NEGOTIABLE = new Set<RFQStatus>([
  RFQStatus.OpenForQuotes,
  RFQStatus.Negotiating,
  RFQStatus.Draft,
]);

export default function PublicRFQDetail({
  rfqId,
  currentUser,
  loginByEmail,
  onNavigate,
}: PublicRFQDetailProps) {
  const { publicKey } = useWallet();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<QuotePayload | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rfqResult, quotesResult, eventsResult] = await Promise.all([
          getPublicRFQ(rfqId),
          getPublicQuotesForRFQ(rfqId),
          getPublicNegotiationThread(rfqId),
        ]);
        if (cancelled) return;
        setRfq(rfqResult);
        setQuotes(quotesResult);
        setEvents(eventsResult);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load RFQ.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rfqId]);

  const canPropose = rfq ? NEGOTIABLE.has(rfq.status) && !rfq.selectedQuoteId : false;

  const finalizeQuote = async (user: User, payload: QuotePayload) => {
    if (!rfq) return;
    if (user.role !== UserRole.LIQUIDITY_PROVIDER) {
      toast.error('Only Approved Trader accounts can propose quotes. Sign in with a liquidity provider account.');
      return;
    }
    setSubmitting(true);
    try {
      await submitQuote({
        rfqId: rfq.id,
        providerId: user.id,
        price: payload.price,
        buyAmount: toRawAmount(payload.buyAmount, rfq.buyToken),
        note: payload.note,
      });
      toast.success('Quote submitted');
      setQuoteOpen(false);
      setPendingPayload(null);
      onNavigate(`/otc/rfqs/${rfq.id}`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit quote.');
    } finally {
      setSubmitting(false);
    }
  };

  const advance = async (user: User, payload: QuotePayload) => {
    if (!publicKey) {
      setPendingPayload(payload);
      setWalletPromptOpen(true);
      return;
    }
    await finalizeQuote(user, payload);
  };

  const handleQuoteSubmit = async (payload: QuotePayload) => {
    if (!rfq) return;
    if (!currentUser) {
      setPendingPayload(payload);
      setAuthOpen(true);
      return;
    }
    await advance(currentUser, payload);
  };

  const handleAuthed = async (user: User) => {
    setAuthOpen(false);
    if (!pendingPayload) {
      toast.error('Quote details lost. Please re-enter.');
      return;
    }
    await advance(user, pendingPayload);
  };

  useEffect(() => {
    if (!walletPromptOpen) return;
    if (publicKey && currentUser && pendingPayload) {
      setWalletPromptOpen(false);
      void finalizeQuote(currentUser, pendingPayload);
    }
  }, [walletPromptOpen, publicKey, currentUser, pendingPayload]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <Panel title="RFQ">
          <div className="py-12 text-center font-mono text-sm text-terminal-dim">Loading RFQ...</div>
        </Panel>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="mx-auto max-w-5xl">
        <Panel title="RFQ">
          <div className="py-12 text-center font-mono text-sm text-terminal-dim">RFQ not found.</div>
          <div className="flex justify-center pb-4">
            <button type="button" className="btn-primary" onClick={() => onNavigate('/launch/lq')}>
              Back To Open Desk
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <RFQDetailsHeader
        rfq={rfq}
        action={(
          <>
            <button type="button" className="btn-secondary" onClick={() => onNavigate('/launch/lq')}>
              Back To Desk
            </button>
            {canPropose ? (
              <button type="button" className="btn-primary" onClick={() => setQuoteOpen(true)}>
                Propose Quote
              </button>
            ) : (
              <span className="rounded border border-terminal-border bg-terminal-bg px-3 py-2 font-mono text-[11px] text-terminal-dim">
                Quotes closed for this RFQ
              </span>
            )}
          </>
        )}
      />

      <div className="rounded border border-terminal-accent/30 bg-terminal-accent/5 p-4 font-mono text-xs leading-6 text-terminal-dim">
        <span className="text-terminal-accent">Public read view.</span> You are browsing this RFQ without logging in.
        Sign in and connect a wallet only when you submit your own quote.
      </div>

      <QuoteTable
        rfq={rfq}
        quotes={quotes}
        viewerRole={UserRole.LIQUIDITY_PROVIDER}
      />

      <EscrowTimeline events={events} />

      <SubmitQuoteModal
        open={quoteOpen}
        rfq={rfq}
        submitting={submitting}
        onClose={() => setQuoteOpen(false)}
        onSubmit={handleQuoteSubmit}
      />

      <AuthGateModal
        open={authOpen}
        intent="lq"
        pendingActionLabel="Send Quote"
        loginByEmail={loginByEmail}
        onClose={() => setAuthOpen(false)}
        onAuthed={handleAuthed}
      />

      {walletPromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-terminal-bg/80 px-4">
          <div className="panel w-full max-w-md shadow-2xl">
            <div className="panel-header">
              <span className="panel-title">Connect Wallet</span>
              <button
                type="button"
                onClick={() => { setWalletPromptOpen(false); setPendingPayload(null); }}
                className="text-xs font-mono text-terminal-dim transition-colors hover:text-terminal-text"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="font-mono text-xs leading-6 text-terminal-dim">
                Signed in as <span className="text-terminal-accent">{currentUser?.fullName}</span>. Connect a Solana
                wallet so we can attach it to your quote and use it during atomic settlement.
              </p>
              <div className="flex justify-center">
                <WalletMultiButton />
              </div>
              <p className="text-center font-mono text-[11px] text-terminal-dim">
                Your quote is held locally until your wallet connects.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
