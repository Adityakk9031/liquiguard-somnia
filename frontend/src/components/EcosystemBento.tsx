'use client';

import React from 'react';
import { Shield, Zap, TrendingDown, Cpu, RefreshCw, Lock, Radio, Activity } from 'lucide-react';

export function EcosystemBento() {
  const features = [
    {
      icon: Zap,
      title: 'Somnia Sub-Second Reactivity',
      badge: 'Reactive EVM',
      desc: 'No sluggish 12-second block intervals. Somnia Shannon delivers sub-100ms finality to detect price volatility and dispatch defense orders before toxic liquidators can extract value.',
      gradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      icon: TrendingDown,
      title: 'DreamDEX Binary Event Hedging',
      badge: 'CLOB Liquidity',
      desc: 'Direct integration with Somnia\'s order book event markets. LiquiGuard submits Immediate-or-Cancel (IOC) DOWN outcome contracts to lock in high delta payout when collateral drops.',
      gradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
      borderColor: 'border-pink-500/30',
      iconColor: 'text-pink-400',
    },
    {
      icon: RefreshCw,
      title: 'Automated Debt Self-Healing',
      badge: 'Delta Neutral',
      desc: 'Winning binary payouts are settled and instantaneously injected into the lending pool\'s repay() hook, resetting Health Factor from critical (<1.10) back to safe (>1.50).',
      gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
      borderColor: 'border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Lock,
      title: 'Non-Custodial Session Relayer',
      badge: 'Scoped Security',
      desc: 'The backend keeper is restricted strictly to calling executeProtectionHedge() on behalf of users. It has zero withdrawal permissions or custody of collateral.',
      gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <section className="py-16 px-4 md:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-semibold uppercase tracking-wider">
          <Activity className="w-3.5 h-3.5 text-pink-400" />
          <span>Next-Gen DeFi Architecture</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          How Somnia Powers <span className="text-gradient-purple">Unliquidatable Vaults</span>
        </h2>
        <p className="text-sm sm:text-base text-purple-200/70">
          Traditional DeFi lending loses billions to predatory liquidators. LiquiGuard transforms 
          liquidation risk into a closed-loop automated micro-hedge.
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((f, idx) => {
          const Icon = f.icon;
          return (
            <div
              key={idx}
              className={`relative rounded-2xl glass-panel p-6 border ${f.borderColor} bg-gradient-to-b ${f.gradient} flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] group`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-white/[0.05] border border-white/10 ${f.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.06] text-purple-200 border border-white/10">
                    {f.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight group-hover:text-purple-200 transition-colors">
                  {f.title}
                </h3>
                <p className="text-xs text-purple-200/70 leading-relaxed font-normal">
                  {f.desc}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-purple-300/80 font-medium">
                <span>Phase 0{idx + 1}</span>
                <span className="text-cyan-300 font-mono">Active on Somnia</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
