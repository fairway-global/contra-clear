import { useState, useEffect, useCallback } from 'react';
import { getActiveRFQs, type RFQ } from '../lib/api';

export function useRFQs() {
  const [rfqs, setRFQs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getActiveRFQs();
      setRFQs(data);
    } catch (err) {
      console.error('Failed to fetch RFQs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { rfqs, loading, refresh };
}
