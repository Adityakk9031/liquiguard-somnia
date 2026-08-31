'use client';

import React, { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield, Zap, ExternalLink, Layers } from 'lucide-react';

interface HeaderProps {
  onOpenArchitecture: () => void;
}

export function Header({ onOpenArchitecture }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-[#070311]/80 backdrop-blur-2xl border-b border-white/[0.07] shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
          : 'bg-transparent backdrop-blur-none border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-rose-500 p-0.5 shadow-[0_0_16px_rgba(236,72,153,0.5)]">
            <div className="w-full h-full bg-[#0d041a] rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-pink-400 fill-pink-400/20" />
            </div>
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-white leading-none">
              Liqui<span className="text-gradient-sunset">Guard</span>
            </span>
            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-600/80 text-white uppercase tracking-wider">
              Somnia
            </span>
          </div>
        </div>

        {/* Right: Nav Actions */}
        <div className="flex items-center gap-2">
          {/* Somnia Status Pill */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/30 border border-white/[0.08] text-xs font-medium text-purple-200 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-white/70">Chain 50312</span>
            <span className="text-purple-400/40">|</span>
            <span className="text-cyan-300 font-mono text-[11px]">&lt;100ms</span>
          </div>

          {/* Architecture Btn */}
          <button
            onClick={onOpenArchitecture}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 border border-white/[0.08] text-xs font-semibold text-purple-200 hover:text-white hover:border-purple-500/40 transition-all backdrop-blur-sm"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Architecture</span>
          </button>

          {/* Faucet Link */}
          <a
            href="https://testnet.somnia.network/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 border border-white/[0.08] text-xs font-semibold text-pink-300 hover:text-pink-200 hover:border-pink-500/40 transition-all backdrop-blur-sm"
          >
            <Zap className="w-3.5 h-3.5 text-pink-400 fill-pink-400/30" />
            <span>Faucet</span>
            <ExternalLink className="w-3 h-3 text-pink-400/60" />
          </a>

          {/* Wallet Connect */}
          <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
          />
        </div>
      </div>
    </header>
  );
}
