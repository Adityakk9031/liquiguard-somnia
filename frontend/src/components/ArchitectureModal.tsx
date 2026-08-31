'use client';

import React from 'react';
import { X, Shield, Zap, ArrowRight, Activity, TrendingDown, CheckCircle2, Lock } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArchitectureModal({ isOpen, onClose }: ArchitectureModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg bg-slate-800 p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              How LiquiGuard Micro-Hedging Works on Somnia
            </h2>
            <p className="text-xs text-slate-400">
              Autonomous Liquidation Protection Powered by DreamDEX Binary Event Contracts
            </p>
          </div>
        </div>

        {/* Architecture Flow Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 my-6">
          {/* Step 1 */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-cyan-400 font-bold mb-2">
                <span>STEP 1</span>
                <Lock className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">User Vault</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                User supplies WETH collateral to LiquiGuard Vault and borrows tUSDC with safe initial HF (e.g. 1.67).
              </p>
            </div>
            <div className="mt-3 text-[10px] text-emerald-400 font-mono">
              HF &gt; 1.50 (Safe)
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-rose-400 font-bold mb-2">
                <span>STEP 2</span>
                <TrendingDown className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">Market Dip</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                ETH price drops on-chain. Collateral value decreases, pushing Health Factor down toward danger zone.
              </p>
            </div>
            <div className="mt-3 text-[10px] text-amber-400 font-mono">
              HF drops &lt; 1.30
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-2">
                <span>STEP 3</span>
                <Zap className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">Somnia Sentinel</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Sentinel detects HF &lt; 1.30 within Somnia&apos;s sub-second block and triggers reactive micro-hedging.
              </p>
            </div>
            <div className="mt-3 text-[10px] text-cyan-300 font-mono">
              ⚡ &lt; 100ms Latency
            </div>
          </div>

          {/* Step 4 */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-purple-400 font-bold mb-2">
                <span>STEP 4</span>
                <Activity className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">DreamDEX IOC</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Instant high-leverage DOWN Event Contract order is placed on DreamDEX to hedge the position.
              </p>
            </div>
            <div className="mt-3 text-[10px] text-purple-300 font-mono">
              IOC Binary Short
            </div>
          </div>

          {/* Step 5 */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-2">
                <span>STEP 5</span>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm text-white mb-1">Debt Repaid</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Hedge settlement profits automatically pay down debt in the lending pool, lifting HF back above 1.50!
              </p>
            </div>
            <div className="mt-3 text-[10px] text-emerald-400 font-mono">
              HF Restored &gt; 1.50
            </div>
          </div>
        </div>

        {/* Why Somnia Section */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
            Why Somnia Shannon Testnet?
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div>
              <p className="font-semibold text-white">⚡ Sub-Second Finality</p>
              <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">
                Liquidations take seconds to execute on standard chains. Somnia&apos;s sub-second block finality enables the hedge to settle BEFORE liquidators can trigger collateral seizure.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">🏎️ 100k+ TPS &amp; Sub-Cent Fees</p>
              <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">
                Micro-hedging small retail positions is financially viable on Somnia due to near-zero gas costs (&lt; $0.0001 per transaction).
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">🎯 DreamDEX Event Contracts</p>
              <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">
                Instant-or-Cancel binary event contracts provide precise downside coverage with known risk/reward payout ratios.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg hover:brightness-110 transition-all"
          >
            Got it, return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
