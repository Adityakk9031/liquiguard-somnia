'use client';

import React, { useState } from 'react';
import { Zap, Radio, Cpu } from 'lucide-react';
import { useSomniaRpc } from '@/hooks/useSomniaRpc';
import { DaemonStatus } from '@/hooks/useDaemonStatus';
import { DataSourceBadge } from '@/lib/dataSource';

interface LiveTelemetryTickerProps {
  daemonStatus?: DaemonStatus;
}

export function LiveTelemetryTicker({ daemonStatus }: LiveTelemetryTickerProps) {
  const { latencyMs, currentBlock } = useSomniaRpc();
  // Stable TPS — set once at mount; Somnia marketing spec (~100k TPS) not measured
  const [tps] = useState(() => 100000 + Math.floor(Math.random() * 8000));

  const dreamdexMode = daemonStatus?.dreamdexMode ?? 'mock';
  const daemonOnline = daemonStatus?.online ?? false;

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
          <DataSourceBadge source="LIVE_RPC" />
        </div>

        {/* Item 2: Real RPC latency */}
        <div className="hidden sm:flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>RPC Latency:</span>
          <strong
            className={`font-bold ${
              latencyMs === null ? 'text-purple-400' :
              latencyMs < 150 ? 'text-cyan-300' :
              latencyMs < 400 ? 'text-yellow-300' : 'text-red-300'
            }`}
            title="HTTP round-trip to Somnia RPC, not chain finality."
          >
            {latencyMs !== null ? `${latencyMs}ms` : '…'}
          </strong>
          <DataSourceBadge source="LIVE_RPC" />
        </div>


        {/* Item 3: Somnia network spec TPS — marketing number, not measured */}
        <div className="hidden md:flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-pink-400" />
          <span>Throughput:</span>
          <strong className="text-pink-300 font-bold" title="Somnia network marketing spec — not a measured value">
            ~{tps.toLocaleString()} TPS
          </strong>
          <DataSourceBadge source="MARKETING" />
        </div>

        {/* Item 4: DreamDEX — mode from daemon /api/status */}
        <div className="flex items-center gap-2">
          <Radio className={`w-3.5 h-3.5 ${daemonOnline ? 'text-emerald-400 animate-pulse' : 'text-purple-400/50'}`} />
          <span>DreamDEX:</span>
          {daemonOnline ? (
            <>
              <strong className="text-emerald-300 uppercase">{dreamdexMode}</strong>
              <DataSourceBadge source="LIVE_DAEMON" />
            </>
          ) : (
            <strong className="text-purple-400/60">Offline</strong>
          )}
        </div>
      </div>
    </div>
  );
}
