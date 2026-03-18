import { useState, useEffect } from 'react';
import { getHealth } from '../lib/api';

export function useContraHealth() {
  const [connected, setConnected] = useState(false);
  const [slot, setSlot] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const health = await getHealth();
        setConnected(health.status === 'ok');
        setSlot(health.contraSlot || 0);
      } catch {
        setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return { connected, slot };
}
