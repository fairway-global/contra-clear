import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { AuthProfile, EscrowObligation, Quote } from '../types/platform';
import { getRFQDetails } from '../lib/platformService';
import { usePlatform } from '../hooks/usePlatform';
import RFQDetailsHeader from '../components/platform/RFQDetailsHeader';
import NegotiationPanel from '../components/platform/NegotiationPanel';
import EscrowStatusCard from '../components/platform/EscrowStatusCard';
import SubmitBankQuoteModal from '../components/platform/SubmitBankQuoteModal';
import AcceptQuoteModal from '../components/platform/AcceptQuoteModal';
import DepositEscrowModal from '../components/platform/DepositEscrowModal';
import Panel from '../components/layout/Panel';

export default function RFQDetailsPage({
  profile,
  rfqId,
}: {
  profile: AuthProfile;
  rfqId: string;
}) {
  const { submitBankQuote, counterQuote, acceptQuote, submitEscrowDeposit } = usePlatform();
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [activeObligation, setActiveObligation] = useState<EscrowObligation | null>(null);

  const details = getRFQDetails(profile.user, rfqId);
  const selectedQuote = useMemo<Quote | undefined>(
    () => details.quotes.find((item) => item.id === details.rfq.selectedQuoteId) ?? details.quotes[details.quotes.length - 1],
    [details.quotes, details.rfq.selectedQuoteId]
  );
  const myPendingObligation = details.escrowObligations.find(
    (item) =>
      item.status !== 'CONFIRMED' &&
      ((profile.user.role === 'BANK' && item.partyRole === 'BANK') ||
        (profile.user.role === 'INSTITUTION' && item.organizationId === profile.organization.id))
  );

  return (
    <div className="space-y-6">
      <RFQDetailsHeader
        rfq={details.rfq}
        institution={details.institution}
        bankOrganization={details.bankOrganization}
        selectedQuote={selectedQuote}
        currentRole={profile.user.role}
        onOpenQuoteModal={() => setShowQuoteModal(true)}
        onOpenAcceptModal={() => setShowAcceptModal(true)}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <NegotiationPanel
          rfq={details.rfq}
          quotes={details.quotes}
          currentRole={profile.user.role}
          onCounter={async (input) => {
            try {
              await counterQuote(profile.user.id, details.rfq.id, input);
              toast.success('Negotiation updated');
            } catch (err: any) {
              toast.error(err.message || 'Unable to update negotiation');
            }
          }}
        />

        <div className="space-y-6">
          <EscrowStatusCard
            institutionName={details.institution.name}
            bankName={details.bankOrganization.name}
            obligations={details.escrowObligations}
          />

          <Panel title="Operational Notes">
            <div className="space-y-3 font-mono text-sm text-terminal-dim">
              <div>{details.rfq.settlementNotes || 'No settlement notes attached.'}</div>
              {details.settlement ? (
                <div className="rounded-lg border border-terminal-border bg-terminal-bg p-3">
                  <div className="font-mono text-xs uppercase tracking-wider text-terminal-dim">Settlement Status</div>
                  <div className="mt-2 text-terminal-text">{details.settlement.status}</div>
                </div>
              ) : null}
              {myPendingObligation ? (
                <button type="button" className="btn-primary w-full" onClick={() => setActiveObligation(myPendingObligation)}>
                  Fund My Escrow
                </button>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <SubmitBankQuoteModal
        open={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        onSubmit={async (input) => {
          try {
            await submitBankQuote(profile.user.id, details.rfq.id, input);
            toast.success('Bank quote sent');
          } catch (err: any) {
            toast.error(err.message || 'Unable to send quote');
            throw err;
          }
        }}
      />

      <AcceptQuoteModal
        open={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        bankOrganization={details.bankOrganization}
        rfq={details.rfq}
        quote={selectedQuote ?? null}
        onAccept={async () => {
          try {
            if (!selectedQuote) throw new Error('No quote is available to accept.');
            await acceptQuote(profile.user.id, details.rfq.id, selectedQuote.id);
            toast.success('Quote accepted and escrow initiated');
            setShowAcceptModal(false);
          } catch (err: any) {
            toast.error(err.message || 'Unable to accept quote');
          }
        }}
      />

      <DepositEscrowModal
        open={Boolean(activeObligation)}
        obligation={activeObligation}
        onClose={() => setActiveObligation(null)}
        onSubmit={async (txHash) => {
          try {
            if (!activeObligation) throw new Error('No escrow obligation selected.');
            await submitEscrowDeposit(profile.user.id, activeObligation.id, txHash);
            toast.success('Escrow funding confirmed');
          } catch (err: any) {
            toast.error(err.message || 'Unable to confirm escrow');
            throw err;
          }
        }}
      />
    </div>
  );
}
