'use client';

import React from 'react';
import { HedgeStatus } from '@/types';
import { ShieldCheck, Zap, CheckCircle2, TrendingDown } from 'lucide-react';
import { formatUSD } from '@/lib/utils';
import { useSomniaRpc } from '@/hooks/useSomniaRpc';
import { DataSourceBadge, StatusChip, CardChipRow } from '@/lib/dataSource';

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
  const { latencyMs } = useSomniaRpc(); // shared — no duplicate fetch

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header */}
      <div className="flex flex-col gap-1.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30 shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white tracking-tight leading-snug whitespace-nowrap">Sentinel Guard</h4>
            <p className="text-[10px] text-purple-300/70">DreamDEX Automated Hedging</p>
          </div>
        </div>
        <CardChipRow>
          <DataSourceBadge source="LIVE_DAEMON" />
          {effectiveStatus === HedgeStatus.IDLE && (
            <StatusChip tone="emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              IDLE SAFE
            </StatusChip>
          )}
          {effectiveStatus === HedgeStatus.HEDGING && (
            <StatusChip tone="amber" pulse>
              HEDGING
            </StatusChip>
          )}
          {effectiveStatus === HedgeStatus.PROTECTED && (
            <StatusChip tone="cyan">PROTECTED</StatusChip>
          )}
        </CardChipRow>
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
              <span>Micro-Hedge Settled &amp; Repaid!</span>
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
          <div className="text-[9px] text-purple-300/70">RPC Latency:</div>
          <div className={`text-xs sm:text-sm font-mono font-bold ${
            latencyMs === null ? 'text-purple-400' :
            latencyMs < 150 ? 'text-cyan-300' :
            latencyMs < 400 ? 'text-yellow-300' : 'text-red-300'
          }`}>
            {latencyMs === null ? '—ms' : `${latencyMs}ms`}
          </div>
        </div>
      </div>
    </div>
  );
}
