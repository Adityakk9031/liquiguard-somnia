'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { type PublicClient } from 'viem';
import { ProtocolEvent } from '@/types';
import {
  clearLegacyActivityStorage,
  fetchDaemonActivity,
  fetchOnChainVaultEvents,
  mergeActivityEvents,
} from '@/lib/vaultActivity';

export interface HedgePayoutStats {
  lastPayout: number;
  totalPayout: number;
}

export function useWalletActivity(
  address: string | undefined,
  isConnected: boolean,
) {
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [payoutStats, setPayoutStats] = useState<HedgePayoutStats>({
    lastPayout: 0,
    totalPayout: 0,
  });
  const sessionEventsRef = useRef<ProtocolEvent[]>([]);
  const chainEventsRef = useRef<ProtocolEvent[]>([]);
  const daemonEventsRef = useRef<ProtocolEvent[]>([]);

  const publish = useCallback(() => {
    setEvents(
      mergeActivityEvents([
        ...chainEventsRef.current,
        ...daemonEventsRef.current,
        ...sessionEventsRef.current,
      ]),
    );
  }, []);

  const refreshDaemon = useCallback(async () => {
    if (!isConnected || !address) return;
    const data = await fetchDaemonActivity(address);
    if (!data.ok) return;
    daemonEventsRef.current = data.events;
    setPayoutStats({ lastPayout: data.lastPayout, totalPayout: data.totalPayout });
    publish();
  }, [address, isConnected, publish]);

  const refreshChain = useCallback(async () => {
    if (!isConnected || !address || !publicClient) return;
    try {
      const chainEvents = await fetchOnChainVaultEvents(publicClient as PublicClient, address);
      chainEventsRef.current = mergeActivityEvents([
        ...chainEventsRef.current,
        ...chainEvents,
      ]);
      publish();
    } catch {
      // Keep previously loaded chain events.
    }
  }, [address, isConnected, publicClient, publish]);

  const refreshActivity = useCallback(async () => {
    await Promise.all([refreshDaemon(), refreshChain()]);
  }, [refreshDaemon, refreshChain]);

  const addEvent = useCallback(
    (event: Omit<ProtocolEvent, 'id' | 'timestamp'>) => {
      if (!isConnected || !address) return;

      const now = Date.now();
      const newEvt: ProtocolEvent = {
        ...event,
        id: event.txHash
          ? `session-tx-${event.txHash}-${event.type}`
          : `session-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        sortKey: now,
      };

      sessionEventsRef.current = mergeActivityEvents([newEvt, ...sessionEventsRef.current]).slice(0, 20);
      publish();
    },
    [address, isConnected, publish],
  );

  useEffect(() => {
    if (!isConnected || !address) {
      setEvents([]);
      setIsLoading(false);
      setPayoutStats({ lastPayout: 0, totalPayout: 0 });
      sessionEventsRef.current = [];
      chainEventsRef.current = [];
      daemonEventsRef.current = [];
      return;
    }

    let cancelled = false;
    clearLegacyActivityStorage(address);
    setIsLoading(true);

    const load = async () => {
      await Promise.all([refreshDaemon(), refreshChain()]);
      if (!cancelled) setIsLoading(false);
    };

    load();

    const daemonIv = setInterval(refreshDaemon, 2000);
    const chainIv = setInterval(refreshChain, 8000);
    return () => {
      cancelled = true;
      clearInterval(daemonIv);
      clearInterval(chainIv);
    };
  }, [address, isConnected, refreshDaemon, refreshChain]);

  return { events, addEvent, refreshActivity, payoutStats, isLoading };
}
