'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Zap, Shield, Radio, Cpu, RefreshCw } from 'lucide-react';

export function LiveTelemetryTicker() {
  const [latencyMs, setLatencyMs] = useState(84);
  const [currentBlock, setCurrentBlock] = useState(476208120);
  const [tps, setTps] = useState(104820);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatencyMs(Math.floor(Math.random() * 25) + 72); // 72-97ms
      setCurrentBlock((prev) => prev + 1);
      setTps(100000 + Math.floor(Math.random() * 8000));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full border-y border-white/[0.06] bg-[#070311]/90 backdrop-blur-md py-2.5 px-4 overflow-hidden z-20">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 text-xs font-mono text-purple-200/80">
        {/* Item 1: Network */}
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-white font-bold">SOMNIA SHANNON</span>
          <span className="text-purple-400/40">|</span>
          <span className="text-purple-300/70">Block #{currentBlock.toLocaleString()}</span>
        </div>

        {/* Item 2: Latency */}
        <div className="hidden sm:flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>Finality Latency:</span>
          <strong className="text-cyan-300 font-bold">{latencyMs}ms (Sub-Second)</strong>
        </div>

        {/* Item 3: Throughput */}
        <div className="hidden md:flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-pink-400" />
          <span>Throughput:</span>
          <strong className="text-pink-300 font-bold">{tps.toLocaleString()} TPS</strong>
        </div>

        {/* Item 4: DreamDEX Indexer */}
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>DreamDEX Feed:</span>
          <strong className="text-emerald-300">Active CLOB</strong>
        </div>
      </div>
    </div>
  );
}
