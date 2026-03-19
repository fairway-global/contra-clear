import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type {
  CounterQuoteInput,
  CreateInstitutionInput,
  CreateRFQInput,
  PlatformSnapshot,
  SubmitQuoteInput,
} from '../types/platform';
import { getPlatformSnapshot, resetPlatformSnapshot } from '../lib/platformStore';
import * as platformService from '../lib/platformService';

interface PlatformContextValue {
  snapshot: PlatformSnapshot;
  refresh: () => void;
  resetDemoData: () => void;
  createInstitution: (actorUserId: string, input: CreateInstitutionInput) => Promise<any>;
  createRFQ: (actorUserId: string, input: CreateRFQInput) => Promise<any>;
  submitBankQuote: (actorUserId: string, rfqId: string, input: SubmitQuoteInput) => Promise<any>;
  counterQuote: (actorUserId: string, rfqId: string, input: CounterQuoteInput) => Promise<any>;
  acceptQuote: (actorUserId: string, rfqId: string, quoteId: string) => Promise<any>;
  submitEscrowDeposit: (actorUserId: string, obligationId: string, txHash: string) => Promise<any>;
}

const PlatformContext = createContext<PlatformContextValue | undefined>(undefined);

export function PlatformProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>(() => getPlatformSnapshot());

  const refresh = () => {
    setSnapshot(getPlatformSnapshot());
  };

  const resetDemoData = () => {
    setSnapshot(resetPlatformSnapshot());
  };

  const value = useMemo<PlatformContextValue>(() => ({
    snapshot,
    refresh,
    resetDemoData,
    createInstitution: async (actorUserId, input) => {
      const result = await platformService.createInstitution(actorUserId, input);
      refresh();
      return result;
    },
    createRFQ: async (actorUserId, input) => {
      const result = await platformService.createRFQ(actorUserId, input);
      refresh();
      return result;
    },
    submitBankQuote: async (actorUserId, rfqId, input) => {
      const result = await platformService.submitBankQuote(actorUserId, rfqId, input);
      refresh();
      return result;
    },
    counterQuote: async (actorUserId, rfqId, input) => {
      const result = await platformService.counterQuote(actorUserId, rfqId, input);
      refresh();
      return result;
    },
    acceptQuote: async (actorUserId, rfqId, quoteId) => {
      const result = await platformService.acceptQuote(actorUserId, rfqId, quoteId);
      refresh();
      return result;
    },
    submitEscrowDeposit: async (actorUserId, obligationId, txHash) => {
      const result = await platformService.submitEscrowDeposit(actorUserId, obligationId, txHash);
      refresh();
      return result;
    },
  }), [snapshot]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error('usePlatform must be used inside PlatformProvider');
  return context;
}
