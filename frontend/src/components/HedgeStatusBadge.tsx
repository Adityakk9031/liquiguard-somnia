'use client';

import React from 'react';
import { HedgeStatus } from '@/types';
import { ShieldCheck, Zap, RefreshCw, CheckCircle2, TrendingDown } from 'lucide-react';
import { formatUSD } from '@/lib/utils';

interface HedgeStatusBadgeProps {
  status: HedgeStatus;
  lastPayoutUSD: number;
  currentHF: number;
  isHedging?: boolean;
}

export function HedgeStatusBadge({
  status,
  lastPayoutUSD,
  currentHF,
  isHedging,
}: HedgeStatusBadgeProps) {
  const effectiveStatus = isHedging ? HedgeStatus.HEDGING : status;

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">Sentinel Guard</h4>
            <p className="text-[10px] text-purple-300/70">DreamDEX Automated Hedging</p>
          </div>
        </div>

        {/* Dynamic Badge */}
        {effectiveStatus === HedgeStatus.IDLE && (
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>IDLE (SAFE)</span>
          </div>
        )}

        {effectiveStatus === HedgeStatus.HEDGING && (
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/50 flex items-center gap-1 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            <span>HEDGING</span>
          </div>
        )}

        {effectiveStatus === HedgeStatus.PROTECTED && (
          <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-500/50 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span>PROTECTED</span>
          </div>
        )}
      </div>

      {/* State Box */}
      <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/20 my-2 space-y-1.5">
        {effectiveStatus === HedgeStatus.IDLE && (
          <div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Collateral Health Normal</span>
            </div>
            <p className="text-[11px] text-purple-200/70 mt-1">
              Sentinel polls DreamDEX CLOB. If HF &lt; 1.30, an Immediate-or-Cancel DOWN order executes.
            </p>
          </div>
        )}

        {effectiveStatus === HedgeStatus.HEDGING && (
          <div>
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs">
              <TrendingDown className="w-3.5 h-3.5 animate-bounce" />
              <span>Risk Detected: Hedging Active</span>
            </div>
            <p className="text-[11px] text-purple-200/70 mt-1">
              Submitting IOC DOWN order on Somnia. Awaiting settlement...
            </p>
          </div>
        )}

        {effectiveStatus === HedgeStatus.PROTECTED && (
          <div>
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Micro-Hedge Settled & Repaid!</span>
            </div>
            <p className="text-[11px] text-purple-200/70 mt-1">
              Settlement payout was injected into MockLendingPool.repay(). Health factor rebounded!
            </p>
          </div>
        )}
      </div>

      {/* Telemetry Row */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-500/20 text-center">
          <div className="text-[9px] text-purple-300/70">Last Payout:</div>
          <div className="text-xs sm:text-sm font-bold text-emerald-400">
            {lastPayoutUSD > 0 ? `+${formatUSD(lastPayoutUSD)}` : '$0.00'}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-500/20 text-center">
          <div className="text-[9px] text-purple-300/70">Somnia Latency:</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-cyan-300">
            ~78ms
          </div>
        </div>
      </div>
    </div>
  );
}
