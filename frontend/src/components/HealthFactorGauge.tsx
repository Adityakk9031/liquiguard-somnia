'use client';

import { Shield } from 'lucide-react';
import { formatUSD, formatMetricUSD, getHealthFactorStatus } from '@/lib/utils';
import { DataSourceBadge, StatusChip, CardChipRow } from '@/lib/dataSource';


interface HealthFactorGaugeProps {
  healthFactor: number;
  collateralUSD: number;
  borrowedUSD: number;
  collateralETH: number;
  ethPrice: number;
  liquidationPrice: number;
  priceIsSimulated?: boolean;
}

export function HealthFactorGauge({
  healthFactor,
  collateralUSD,
  borrowedUSD,
  collateralETH,
  ethPrice,
  liquidationPrice,
  priceIsSimulated = false,
}: HealthFactorGaugeProps) {
  const minHF = 0.5;
  const maxHF = 2.5;
  const clampedHF = Math.min(Math.max(healthFactor, minHF), maxHF);
  const percentage = ((clampedHF - minHF) / (maxHF - minHF)) * 100;

  const radius = 80;
  const strokeWidth = 12;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getGradientId = () => {
    if (healthFactor >= 1.5) return 'gauge-emerald';
    if (healthFactor >= 1.3) return 'gauge-amber';
    return 'gauge-rose';
  };

  return (
    <div className="rounded-2xl glass-panel-glow p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header */}
      <div className="flex flex-col gap-1.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30 shrink-0">
            <Shield className="w-4 h-4 text-pink-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white tracking-tight leading-snug whitespace-nowrap">Vault Health Factor</h3>
            <p className="text-[10px] text-purple-300/70">Somnia Sentinel Guard</p>
          </div>
        </div>
        <CardChipRow>
          <DataSourceBadge source={priceIsSimulated ? 'SIMULATED' : 'LIVE_ONCHAIN'} />
          <StatusChip
            tone={healthFactor >= 1.5 ? 'emerald' : healthFactor >= 1.3 ? 'amber' : 'rose'}
            pulse={healthFactor < 1.3}
          >
            {priceIsSimulated ? 'LOCAL EST.' : getHealthFactorStatus(healthFactor)}
          </StatusChip>
        </CardChipRow>
      </div>


      {/* SVG Radial Gauge */}
      <div className="relative flex flex-col items-center justify-center my-2">
        <svg
          viewBox="0 0 200 115"
          className="w-48 sm:w-56 overflow-visible"
        >
          <defs>
            <linearGradient id="gauge-bg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2e1065" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.3" />
            </linearGradient>

            <linearGradient id="gauge-emerald" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            <linearGradient id="gauge-amber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>

            <linearGradient id="gauge-rose" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>

          {/* Background Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#gauge-bg)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={`url(#${getGradientId()})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center Text Readout */}
        <div className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            {healthFactor.toFixed(2)}
          </div>
          <div className="text-[10px] font-semibold text-purple-300/80">
            Health Factor
          </div>
        </div>

        {/* Scale Legend */}
        <div className="w-full flex items-center justify-between text-[10px] font-medium text-purple-300/60 px-2 mt-1">
          <span className="text-rose-400">1.00 Liq</span>
          <span className="text-amber-400">1.30 Hedge</span>
          <span className="text-emerald-400">1.50+ Safe</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-purple-900/30">
        <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/20 text-center min-w-0 overflow-hidden">
          <div className="text-[9px] text-purple-300/70 font-medium truncate">Collateral</div>
          <div
            className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate tracking-tight"
            title={formatUSD(collateralUSD)}
          >
            {formatMetricUSD(collateralUSD)}
          </div>
          <div className="text-[9px] text-cyan-300 font-mono truncate">{collateralETH.toFixed(1)} WETH</div>
        </div>

        <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/20 text-center min-w-0 overflow-hidden">
          <div className="text-[9px] text-purple-300/70 font-medium truncate">Debt</div>
          <div
            className="text-xs sm:text-sm font-bold text-pink-300 mt-0.5 truncate tracking-tight"
            title={formatUSD(borrowedUSD)}
          >
            {formatMetricUSD(borrowedUSD)}
          </div>
          <div className="text-[9px] text-purple-300/60 font-mono truncate">tUSDC</div>
        </div>

        <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/20 text-center min-w-0 overflow-hidden">
          <div className="text-[9px] text-purple-300/70 font-medium truncate">Liq. Price</div>
          <div
            className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5 truncate tracking-tight"
            title={formatUSD(liquidationPrice)}
          >
            {formatMetricUSD(liquidationPrice)}
          </div>
          <div className="text-[9px] text-purple-300/60 font-mono truncate">ETH</div>
        </div>
      </div>

    </div>
  );
}
