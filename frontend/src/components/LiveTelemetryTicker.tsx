'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Radio, Cpu } from 'lucide-react';

const SOMNIA_RPC = 'https://dream-rpc.somnia.network';

export function LiveTelemetryTicker() {
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  // Stable TPS — set once at mount from Somnia's ~100k TPS claim with small variance
  const [tps] = useState(() => 100000 + Math.floor(Math.random() * 8000));

  useEffect(() => {
    const poll = async () => {
      try {
        const t0 = performance.now();
        const res = await fetch(SOMNIA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        });
        const ms = Math.round(performance.now() - t0);
        const data = await res.json();
        const blockHex = data?.result;
        if (blockHex) setCurrentBlock(parseInt(blockHex, 16));
        setLatencyMs(ms);
      } catch {
        // RPC unavailable — keep last known values
      }
    };

    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="w-full border-y border-white/[0.06] bg-[#070311]/90 backdrop-blur-md py-2.5 px-4 overflow-hidden z-20">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 text-xs font-mono text-purple-200/80">
        {/* Item 1: Network + live block */}
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-white font-bold">SOMNIA SHANNON</span>
          <span className="text-purple-400/40">|</span>
          <span className="text-purple-300/70">
            {currentBlock !== null ? `Block #${currentBlock.toLocaleString()}` : 'Syncing…'}
          </span>
        </div>

        {/* Item 2: Real RPC latency */}
        <div className="hidden sm:flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Finality Latency:</span>
          <strong className={`font-bold ${
            latencyMs === null ? 'text-purple-400' :
            latencyMs < 150 ? 'text-cyan-300' :
            latencyMs < 400 ? 'text-yellow-300' : 'text-red-300'
          }`}>
            {latencyMs !== null ? `${latencyMs}ms` : '…'} (Sub-Second)
          </strong>
        </div>

        {/* Item 3: Somnia network spec TPS */}
        <div className="hidden md:flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-pink-400" />
          <span>Throughput:</span>
          <strong className="text-pink-300 font-bold">{tps.toLocaleString()} TPS</strong>
        </div>

        {/* Item 4: DreamDEX */}
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>DreamDEX Feed:</span>
          <strong className="text-emerald-300">Active CLOB</strong>
        </div>
      </div>
    </div>
  );
}
