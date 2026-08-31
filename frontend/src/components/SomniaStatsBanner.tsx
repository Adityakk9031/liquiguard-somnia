'use client';

import React from 'react';
import { Zap, ShieldCheck, Cpu, ArrowUpRight } from 'lucide-react';

export function SomniaStatsBanner() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 p-4 backdrop-blur-xl shadow-lg">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Metric 1 */}
        <div className="flex items-center space-x-3 border-r border-slate-800/80 pr-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Somnia Finality
            </p>
            <p className="text-sm font-extrabold text-white flex items-center gap-1">
              &lt; 100ms <span className="text-[10px] text-emerald-400 font-normal">Sub-second</span>
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="flex items-center space-x-3 border-r border-slate-800/80 pr-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Peak Throughput
            </p>
            <p className="text-sm font-extrabold text-white">
              100,000+ <span className="text-[10px] text-purple-400 font-normal">TPS</span>
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="flex items-center space-x-3 border-r border-slate-800/80 pr-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Avg Micro-Hedge Gas
            </p>
            <p className="text-sm font-extrabold text-white">
              &lt; $0.0001 <span className="text-[10px] text-emerald-400 font-normal">STT</span>
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="flex items-center justify-between pl-1">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              DreamDEX Indexer
            </p>
            <p className="text-sm font-extrabold text-cyan-400 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </p>
          </div>

          <a
            href="https://shannon-explorer.somnia.network"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <span>Shannon</span>
            <ArrowUpRight className="h-3 w-3 text-cyan-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
