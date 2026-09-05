'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Zap } from 'lucide-react';
import { BinaryMarket } from '@/hooks/useDreamDexMarkets';
import { DataSourceBadge, StatusChip, CardChipRow } from '@/lib/dataSource';

interface OrderBookVisualizerProps {
  currentEthPrice: number;
  strikePrice?: number;
  isHedging?: boolean;
  market?: BinaryMarket | null;
  mode?: 'mock' | 'live';
}

export function OrderBookVisualizer({
  currentEthPrice,
  strikePrice = 2000,
  isHedging = false,
  market = null,
  mode = 'mock',
}: OrderBookVisualizerProps) {
  // Use real market prices when available, otherwise fallback to defaults
  const effectiveDownPrice = market?.downPrice ?? 0.40;
  const effectiveUpPrice = market?.upPrice ?? 0.60;
  const effectiveStrike = market?.strikePrice ?? strikePrice;
  const marketId = market?.id ?? 'ETH-USD-15M-DOWN';

  const [downAsks, setDownAsks] = useState<{ price: number; amount: number; total: number }[]>([
    { price: effectiveDownPrice + 0.04, amount: 2450, total: 2450 },
    { price: effectiveDownPrice + 0.02, amount: 5800, total: 8250 },
    { price: effectiveDownPrice, amount: 18500, total: 26750 },
  ]);

  const [downBids, setDownBids] = useState<{ price: number; amount: number; total: number }[]>([
    { price: effectiveDownPrice - 0.01, amount: 14200, total: 14200 },
    { price: effectiveDownPrice - 0.02, amount: 9800, total: 24000 },
    { price: effectiveDownPrice - 0.04, amount: 6200, total: 30200 },
  ]);

  // Update order book when market changes
  useEffect(() => {
    setDownAsks([
      { price: effectiveDownPrice + 0.04, amount: 2450, total: 2450 },
      { price: effectiveDownPrice + 0.02, amount: 5800, total: 8250 },
      { price: effectiveDownPrice, amount: 18500, total: 26750 },
    ]);
    setDownBids([
      { price: effectiveDownPrice - 0.01, amount: 14200, total: 14200 },
      { price: effectiveDownPrice - 0.02, amount: 9800, total: 24000 },
      { price: effectiveDownPrice - 0.04, amount: 6200, total: 30200 },
    ]);
  }, [effectiveDownPrice]);

  // Simulated depth jitter (only for simulation—not real liquidity)
  useEffect(() => {
    const interval = setInterval(() => {
      setDownAsks((prev) => {
        let running = 0;
        return prev.map((ask) => {
          const amount = Math.max(1000, ask.amount + (Math.floor(Math.random() * 300) - 150));
          running += amount;
          return {
            ...ask,
            amount,
            total: running,
          };
        });
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);


  const maxTotal = 32000;
  const entryRowIdx = 2; // The IOC entry row (at effectiveDownPrice)

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30 shrink-0 mt-0.5">
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight leading-snug">DreamDEX CLOB Depth</h4>
            <span className="text-[10px] text-purple-300/70 font-mono block">{marketId}</span>
          </div>
        </div>

        <CardChipRow>
          <DataSourceBadge source="SIMULATED" />
          <StatusChip tone="cyan">STRIKE ${effectiveStrike.toLocaleString()}</StatusChip>
        </CardChipRow>
      </div>

      {/* Hedging Animation Overlay */}
      {isHedging && (
        <div className="mb-1 px-2 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/40 flex items-center gap-1.5 text-[10px] font-mono text-amber-300 animate-pulse">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>IOC DOWN submitted @ ${effectiveDownPrice.toFixed(2)} · Fill pending…</span>
        </div>
      )}

      {/* ASKS (Rose) */}
      <div className="space-y-0.5 my-1 text-[11px] font-mono">
        {downAsks.map((ask, idx) => {
          const depthPercent = (ask.total / maxTotal) * 100;
          const isEntryRow = idx === entryRowIdx;
          return (
            <div
              key={idx}
              className={`relative grid grid-cols-3 py-0.5 px-1.5 rounded hover:bg-white/[0.03] ${
                isHedging && isEntryRow ? 'ring-1 ring-amber-500/60 bg-amber-950/30' : ''
              }`}
            >
              <div
                className="absolute inset-y-0 right-0 bg-rose-500/10 rounded pointer-events-none"
                style={{ width: `${depthPercent}%` }}
              />
              <span className={`font-semibold ${isHedging && isEntryRow ? 'text-amber-300' : 'text-rose-400'}`}>
                ${ask.price.toFixed(2)}
                {isHedging && isEntryRow && <span className="text-[8px] ml-0.5">←IOC</span>}
              </span>
              <span className="text-right text-purple-200/80">{ask.amount.toLocaleString()}</span>
              <span className="text-right text-purple-400/60">{ask.total.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {/* Spread Bar */}
      <div className="py-1.5 px-2.5 my-1 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-between text-[11px] font-mono">
        <span className="text-white">Spread: <strong className="text-cyan-300">${(downAsks[downAsks.length - 1].price - downBids[0].price).toFixed(3)}</strong></span>
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
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-[10px] text-purple-300/70 font-mono min-w-0">
        <span className="truncate">Window: {market?.durationMinutes ?? 15}m · ETH ${currentEthPrice.toLocaleString()}</span>
        <span className="h-5 shrink-0 inline-flex items-center px-2 rounded-md text-[9px] font-bold font-mono uppercase tracking-wide leading-none border border-amber-500/40 bg-amber-950/60 text-amber-300 whitespace-nowrap">
          Depth: Simulated · Prices: {mode === 'live' ? 'live' : 'mock'}
        </span>
      </div>

    </div>
  );
}
