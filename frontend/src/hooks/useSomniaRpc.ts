'use client';

import { useState, useEffect, useCallback } from 'react';

const SOMNIA_RPC = 'https://dream-rpc.somnia.network';

export interface SomniaRpcState {
  latencyMs: number | null;
  currentBlock: number | null;
}

// Singleton-style shared state so all consumers get the same data from one fetch
let listeners: Array<(state: SomniaRpcState) => void> = [];
let currentState: SomniaRpcState = { latencyMs: null, currentBlock: null };
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

function notifyAll(state: SomniaRpcState) {
  currentState = state;
  for (const fn of listeners) fn(state);
}

async function doPoll() {
  try {
    const t0 = performance.now();
    const res = await fetch(SOMNIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    const ms = Math.round(performance.now() - t0);
    const data = await res.json();
    const blockHex = data?.result;
    notifyAll({
      latencyMs: ms,
      currentBlock: blockHex ? parseInt(blockHex, 16) : currentState.currentBlock,
    });
  } catch {
    // Keep last values on failure
  }
}

function startGlobalPoll() {
  if (pollIntervalId !== null) return;
  doPoll();
  pollIntervalId = setInterval(doPoll, 5000);
}

export function useSomniaRpc(): SomniaRpcState {
  const [state, setState] = useState<SomniaRpcState>(currentState);

  useEffect(() => {
    const cb = (s: SomniaRpcState) => setState(s);
    listeners.push(cb);
    startGlobalPoll();
    // Update immediately with current cached value
    setState(currentState);
    return () => {
      listeners = listeners.filter((fn) => fn !== cb);
    };
  }, []);

  return state;
}
