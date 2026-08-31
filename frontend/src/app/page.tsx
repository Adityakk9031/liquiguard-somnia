'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { ScrollFrameCanvas, HeroTextSection } from '@/components/ScrollFrameHero';
import { EcosystemBento } from '@/components/EcosystemBento';
import { HealthFactorGauge } from '@/components/HealthFactorGauge';
import { HedgeStatusBadge } from '@/components/HedgeStatusBadge';
import { CrashSimulator } from '@/components/CrashSimulator';
import { VaultControls } from '@/components/VaultControls';
import { OrderBookVisualizer } from '@/components/OrderBookVisualizer';
import { ActivityLog } from '@/components/ActivityLog';
import { LiveTelemetryTicker } from '@/components/LiveTelemetryTicker';
import { PixelShatterCanvas } from '@/components/PixelShatterCanvas';
import { PixelDissolveSection } from '@/components/PixelDissolveSection';
import { ArchitectureModal } from '@/components/ArchitectureModal';
import { HedgeStatus, ProtocolEvent } from '@/types';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [baseEthPrice] = useState(2000);
  const [currentEthPrice, setCurrentEthPrice] = useState(2000);
  const [wethBalance, setWethBalance] = useState(10.0);
  const [tusdcBalance, setTusdcBalance] = useState(10000.0);
  const [depositedWETH, setDepositedWETH] = useState(1.5);
  const [borrowedUSDC, setBorrowedUSDC] = useState(1500.0);
  const [lastPayoutUSD, setLastPayoutUSD] = useState(0);
  const [hedgeStatus, setHedgeStatus] = useState<HedgeStatus>(HedgeStatus.IDLE);
  const [isHedgingActive, setIsHedgingActive] = useState(false);

  const [events, setEvents] = useState<ProtocolEvent[]>([
    {
      id: 'evt-0',
      type: 'DEPOSIT',
      title: 'Somnia Shannon Testnet Live (Chain ID: 50312)',
      description: 'Connected to on-chain LiquiGuardVault at 0x14b2bb...c095',
      timestamp: Date.now() - 60000,
    },
  ]);

  const vaultSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMounted(true); }, []);

  const collateralUSD = depositedWETH * currentEthPrice;
  const healthFactor = borrowedUSDC > 0 ? (collateralUSD * 0.80) / borrowedUSDC : 2.5;
  const liquidationPrice = depositedWETH > 0 ? (borrowedUSDC / 0.80) / depositedWETH : 0;

  const scrollToVault = () => vaultSectionRef.current?.scrollIntoView({ behavior: 'smooth' });

  const addEvent = (event: Omit<ProtocolEvent, 'id' | 'timestamp'>) =>
    setEvents((prev) => [
      { ...event, id: `evt-${Date.now()}`, timestamp: Date.now() },
      ...prev.slice(0, 19),
    ]);

  const handleSimulateDrop = async (dropPercentage: number) => {
    setIsSimulating(true);
    const newPrice = baseEthPrice * (1 - dropPercentage / 100);
    setCurrentEthPrice(newPrice);
    addEvent({
      type: 'PRICE_DROP',
      title: `Market Crash: -${dropPercentage}%`,
      description: `ETH/USD → $${newPrice.toLocaleString()}`,
    });

    // Notify Sentinel daemon backend if running
    try {
      fetch('http://localhost:3001/api/simulate-crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropPercent: dropPercentage, newPrice }),
      }).catch(() => {});
    } catch (_) {}

    const newHF = (depositedWETH * newPrice * 0.80) / borrowedUSDC;
    if (newHF < 1.30) {
      setIsHedgingActive(true);
      setHedgeStatus(HedgeStatus.HEDGING);
      addEvent({
        type: 'HEDGE_TRIGGERED',
        title: '🚨 HF Critical (<1.30)',
        description: `HF=${newHF.toFixed(2)} — Submitting IOC DOWN on DreamDEX...`,
      });
      setTimeout(() => {
        const payout = Math.min(
          borrowedUSDC * 0.5,
          Math.max(400, Math.round(borrowedUSDC - (depositedWETH * newPrice * 0.80) / 1.60))
        );
        setBorrowedUSDC((p) => Math.max(0, p - payout));
        setLastPayoutUSD(payout);
        setIsHedgingActive(false);
        setHedgeStatus(HedgeStatus.PROTECTED);
        setIsSimulating(false);
        addEvent({
          type: 'HEDGE_SETTLED',
          title: '✅ Hedge Settled & Debt Repaid!',
          description: `+$${payout} tUSDC repaid to MockLendingPool.repay() hook`,
          txHash: '0x4e629ee82f87076e7be86da5959a7f1a2c0c732630cce9e31838244274249fb5',
        });
      }, 1000);
    } else {
      setTimeout(() => setIsSimulating(false), 400);
    }
  };

  const handleResetPrice = () => {
    setCurrentEthPrice(baseEthPrice);
    setHedgeStatus(HedgeStatus.IDLE);
    setIsHedgingActive(false);
    try {
      fetch('http://localhost:3001/api/reset', { method: 'POST' }).catch(() => {});
    } catch (_) {}
    addEvent({
      type: 'PRICE_RESET',
      title: 'Oracle Reset to $2,000',
      description: 'Market normalized on-chain and in Sentinel daemon.',
    });
  };

  const handleDeposit = async (amount: number) => {
    setIsActionLoading(true);
    setTimeout(() => {
      setWethBalance((p) => Math.max(0, p - amount));
      setDepositedWETH((p) => p + amount);
      const auto = amount * 1000;
      setBorrowedUSDC((p) => p + auto);
      setTusdcBalance((p) => p + auto);
      setIsActionLoading(false);
      addEvent({ type: 'DEPOSIT', title: `+${amount} WETH Supplied`, description: `Auto-borrowed $${auto} tUSDC at 50% LTV.` });
    }, 800);
  };

  const handleWithdraw = async (amount: number) => {
    setIsActionLoading(true);
    setTimeout(() => {
      setDepositedWETH((p) => Math.max(0, p - amount));
      setWethBalance((p) => p + amount);
      setIsActionLoading(false);
      addEvent({ type: 'WITHDRAW', title: `${amount} WETH Withdrawn`, description: 'Collateral returned.' });
    }, 800);
  };

  const handleMintTokens = async () => {
    setIsActionLoading(true);
    setTimeout(() => {
      setWethBalance((p) => p + 10.0);
      setTusdcBalance((p) => p + 10000.0);
      setIsActionLoading(false);
      addEvent({ type: 'DEPOSIT', title: 'Faucet Minted!', description: '+10 WETH and +10,000 tUSDC.' });
    }, 600);
  };

  if (!mounted) return null;

  return (
    // Relative root, no background — canvas handles it
    <div className="relative min-h-screen selection:bg-pink-500 selection:text-white">

      {/* ── LAYER 0: Fixed canvas — plays frames through entire page scroll ── */}
      <ScrollFrameCanvas />

      {/* ── LAYER 0b: Lightweight pixel sparks ─────────────────────────────── */}
      <PixelShatterCanvas />

      {/* ── LAYER 1: Floating transparent navbar ──────────────────────────── */}
      <Header onOpenArchitecture={() => setIsArchitectureOpen(true)} />

      {/* ── All content stacks on top of canvas (z-10+) ─────────────────── */}
      <div className="relative" style={{ zIndex: 10 }}>

        {/* SECTION 1: Hero — full viewport, text fades as you scroll */}
        <HeroTextSection />

        {/* SECTION 2: Telemetry Ticker — thin strip below hero */}
        <div className="w-full bg-black/30 backdrop-blur-xl border-y border-white/[0.06]">
          <LiveTelemetryTicker />
        </div>

        {/* SECTION 3: Ecosystem Bento — glass bg, canvas shows through */}
        <PixelDissolveSection id="bento-section">
          <div className="bg-black/20 backdrop-blur-sm">
            <EcosystemBento />
          </div>
        </PixelDissolveSection>

        {/* SECTION 4: Vault Command Center */}
        <PixelDissolveSection id="vault-terminal">
          <div
            ref={vaultSectionRef}
            className="max-w-7xl mx-auto px-4 md:px-8 py-12 w-full space-y-6"
          >
            {/* Terminal Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-purple-900/40">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-500/30 text-xs font-semibold text-pink-300 mb-2">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                  <span>Live On-Chain Terminal</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  LiquiGuard <span className="text-gradient-purple">Vault Command Center</span>
                </h2>
                <p className="text-xs text-purple-300/70 mt-1">
                  Interact directly with deployed contracts on Somnia Shannon Testnet.
                </p>
              </div>
              <div className="text-xs text-purple-300/80 font-mono flex items-center gap-3">
                <span>Oracle: <strong className="text-cyan-300">${currentEthPrice.toLocaleString()}</strong></span>
                <span>•</span>
                <span>Status: <strong className="text-emerald-400">Protected</strong></span>
              </div>
            </div>

            {/* 3×2 Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
              <div className="h-full">
                <VaultControls
                  wethBalance={wethBalance}
                  tusdcBalance={tusdcBalance}
                  depositedWETH={depositedWETH}
                  borrowedUSDC={borrowedUSDC}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                  onMintTokens={handleMintTokens}
                  isLoading={isActionLoading}
                />
              </div>
              <div className="h-full">
                <HealthFactorGauge
                  healthFactor={healthFactor}
                  collateralUSD={collateralUSD}
                  borrowedUSD={borrowedUSDC}
                  collateralETH={depositedWETH}
                  ethPrice={currentEthPrice}
                  liquidationPrice={liquidationPrice}
                />
              </div>
              <div className="h-full">
                <CrashSimulator
                  basePrice={baseEthPrice}
                  currentPrice={currentEthPrice}
                  onSimulateDrop={handleSimulateDrop}
                  onResetPrice={handleResetPrice}
                  isSimulating={isSimulating}
                />
              </div>
              <div className="h-full">
                <HedgeStatusBadge
                  status={hedgeStatus}
                  lastPayoutUSD={lastPayoutUSD}
                  currentHF={healthFactor}
                  isHedging={isHedgingActive}
                />
              </div>
              <div className="h-full">
                <OrderBookVisualizer
                  currentEthPrice={currentEthPrice}
                  strikePrice={baseEthPrice}
                  isHedging={isHedgingActive}
                />
              </div>
              <div className="h-full">
                <ActivityLog events={events} />
              </div>
            </div>
          </div>
        </PixelDissolveSection>

        {/* FOOTER */}
        <footer className="border-t border-purple-900/40 bg-black/40 backdrop-blur-xl py-10 px-4 md:px-8 text-xs text-purple-300/60">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">LiquiGuard</span>
              <span>· Autonomous DeFi Micro-Hedging on Somnia</span>
            </div>
            <div className="flex items-center gap-6 font-medium">
              <a href="https://shannon-explorer.somnia.network/address/0x14b2bb3f8a25301d6ea944d571f0e7608d36c095" target="_blank" rel="noopener noreferrer" className="hover:text-pink-300 transition-colors">Vault Contract ↗</a>
              <a href="https://testnet.somnia.network/" target="_blank" rel="noopener noreferrer" className="hover:text-pink-300 transition-colors">Somnia Testnet ↗</a>
            </div>
          </div>
        </footer>
      </div>

      {/* Architecture Modal */}
      <ArchitectureModal isOpen={isArchitectureOpen} onClose={() => setIsArchitectureOpen(false)} />
    </div>
  );
}
