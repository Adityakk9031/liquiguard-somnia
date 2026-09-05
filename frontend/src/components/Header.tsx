'use client';

import React, { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield, Zap, ExternalLink, Layers } from 'lucide-react';
import { useSomniaRpc } from '@/hooks/useSomniaRpc';

interface HeaderProps {
  onOpenArchitecture: () => void;
}

export function Header({ onOpenArchitecture }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { latencyMs } = useSomniaRpc(); // shared hook — no duplicate fetch

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 w-full border-0 outline-none ring-0 shadow-none transition-[background-color,backdrop-filter] duration-300 ease-out ${
        scrolled
          ? 'bg-[#070311]/40 backdrop-blur-xl'
          : 'bg-transparent backdrop-blur-none'
      }`}
    >

      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden p-0.5 bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-400 shadow-[0_0_20px_rgba(236,72,153,0.45)]">
            <img
              src="/logo.png"
              alt="LiquiGuard Logo"
              className="w-full h-full object-cover rounded-[10px]"
            />
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
          {/* Somnia Status Pill — shows real measured RPC latency */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm transition-all duration-300 ${
              scrolled
                ? 'bg-purple-950/60 border border-purple-500/25 text-purple-200'
                : 'bg-black/30 border border-white/[0.08] text-purple-200'
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-white/70">Chain 50312</span>
            <span className="text-purple-400/40">|</span>
            <span
              className={`font-mono text-[11px] ${
                latencyMs === null
                  ? 'text-purple-400'
                  : latencyMs < 150
                  ? 'text-cyan-300'
                  : latencyMs < 400
                  ? 'text-yellow-300'
                  : 'text-red-300'
              }`}
            >
              {latencyMs !== null ? `${latencyMs}ms` : '…ms'}
            </span>
          </div>

          {/* Architecture Btn */}
          <button
            onClick={onOpenArchitecture}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all duration-300 ${
              scrolled
                ? 'bg-purple-950/60 border border-purple-500/30 text-purple-200 hover:text-white hover:bg-purple-900/60 hover:border-purple-400/50'
                : 'bg-black/30 border border-white/[0.08] text-purple-200 hover:text-white hover:border-purple-500/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Architecture</span>
          </button>

          {/* Faucet Link */}
          <a
            href="https://testnet.somnia.network/"
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all duration-300 ${
              scrolled
                ? 'bg-pink-950/50 border border-pink-500/30 text-pink-300 hover:text-pink-100 hover:bg-pink-900/60 hover:border-pink-400/50'
                : 'bg-black/30 border border-white/[0.08] text-pink-300 hover:text-pink-200 hover:border-pink-500/40'
            }`}
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
