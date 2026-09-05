'use client';

import { useState, useEffect, useCallback } from 'react';

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:3001';

export interface BinaryMarket {
  id: string;
  ticker: string;
  underlying: string;
  strikePrice: number;
  expiryTimestamp: number;
  durationMinutes: number;
  downPrice: number;
  upPrice: number;
  status: 'OPEN' | 'RESOLVING' | 'RESOLVED_DOWN' | 'RESOLVED_UP';
  totalLiquidityUSDC: number;
}

export interface DreamDexMarketsState {
  markets: BinaryMarket[];
  mode: 'mock' | 'live';
  loading: boolean;
}

export function useDreamDexMarkets(): DreamDexMarketsState {
  const [markets, setMarkets] = useState<BinaryMarket[]>([]);
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [loading, setLoading] = useState(true);

  const poll = useCallback(async () => {
    try {
      const resp = await fetch(`${DAEMON_URL}/api/markets`, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.markets)) {
        setMarkets(data.markets);
        setMode(data.mode ?? 'mock');
        setLoading(false);
      }
    } catch {
      // Daemon offline — keep last known
    }
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [poll]);

  return { markets, mode, loading };
}
