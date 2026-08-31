'use client';

import React, { useState } from 'react';
import { TrendingDown, RefreshCw, Flame } from 'lucide-react';
import { formatUSD } from '@/lib/utils';

interface CrashSimulatorProps {
  basePrice: number;
  currentPrice: number;
  onSimulateDrop: (dropPercentage: number) => void;
  onResetPrice: () => void;
  isSimulating: boolean;
}

export function CrashSimulator({
  basePrice,
  currentPrice,
  onSimulateDrop,
  onResetPrice,
  isSimulating,
}: CrashSimulatorProps) {
  const [dropPercentage, setDropPercentage] = useState<number>(15);

  const targetPrice = basePrice * (1 - dropPercentage / 100);

  const presets = [
    { label: '-5% Dip', value: 5 },
    { label: '-15% (Trigger)', value: 15 },
    { label: '-25% Crash', value: 25 },
    { label: '-35% Black Swan', value: 35 },
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
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20">
            <div className="text-[9px] text-purple-300/70 uppercase">Base Oracle</div>
            <div className="text-sm sm:text-base font-extrabold text-white">{formatUSD(basePrice)}</div>
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
            min="0"
            max="35"
            step="1"
            value={dropPercentage}
            onChange={(e) => setDropPercentage(Number(e.target.value))}
            className="w-full h-2 bg-purple-950/80 rounded-lg appearance-none cursor-pointer accent-pink-500 border border-purple-500/30"
          />

          <div className="grid grid-cols-4 gap-1 pt-1">
            {presets.map((p) => (
              <button
                key={p.value}
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
