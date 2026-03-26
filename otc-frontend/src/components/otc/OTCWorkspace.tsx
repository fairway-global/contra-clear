import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import Panel from '../layout/Panel';
import CreateRFQModal from './rfq/CreateRFQModal';
import AcceptQuoteModal from './rfq/AcceptQuoteModal';
import RFQDetailsHeader from './rfq/RFQDetailsHeader';
import RFQStatusBadge from './rfq/RFQStatusBadge';
import QuoteTable from './rfq/QuoteTable';
import SubmitQuoteModal from './quotes/SubmitQuoteModal';
import QuoteNegotiationModal from './quotes/QuoteNegotiationModal';
import DepositEscrowModal from './escrow/DepositEscrowModal';
import EscrowStatusCard from './escrow/EscrowStatusCard';
import EscrowTimeline from './escrow/EscrowTimeline';
import { formatRawAmount, getTokenSymbol, timeAgo, toRawAmount } from '../../lib/constants';
import { signAndSendToContra } from '../../lib/sendToContra';
import {
  acceptQuote,
  counterQuote,
  createRFQ,
  getEscrowStatusForRFQ,
  getNegotiationThread,
  getQuotesForRFQ,
  getRFQ,
  listRFQs,
  rejectQuote,
  submitEscrowTxHash,
  submitQuote,
  buildSettlementLegs,
  getSettlementInfo,
  submitSettlementLeg,
} from '../../lib/otc/api';
import type { ActivityEvent, EscrowObligation, Quote, RFQ, User } from '../../lib/otc/types';
import { EscrowStatus, RFQStatus, UserRole } from '../../lib/otc/types';

interface OTCWorkspaceProps {
  route: '/otc/rfqs' | '/otc/rfqs/[rfqId]' | '/otc/escrow' | '/otc/settlements';
  rfqId?: string;
  currentUser: User | null;
  role: UserRole;
  onNavigate: (path: string) => void;
}

function RFQInventory({
  rfqs,
  title,
  onOpenRFQ,
}: {
  rfqs: RFQ[];
  title: string;
  onOpenRFQ: (rfqId: string) => void;
}) {
  return (
    <Panel title={title}>
      {rfqs.length === 0 ? (
        <div className="py-8 text-center font-mono text-sm text-terminal-dim">No RFQs available in this view.</div>
      ) : (
        <div className="space-y-1">
          {rfqs.map((rfq) => (
            <button
              key={rfq.id}
              type="button"
              onClick={() => onOpenRFQ(rfq.id)}
              className="w-full rounded border border-transparent px-3 py-3 text-left hover:border-terminal-border hover:bg-terminal-muted/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm text-terminal-text">{rfq.reference}</div>
                <RFQStatusBadge status={rfq.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                <span className="text-terminal-dim">
                  {getTokenSymbol(rfq.sellToken)}/{getTokenSymbol(rfq.buyToken)}
                </span>
                <span className="text-terminal-accent">
                  {formatRawAmount(rfq.sellAmount, rfq.sellToken)} {getTokenSymbol(rfq.sellToken)}
                </span>
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-terminal-dim">
                {rfq.originatorName} · updated {timeAgo(rfq.updatedAt)}
              </div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function OTCWorkspace({ route, rfqId, currentUser, role, onNavigate }: OTCWorkspaceProps) {
  const { signTransaction } = useWallet();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [escrows, setEscrows] = useState<EscrowObligation[]>([]);
  const [rfqEscrowMap, setRfqEscrowMap] = useState<Record<string, EscrowObligation[]>>({});
  const [overviewEvents, setOverviewEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitQuoteOpen, setSubmitQuoteOpen] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [activeEscrow, setActiveEscrow] = useState<EscrowObligation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const viewer = useMemo(
    () => (currentUser ? { role, userId: currentUser.id } : null),
    [currentUser, role],
  );

  const refreshList = useCallback(async () => {
    if (!viewer) {
      return;
    }

    setLoading(true);
    try {
      const nextRfqs = await listRFQs(viewer);
      const [activityBuckets, escrowBuckets] = await Promise.all([
        Promise.all(nextRfqs.slice(0, 6).map((rfq) => getNegotiationThread(rfq.id))),
        Promise.all(nextRfqs.map(async (rfq) => [rfq.id, await getEscrowStatusForRFQ(rfq.id)] as const)),
      ]);

      setRfqs(nextRfqs);
      setOverviewEvents(
        activityBuckets
          .flat()
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
          .slice(0, 8),
      );
      setRfqEscrowMap(Object.fromEntries(escrowBuckets));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load OTC RFQs');
    } finally {
      setLoading(false);
    }
  }, [viewer]);

  const refreshDetail = useCallback(async (nextRfqId: string) => {
    if (!viewer) {
      return;
    }

    setDetailLoading(true);
    try {
      const [rfq, nextQuotes, nextEvents, nextEscrows] = await Promise.all([
        getRFQ(nextRfqId),
        getQuotesForRFQ(nextRfqId, viewer),
        getNegotiationThread(nextRfqId),
        getEscrowStatusForRFQ(nextRfqId),
      ]);

      setSelectedRFQ(rfq);
      setQuotes(nextQuotes);
      setEvents(nextEvents);
      setEscrows(nextEscrows);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load RFQ details');
    } finally {
      setDetailLoading(false);
    }
  }, [viewer]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (route === '/otc/rfqs/[rfqId]' && rfqId) {
      void refreshDetail(rfqId);
      return;
    }

    setSelectedRFQ(null);
    setQuotes([]);
    setEvents([]);
    setEscrows([]);
  }, [refreshDetail, rfqId, route]);

  // WebSocket: auto-refresh on OTC events
  useEffect(() => {
    const wsUrl = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:3002';
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = () => {
          // Any OTC event → refresh list and detail
          void refreshList();
          if (rfqId) void refreshDetail(rfqId);
        };
        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch { /* ignore */ }
    }

    connect();
    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [refreshList, refreshDetail, rfqId]);

  const canCreateRFQ = role === UserRole.RFQ_ORIGINATOR;
  const canSubmitQuote = Boolean(
    role === UserRole.LIQUIDITY_PROVIDER &&
    selectedRFQ &&
    !selectedRFQ.selectedQuoteId &&
    ![RFQStatus.Cancelled, RFQStatus.Expired, RFQStatus.Defaulted].includes(selectedRFQ.status),
  );

  const myEscrow = useMemo(() => {
    if (!currentUser) {
      return null;
    }
    if (role === UserRole.RFQ_ORIGINATOR) {
      return escrows.find((escrow) => escrow.partyRole === UserRole.RFQ_ORIGINATOR) || null;
    }
    return escrows.find((escrow) => escrow.partyRole === UserRole.LIQUIDITY_PROVIDER && escrow.partyId === currentUser.id) || null;
  }, [currentUser, escrows, role]);

  const escrowRows = useMemo(
    () => rfqs
      .map((rfq) => ({ rfq, escrows: rfqEscrowMap[rfq.id] || [] }))
      .filter((entry) => entry.escrows.length > 0),
    [rfqEscrowMap, rfqs],
  );

  const settlementRows = useMemo(
    () => rfqs.filter((rfq) => [
      RFQStatus.AwaitingOriginatorDeposit,
      RFQStatus.AwaitingProviderDeposit,
      RFQStatus.ReadyToSettle,
      RFQStatus.Settling,
      RFQStatus.Settled,
    ].includes(rfq.status)),
    [rfqs],
  );

  const rfqListTitle = role === UserRole.RFQ_ORIGINATOR ? 'My RFQs' : 'Eligible RFQs';

  const handleCreateRFQ = async (payload: {
    sequence: string;
    sellToken: string;
    sellAmount: string;
    indicativeBuyAmount: string;
    buyToken: string;
    requiredTier: string;
    expiresInSeconds: string;
  }) => {
    if (!currentUser) {
      return;
    }

    setSubmitting(true);
    try {
      const next = await createRFQ({
        originatorId: currentUser.id,
        sequence: payload.sequence,
        sellToken: payload.sellToken,
        sellAmount: toRawAmount(payload.sellAmount, payload.sellToken),
        buyToken: payload.buyToken,
        indicativeBuyAmount: toRawAmount(payload.indicativeBuyAmount, payload.buyToken),
        requiredTier: Number(payload.requiredTier),
        expiresInSeconds: Number(payload.expiresInSeconds),
      });

      setCreateOpen(false);
      toast.success('RFQ created');
      await refreshList();
      onNavigate(`/otc/rfqs/${next.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQuote = async (payload: { price: string; buyAmount: string; note: string }) => {
    if (!currentUser || !selectedRFQ) {
      return;
    }

    setSubmitting(true);
    try {
      await submitQuote({
        rfqId: selectedRFQ.id,
        providerId: currentUser.id,
        price: payload.price,
        buyAmount: toRawAmount(payload.buyAmount, selectedRFQ.buyToken),
        note: payload.note,
      });

      setSubmitQuoteOpen(false);
      toast.success('Quote submitted');
      await refreshList();
      await refreshDetail(selectedRFQ.id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCounterQuote = async (payload: { price: string; buyAmount: string; note: string }) => {
    if (!currentUser || !selectedRFQ || !activeQuote) {
      return;
    }

    setSubmitting(true);
    try {
      await counterQuote({
        rfqId: selectedRFQ.id,
        quoteId: activeQuote.id,
        actorId: currentUser.id,
        actorRole: role,
        price: payload.price,
        buyAmount: toRawAmount(payload.buyAmount, selectedRFQ.buyToken),
        note: payload.note,
      });

      setCounterOpen(false);
      toast.success('Counter sent');
      await refreshList();
      await refreshDetail(selectedRFQ.id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptQuote = async (fillAmount?: string) => {
    if (!currentUser || !selectedRFQ || !activeQuote) {
      return;
    }

    setSubmitting(true);
    try {
      await acceptQuote(selectedRFQ.id, activeQuote.id, currentUser.id, fillAmount);
      setAcceptOpen(false);
      toast.success(fillAmount ? 'Partial fill accepted' : 'Commercial terms accepted');
      await refreshList();
      await refreshDetail(selectedRFQ.id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectQuote = async (quote: Quote) => {
    if (!currentUser || !selectedRFQ) {
      return;
    }

    setSubmitting(true);
    try {
      await rejectQuote(selectedRFQ.id, quote.id, currentUser.id);
      toast.success('Quote rejected');
      await refreshList();
      await refreshDetail(selectedRFQ.id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignSettlement = async () => {
    if (!currentUser || !selectedRFQ || !signTransaction) return;

    setSubmitting(true);
    try {
      // 1. Build settlement legs if not already built
      const settlement = await buildSettlementLegs(selectedRFQ.id);

      // 2. Determine which leg this user signs
      const isOriginator = currentUser.id === selectedRFQ.originatorId;
      const myLegTx = isOriginator ? settlement.legATx : settlement.legBTx;
      const myLeg: 'A' | 'B' = isOriginator ? 'A' : 'B';

      if (!myLegTx) {
        toast.error('No settlement transaction available for your role');
        return;
      }

      // 3. Sign and send to Contra gateway
      toast.loading('Sign the settlement transaction in your wallet...', { id: 'settlement' });
      const signature = await signAndSendToContra(myLegTx, signTransaction);
      toast.loading('Confirming on Contra channel...', { id: 'settlement' });

      // 4. Record the signed leg on backend
      await submitSettlementLeg(selectedRFQ.id, myLeg, signature);
      toast.success('Settlement leg signed and confirmed!', { id: 'settlement' });

      await refreshList();
      await refreshDetail(selectedRFQ.id);
    } catch (err: any) {
      toast.error(err.message || 'Settlement signing failed', { id: 'settlement' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositSubmit = async (txHash: string) => {
    if (!currentUser || !selectedRFQ || !activeEscrow) {
      return;
    }

    setSubmitting(true);
    try {
      await submitEscrowTxHash(selectedRFQ.id, activeEscrow.partyRole, currentUser.id, txHash);
      setDepositOpen(false);
      toast.success('Escrow reference recorded');
      await refreshList();
      await refreshDetail(selectedRFQ.id);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <Panel title="OTC Access">
        <div className="py-12 text-center font-mono text-sm text-terminal-dim">
          Sign in as an RFQ Originator or Liquidity Provider to access the OTC workflow.
        </div>
      </Panel>
    );
  }

  if (role === UserRole.ADMIN) {
    return (
      <Panel title="OTC Access">
        <div className="space-y-4 py-8 text-center font-mono text-sm text-terminal-dim">
          <div>Admin views live under the activities, settlements, escrow, and users routes.</div>
          <button type="button" className="btn-primary" onClick={() => onNavigate('/admin/otc')}>
            Open Activities
          </button>
        </div>
      </Panel>
    );
  }

  if (route === '/otc/rfqs') {
    return (
      <div className="space-y-4">
        {canCreateRFQ ? (
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              Create RFQ
            </button>
          </div>
        ) : null}

        <RFQInventory
          rfqs={rfqs}
          title={loading ? `${rfqListTitle} (loading...)` : rfqListTitle}
          onOpenRFQ={(id) => onNavigate(`/otc/rfqs/${id}`)}
        />

        <CreateRFQModal open={createOpen} submitting={submitting} onClose={() => setCreateOpen(false)} onSubmit={handleCreateRFQ} />
      </div>
    );
  }

  if (route === '/otc/escrow') {
    return (
      <Panel title="Escrow">
        {escrowRows.length === 0 ? (
          <div className="py-12 text-center font-mono text-sm text-terminal-dim">
            No escrow obligations are active for this role yet.
          </div>
        ) : (
          <div className="space-y-5">
            {escrowRows.map(({ rfq, escrows: obligations }) => (
              <div key={rfq.id} className="space-y-3 border-b border-terminal-border pb-5 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-mono text-sm text-terminal-text">
                    {rfq.reference} · {getTokenSymbol(rfq.sellToken)}/{getTokenSymbol(rfq.buyToken)}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 text-xs"
                    onClick={() => onNavigate(`/otc/rfqs/${rfq.id}`)}
                  >
                    Open RFQ
                  </button>
                </div>
                <EscrowStatusCard escrows={obligations} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    );
  }

  if (route === '/otc/settlements') {
    return (
      <RFQInventory
        rfqs={settlementRows}
        title="Settlement"
        onOpenRFQ={(id) => onNavigate(`/otc/rfqs/${id}`)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {detailLoading || !selectedRFQ ? (
        <Panel title="RFQ">
          <div className="py-12 text-center font-mono text-sm text-terminal-dim">
            {detailLoading ? 'Loading RFQ...' : 'RFQ not found in the current role view.'}
          </div>
        </Panel>
      ) : (
        <>
          <RFQDetailsHeader
            rfq={selectedRFQ}
            action={(
              <>
                <button type="button" className="btn-secondary" onClick={() => onNavigate('/otc/rfqs')}>
                  Back To RFQs
                </button>
                {canSubmitQuote ? (
                  <button type="button" className="btn-primary" onClick={() => setSubmitQuoteOpen(true)}>
                    Submit Quote
                  </button>
                ) : null}
                {myEscrow && selectedRFQ.selectedQuoteId && myEscrow.partyId === currentUser.id && myEscrow.status !== EscrowStatus.Released ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setActiveEscrow(myEscrow);
                      setDepositOpen(true);
                    }}
                  >
                    Lock Tokens in Escrow
                  </button>
                ) : null}
                {selectedRFQ.status === RFQStatus.ReadyToSettle && signTransaction ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={submitting}
                    onClick={() => void handleSignSettlement()}
                  >
                    {submitting ? 'Signing...' : 'Sign Settlement'}
                  </button>
                ) : null}
              </>
            )}
          />

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <QuoteTable
              rfq={selectedRFQ}
              quotes={quotes}
              viewerRole={role}
              onAcceptQuote={(quote) => {
                setActiveQuote(quote);
                setAcceptOpen(true);
              }}
              onRejectQuote={handleRejectQuote}
              onCounterQuote={(quote) => {
                setActiveQuote(quote);
                setCounterOpen(true);
              }}
            />

            <Panel title="Escrow">
              <EscrowStatusCard escrows={escrows} />
            </Panel>
          </div>

          <EscrowTimeline events={events} />
        </>
      )}

      <CreateRFQModal open={createOpen} submitting={submitting} onClose={() => setCreateOpen(false)} onSubmit={handleCreateRFQ} />
      <SubmitQuoteModal open={submitQuoteOpen} rfq={selectedRFQ} submitting={submitting} onClose={() => setSubmitQuoteOpen(false)} onSubmit={handleSubmitQuote} />
      <QuoteNegotiationModal open={counterOpen} rfq={selectedRFQ} quote={activeQuote} submitting={submitting} onClose={() => setCounterOpen(false)} onSubmit={handleCounterQuote} />
      <AcceptQuoteModal open={acceptOpen} rfq={selectedRFQ} quote={activeQuote} submitting={submitting} onClose={() => setAcceptOpen(false)} onConfirm={handleAcceptQuote} />
      <DepositEscrowModal open={depositOpen} rfq={selectedRFQ} obligation={activeEscrow} submitting={submitting} onClose={() => setDepositOpen(false)} onSubmit={handleDepositSubmit} />
    </div>
  );
}
