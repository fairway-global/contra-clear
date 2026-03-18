import { useState, useEffect, useCallback } from 'react';
import { getActiveRFQs, type RFQ } from '../lib/api';
import { useWSRefresh } from './useWebSocket';

export function useRFQs() {
  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRFQs(await getActiveRFQs());
    } catch (err) {
      console.error('Failed to fetch RFQs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000); // Slower poll, WS handles fast updates
    return () => clearInterval(interval);
  }, [refresh]);

  // Instant refresh on WS events
  useWSRefresh(['rfq_created', 'rfq_cancelled', 'quote_submitted', 'trade_completed'], refresh);

  return { rfqs, loading, refresh };
}
