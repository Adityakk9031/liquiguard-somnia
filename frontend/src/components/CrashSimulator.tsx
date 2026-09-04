'use client';

import React, { useState, useMemo } from 'react';
import { TrendingDown, RefreshCw, Flame, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatUSD } from '@/lib/utils';

interface CrashSimulatorProps {
  basePrice: number;
  currentPrice: number;
  onSimulateDrop: (dropPercentage: number) => void;
  onResetPrice: () => void;
  isSimulating: boolean;
  depositedWETH?: number;
  borrowedUSDC?: number;
}

export function CrashSimulator({
  basePrice,
  currentPrice,
  onSimulateDrop,
  onResetPrice,
  isSimulating,
  depositedWETH = 0,
  borrowedUSDC = 0,
}: CrashSimulatorProps) {
  // Calculate exact drop % needed to trigger hedge (<1.30 HF) for this vault's position
  // Always calculate from $2000 base (reset price), not from live oracle which could be crashed
  const RESET_PRICE = 2000;
  const triggerDropPercent = useMemo(() => {
    if (depositedWETH > 0 && borrowedUSDC > 0) {
      // P_trigger = (1.15 * debt) / (collateral * 0.80)
      const targetP = (1.15 * borrowedUSDC) / (depositedWETH * 0.80);
      const drop = Math.ceil(((RESET_PRICE - targetP) / RESET_PRICE) * 100);
      return Math.max(15, Math.min(85, drop));
    }
    return 35;
  }, [depositedWETH, borrowedUSDC]);

  const [dropPercentage, setDropPercentage] = useState<number>(triggerDropPercent);

  // Keep the slider default synced when vault position changes
  // Only auto-update if the user hasn't manually dragged from the computed default
  const prevTriggerRef = React.useRef(triggerDropPercent);
  React.useEffect(() => {
    const prev = prevTriggerRef.current;
    if (triggerDropPercent !== prev) {
      // Only update if the user was still at the old computed default (i.e. hadn't manually changed it)
      setDropPercentage((cur) => (cur === prev ? triggerDropPercent : cur));
      prevTriggerRef.current = triggerDropPercent;
    }
  }, [triggerDropPercent]);

  // targetPrice and projectedHF always computed from $2000 reference
  const targetPrice = RESET_PRICE * (1 - dropPercentage / 100);

  // Projected HF at target price
  const projectedHF = useMemo(() => {
    if (depositedWETH > 0 && borrowedUSDC > 0) {
      return (depositedWETH * targetPrice * 0.8) / borrowedUSDC;
    }
    return null;
  }, [depositedWETH, borrowedUSDC, targetPrice]);


  const presets = [
    { label: '-15% Dip', value: 15 },
    { label: '-30% Warning', value: 30 },
    { label: `-${triggerDropPercent}% (Trigger)`, value: triggerDropPercent },
    { label: '-80% Black Swan', value: 80 },
  ];

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-pink-500/25">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-950/80 border border-pink-500/30">
              <Flame className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Market Crash Simulator</h3>
              <p className="text-[10px] text-pink-200/70">Interactive Demo for Judges</p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-pink-900/50 text-pink-300 border border-pink-500/40 uppercase">
            Demo Arena
          </span>
        </div>

        {/* Price Box */}
        <div className="grid grid-cols-2 gap-2 my-2.5">
          <div className={`p-2.5 rounded-xl border ${
            basePrice < 1500
              ? 'bg-red-950/40 border-red-500/40'
              : 'bg-purple-950/40 border-purple-500/20'
          }`}>
            <div className="flex items-center gap-1 text-[9px] uppercase mb-0.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                basePrice < 1500 ? 'bg-red-400' : 'bg-emerald-400'
              }`} />
              <span className={basePrice < 1500 ? 'text-red-300/80' : 'text-purple-300/70'}>
                Live Oracle
              </span>
            </div>
            <div className={`text-sm sm:text-base font-extrabold ${
              basePrice < 1500 ? 'text-red-300' : 'text-white'
            }`}>{formatUSD(basePrice)}</div>
            {basePrice < 1500 && (
              <div className="text-[9px] text-red-400/80 mt-0.5">⚠ CRASHED — hit Reset</div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-pink-950/40 border border-pink-500/30">
            <div className="text-[9px] text-pink-300/80 uppercase">Target Price</div>
            <div className="text-sm sm:text-base font-extrabold text-pink-400">
              {formatUSD(targetPrice)} <span className="text-[10px]">(-{dropPercentage}%)</span>
            </div>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-1.5 my-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-200 text-[11px]">Magnitude:</span>
            <span className="text-pink-400 font-mono font-bold text-xs">-{dropPercentage}%</span>
          </div>

          <input
            type="range"
            min="5"
            max="85"
            step="1"
            value={dropPercentage}
            onChange={(e) => setDropPercentage(Number(e.target.value))}
            className="w-full h-2 bg-purple-950/80 rounded-lg appearance-none cursor-pointer accent-pink-500 border border-purple-500/30"
          />

          {/* Projected HF Feedback */}
          {projectedHF !== null && (
            <div className="flex items-center justify-between text-[10px] px-1 py-0.5">
              <span className="text-purple-300/70">Projected Health Factor:</span>
              <span className={`font-mono font-bold flex items-center gap-1 ${
                projectedHF < 1.30 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}>
                {projectedHF < 1.30 ? (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    <span>{projectedHF.toFixed(2)} (🚨 Triggers Sentinel)</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>{projectedHF.toFixed(2)} (Safe &gt; 1.30)</span>
                  </>
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-1 pt-1">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setDropPercentage(p.value)}
                className={`py-1 px-1 rounded-lg text-[10px] font-medium transition-all ${
                  dropPercentage === p.value
                    ? 'bg-pink-600 text-white font-bold'
                    : 'bg-white/5 text-purple-200 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={() => onSimulateDrop(dropPercentage)}
          disabled={isSimulating}
          className="glow-btn-primary py-2.5 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {isSimulating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-white" />
          )}
          <span>Trigger Crash</span>
        </button>

        <button
          onClick={onResetPrice}
          disabled={isSimulating}
          className="glass-button py-2.5 rounded-xl font-semibold text-purple-200 text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:text-white disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}

