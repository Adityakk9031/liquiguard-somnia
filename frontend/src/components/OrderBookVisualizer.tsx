'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Zap } from 'lucide-react';

interface OrderBookVisualizerProps {
  currentEthPrice: number;
  strikePrice?: number;
  isHedging?: boolean;
}

export function OrderBookVisualizer({
  currentEthPrice,
  strikePrice = 2000,
  isHedging = false,
}: OrderBookVisualizerProps) {
  const [downAsks, setDownAsks] = useState<{ price: number; amount: number; total: number }[]>([
    { price: 0.44, amount: 2450, total: 2450 },
    { price: 0.42, amount: 5800, total: 8250 },
    { price: 0.40, amount: 18500, total: 26750 },
  ]);

  const [downBids, setDownBids] = useState<{ price: number; amount: number; total: number }[]>([
    { price: 0.39, amount: 14200, total: 14200 },
    { price: 0.38, amount: 9800, total: 24000 },
    { price: 0.36, amount: 6200, total: 30200 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDownAsks((prev) =>
        prev.map((ask) => ({
          ...ask,
          amount: Math.max(1000, ask.amount + (Math.floor(Math.random() * 300) - 150)),
        }))
      );
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const maxTotal = 32000;

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30">
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">DreamDEX CLOB Depth</h4>
            <span className="text-[10px] text-purple-300/70 font-mono">ETH-USD-15M-DOWN</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
            Strike: ${strikePrice}
          </span>
        </div>
      </div>

      {/* ASKS (Rose) */}
      <div className="space-y-0.5 my-1 text-[11px] font-mono">
        {downAsks.map((ask, idx) => {
          const depthPercent = (ask.total / maxTotal) * 100;
          return (
            <div
              key={idx}
              className="relative grid grid-cols-3 py-0.5 px-1.5 rounded hover:bg-white/[0.03]"
            >
              <div
                className="absolute inset-y-0 right-0 bg-rose-500/10 rounded pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-rose-400 font-semibold">${ask.price.toFixed(2)}</span>
              <span className="text-right text-purple-200/80">{ask.amount.toLocaleString()}</span>
              <span className="text-right text-purple-400/60">{ask.total.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {/* Spread Bar */}
      <div className="py-1.5 px-2.5 my-1 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-between text-[11px] font-mono">
        <span className="text-white">Spread: <strong className="text-cyan-300">$0.395</strong></span>
        <span className="text-pink-300 flex items-center gap-1 text-[10px]">
          <Zap className="w-2.5 h-2.5" /> IOC Cap 1.5%
        </span>
      </div>

      {/* BIDS (Emerald) */}
      <div className="space-y-0.5 my-1 text-[11px] font-mono">
        {downBids.map((bid, idx) => {
          const depthPercent = (bid.total / maxTotal) * 100;
          return (
            <div
              key={idx}
              className="relative grid grid-cols-3 py-0.5 px-1.5 rounded hover:bg-white/[0.03]"
            >
              <div
                className="absolute inset-y-0 right-0 bg-emerald-500/10 rounded pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <span className="text-emerald-400 font-semibold">${bid.price.toFixed(2)}</span>
              <span className="text-right text-purple-200/80">{bid.amount.toLocaleString()}</span>
              <span className="text-right text-purple-400/60">{bid.total.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-purple-300/70 font-mono">
        <span>Window: 15m</span>
        <span className="text-emerald-300">Live Synced</span>
      </div>
    </div>
  );
}
