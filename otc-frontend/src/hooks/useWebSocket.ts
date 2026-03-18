import { useEffect, useRef, useCallback, useState } from 'react';

type WSEvent = {
  type: 'rfq_created' | 'rfq_cancelled' | 'quote_submitted' | 'quote_rejected' | 'trade_completed' | 'deposit_credited' | 'withdrawal_confirmed' | 'connected';
  data?: any;
  message?: string;
};

type EventHandler = (event: WSEvent) => void;

const WS_URL = 'ws://localhost:3002';

let globalWs: WebSocket | null = null;
const listeners = new Set<EventHandler>();

function ensureConnection() {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) return;
  if (globalWs && globalWs.readyState === WebSocket.CONNECTING) return;

  globalWs = new WebSocket(WS_URL);

  globalWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WSEvent;
      listeners.forEach(handler => handler(data));
    } catch {}
  };

  globalWs.onclose = () => {
    setTimeout(ensureConnection, 3000);
  };

  globalWs.onerror = () => {
    globalWs?.close();
  };
}

export function useWebSocket(onEvent?: EventHandler) {
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);

  useEffect(() => {
    ensureConnection();

    const handler: EventHandler = (event) => {
      setLastEvent(event);
      onEvent?.(event);
    };

    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, [onEvent]);

  return { lastEvent };
}

// Hook that triggers a refresh callback on specific event types
export function useWSRefresh(eventTypes: WSEvent['type'][], refresh: () => void) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const handler = useCallback((event: WSEvent) => {
    if (eventTypes.includes(event.type)) {
      refreshRef.current();
    }
  }, [eventTypes.join(',')]);

  useWebSocket(handler);
}
