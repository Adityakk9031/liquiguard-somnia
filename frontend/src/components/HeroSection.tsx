'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Shield, Zap, Sparkles, ArrowRight, Layers, Lock, Cpu, ArrowDownRight, Radio } from 'lucide-react';

interface HeroSectionProps {
  onExploreClick: () => void;
  onLaunchVault: () => void;
}

export function HeroSection({ onExploreClick, onLaunchVault }: HeroSectionProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = ((clientX - left) / width - 0.5) * 20;
    const y = ((clientY - top) / height - 0.5) * 20;
    setMousePos({ x, y });
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative pt-10 pb-20 px-4 md:px-8 max-w-7xl mx-auto overflow-hidden"
    >
      {/* Background Ambient Orbs */}
      <div className="absolute top-12 left-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-20 right-1/4 w-[450px] h-[450px] bg-pink-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Typography & CTAs */}
        <div className="lg:col-span-7 space-y-7 z-10">
          {/* Somnia Shannon Tag */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-200 text-xs font-semibold backdrop-blur-xl shadow-[0_0_25px_rgba(168,85,247,0.25)]">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
            </span>
            <span>Somnia Shannon Testnet • Sub-100ms Micro-Hedging</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-white">
            Zero-Liquidation <br />
            <span className="text-gradient-purple">Lending Vaults</span> <br />
            <span className="text-gradient-sunset">On Somnia Network</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-purple-200/75 max-w-xl leading-relaxed font-normal">
            Eliminate liquidation penalties forever. When market crashes threaten your collateral, 
            LiquiGuard executes high-speed Immediate-or-Cancel binary event contracts on DreamDEX to 
            fund instantaneous debt self-healing.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={onLaunchVault}
              className="glow-btn-primary px-7 py-4 rounded-2xl font-bold text-white text-sm flex items-center gap-3 cursor-pointer group"
            >
              <Zap className="w-4 h-4 text-amber-200 fill-amber-200 group-hover:scale-110 transition-transform" />
              <span>Launch Vault Terminal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={onExploreClick}
              className="glass-button px-6 py-4 rounded-2xl font-semibold text-purple-200 text-sm flex items-center gap-2.5 cursor-pointer hover:text-white"
            >
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Explore Architecture</span>
            </button>
          </div>

          {/* Institutional Metrics Bar */}
          <div className="pt-8 border-t border-purple-900/40 grid grid-cols-3 gap-6 max-w-xl">
            <div>
              <div className="text-3xl font-black text-gradient-cyan tracking-tight font-mono">&lt;100ms</div>
              <div className="text-xs text-purple-300/70 mt-1 font-medium">Reactivity Window</div>
            </div>
            <div>
              <div className="text-3xl font-black text-white tracking-tight font-mono">100k+</div>
              <div className="text-xs text-purple-300/70 mt-1 font-medium">Peak Network TPS</div>
            </div>
            <div>
              <div className="text-3xl font-black text-pink-400 tracking-tight font-mono">&lt;$0.0001</div>
              <div className="text-xs text-purple-300/70 mt-1 font-medium">Micro-Hedge Gas</div>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Holographic Core Artwork with 3D Parallax */}
        <div className="lg:col-span-5 relative flex justify-center items-center">
          <div
            className="relative w-full max-w-[460px] aspect-square rounded-3xl overflow-hidden glass-panel-glow p-2 transition-transform duration-200 ease-out"
            style={{
              transform: `perspective(1000px) rotateY(${mousePos.x * 0.4}deg) rotateX(${-mousePos.y * 0.4}deg)`,
            }}
          >
            {/* Background Artwork */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image
                src="/images/hologram_core.jpg"
                alt="Somnia LiquiGuard Quantum Security Core"
                fill
                priority
                className="object-cover scale-105 transition-transform duration-700 hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080312] via-transparent to-transparent opacity-70" />
            </div>

            {/* Floating Telemetry Badge 1 */}
            <div className="absolute top-6 left-6 glass-panel px-4 py-2.5 rounded-2xl border border-purple-400/30 flex items-center gap-3 shadow-2xl backdrop-blur-xl">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <div className="text-xs font-bold text-white">Sentinel Active</div>
                <div className="text-[10px] text-purple-300/80 font-mono">DreamDEX CLOB Feed</div>
              </div>
            </div>

            {/* Floating Telemetry Badge 2 */}
            <div className="absolute bottom-6 right-6 glass-panel px-4 py-2.5 rounded-2xl border border-pink-400/30 flex items-center gap-3 shadow-2xl backdrop-blur-xl">
              <Shield className="w-5 h-5 text-pink-400" />
              <div>
                <div className="text-xs font-bold text-white">HF Trigger Protocol</div>
                <div className="text-[10px] text-pink-300 font-mono">1.30 Threshold</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
