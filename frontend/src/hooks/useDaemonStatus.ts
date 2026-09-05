'use client';

import { useState, useEffect, useCallback } from 'react';

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:3001';

export interface DaemonStatus {
  online: boolean;
  dreamdexMode: 'mock' | 'live';
  defaultMarket: string;
  entryPrice: number;
  strikePrice: number;
  marketsCount: number;
  isVaultLive: boolean;
  currentEthPrice: number;
  watchedVaults: number;
  lastPollAt: number | null;
}

const DEFAULT_STATUS: DaemonStatus = {
  online: false,
  dreamdexMode: 'mock',
  defaultMarket: 'ETH-USD-15M-DOWN',
  entryPrice: 0.40,
  strikePrice: 2000,
  marketsCount: 2,
  isVaultLive: true,
  currentEthPrice: 2000,
  watchedVaults: 0,
  lastPollAt: null,
};

export function useDaemonStatus() {
  const [status, setStatus] = useState<DaemonStatus>(DEFAULT_STATUS);

  const poll = useCallback(async () => {
    try {
      const resp = await fetch(`${DAEMON_URL}/api/status`, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) {
        setStatus((prev) => ({ ...prev, online: false }));
        return;
      }
      const data = await resp.json();
      setStatus({
        online: true,
        dreamdexMode: data.dreamdex?.mode ?? 'mock',
        defaultMarket: data.dreamdex?.defaultMarket ?? 'ETH-USD-15M-DOWN',
        entryPrice: data.dreamdex?.entryPrice ?? 0.40,
        strikePrice: data.dreamdex?.strikePrice ?? 2000,
        marketsCount: data.dreamdex?.marketsCount ?? 2,
        isVaultLive: data.chain?.contracts?.isVaultLive ?? true,
        currentEthPrice: data.oracle?.currentEthPrice ?? 2000,
        watchedVaults: data.monitor?.watchedVaults ?? 0,
        lastPollAt: data.monitor?.lastPollAt ?? null,
      });
    } catch {
      setStatus((prev) => ({ ...prev, online: false }));
    }
  }, []);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 10_000);
    return () => clearInterval(iv);
  }, [poll]);

  return status;
}
