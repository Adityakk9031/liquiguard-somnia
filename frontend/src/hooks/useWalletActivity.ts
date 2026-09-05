'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { type PublicClient } from 'viem';
import { ProtocolEvent } from '@/types';
import {
  clearLegacyActivityStorage,
  fetchDaemonHedgeEvents,
  fetchOnChainVaultEvents,
  mergeActivityEvents,
} from '@/lib/vaultActivity';

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:3001';

export interface HedgePayoutStats {
  lastPayout: number;
  totalPayout: number;
}

async function fetchHedgePayoutStats(userAddress: string): Promise<HedgePayoutStats> {
  try {
    const resp = await fetch(
      `${DAEMON_URL}/api/history?address=${encodeURIComponent(userAddress)}&limit=50`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!resp.ok) return { lastPayout: 0, totalPayout: 0 };
    const data = await resp.json();
    if (!Array.isArray(data.history)) return { lastPayout: 0, totalPayout: 0 };

    const user = userAddress.toLowerCase();
    const userHistory = data.history.filter(
      (h: { userAddress?: string }) => h.userAddress?.toLowerCase() === user,
    );

    const completed = userHistory.filter(
      (h: { status?: string; payoutUSDC?: number }) =>
        h.status === 'COMPLETED' || (h.payoutUSDC && Number(h.payoutUSDC) > 0),
    );

    const totalPayout = completed.reduce(
      (sum: number, h: { payoutUSDC?: number }) => sum + (Number(h.payoutUSDC) || 0),
      0,
    );

    const latest = completed[0];
    const lastPayout = latest ? Number(latest.payoutUSDC) || 0 : 0;

    return { lastPayout, totalPayout };
  } catch {
    return { lastPayout: 0, totalPayout: 0 };
  }
}

export function useWalletActivity(
  address: string | undefined,
  isConnected: boolean,
) {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [payoutStats, setPayoutStats] = useState<HedgePayoutStats>({
    lastPayout: 0,
    totalPayout: 0,
  });
  const sessionEventsRef = useRef<ProtocolEvent[]>([]);

  const refreshActivity = useCallback(async () => {
    if (!isConnected || !address || !publicClient) return;

    const [chainEvents, daemonEvents, stats] = await Promise.all([
      fetchOnChainVaultEvents(publicClient as PublicClient, address),
      fetchDaemonHedgeEvents(address),
      fetchHedgePayoutStats(address),
    ]);

    setPayoutStats(stats);

    const merged = mergeActivityEvents([
      ...chainEvents,
      ...daemonEvents,
      ...sessionEventsRef.current,
    ]);
    setEvents(merged);
  }, [address, isConnected, publicClient]);

  const addEvent = useCallback(
    (event: Omit<ProtocolEvent, 'id' | 'timestamp'>) => {
      if (!isConnected || !address) return;

      const newEvt: ProtocolEvent = {
        ...event,
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      };

      sessionEventsRef.current = [newEvt, ...sessionEventsRef.current].slice(0, 20);
      setEvents((prev) => mergeActivityEvents([newEvt, ...prev]));
    },
    [address, isConnected],
  );

  useEffect(() => {
    if (!isConnected || !address) {
      setEvents([]);
      setPayoutStats({ lastPayout: 0, totalPayout: 0 });
      sessionEventsRef.current = [];
      return;
    }

    clearLegacyActivityStorage(address);
    refreshActivity();

    const interval = setInterval(refreshActivity, 3000);
    return () => clearInterval(interval);
  }, [address, isConnected, refreshActivity]);

  return { events, addEvent, refreshActivity, payoutStats };
}
