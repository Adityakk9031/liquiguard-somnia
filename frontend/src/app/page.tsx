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
import { HedgeStatus } from '@/types';
import { useVaultContracts } from '@/hooks/useVaultContracts';
import { useDreamDexMarkets } from '@/hooks/useDreamDexMarkets';
import { useDaemonStatus } from '@/hooks/useDaemonStatus';
import { suggestedBorrowUSDC } from '@/lib/ltv';
import { useWalletActivity } from '@/hooks/useWalletActivity';

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:3001';

// Tx step → human-readable status label
function txLabel(step: string): string {
  switch (step) {
    case 'approving': return '⏳ Sign approval in MetaMask…';
    case 'approve-confirming': return '⛓ Approval confirming on-chain…';
    case 'depositing': return '⏳ Sign deposit in MetaMask…';
    case 'deposit-confirming': return '⛓ Deposit confirming on-chain…';
    case 'withdrawing': return '⏳ Sign withdrawal in MetaMask…';
    case 'withdraw-confirming': return '⛓ Withdrawal confirming on-chain…';
    case 'minting-weth': return '⏳ Sign WETH mint in MetaMask…';
    case 'minting-weth-confirming': return '⛓ WETH mint confirming…';
    case 'minting-tusdc': return '⏳ Sign tUSDC mint in MetaMask…';
    case 'minting-tusdc-confirming': return '⛓ tUSDC mint confirming…';
    case 'success': return '✅ Transaction confirmed!';
    case 'error': return '❌ Transaction failed.';
    default: return '';
  }
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastAction, setLastAction] = useState<'DEPOSIT' | 'BORROW' | 'WITHDRAW' | 'FAUCET'>('DEPOSIT');

  // ── Real on-chain state via wagmi ─────────────────────────────────────────
  const {
    wethBalance,
    tusdcBalance,
    vaultPosition,
    txStep,
    txError,
    lastTxHash,
    isLoading: isActionLoading,
    deposit,
    borrow,
    depositAndBorrow,
    withdraw,
    mintTokens,
    resetTx,
    refetchAll,
    oraclePrice: onChainOraclePrice, // ← Direct on-chain read from MockPriceOracle every 3s
  } = useVaultContracts();

  // ── DreamDEX markets from daemon ──────────────────────────────────────────
  const { markets, mode: dreamdexMode } = useDreamDexMarkets();
  const defaultMarket = markets[0] ?? null;

  // ── Daemon global status ──────────────────────────────────────────────────
  const daemonStatus = useDaemonStatus();

  // ── Derived vault state ───────────────────────────────────────────────────
  const depositedWETH = vaultPosition?.collateralWETH ?? 0;
  const borrowedUSDC = vaultPosition?.debtUSDC ?? 0;
  const chainHealthFactor = vaultPosition?.healthFactor ?? 0;

  // ── Oracle price: on-chain first, daemon fallback ─────────────────────────
  // onChainOraclePrice = direct read from MockPriceOracle every 3s (truth)
  // daemonStatus.currentEthPrice = what daemon set (lags slightly behind)
  const BASE_ETH_PRICE = 2000;
  // liveOraclePrice tracks the actual chain oracle (syncs after crash/reset)
  const [liveOraclePrice, setLiveOraclePrice] = useState(BASE_ETH_PRICE);
  // currentEthPrice is the price used for UI HF calc (set immediately on crash)
  const [currentEthPrice, setCurrentEthPrice] = useState(BASE_ETH_PRICE);

  // Sync liveOraclePrice from on-chain read (3s loop)
  useEffect(() => {
    if (onChainOraclePrice && onChainOraclePrice > 0) {
      setLiveOraclePrice(onChainOraclePrice);
    }
  }, [onChainOraclePrice]);

  // ── Daemon vault status polling (hedge tracking) ──────────────────────────
  // Poll daemon /api/vaults/:address for live status (HEALTHY|WARNING|CRITICAL|HEDGING|PROTECTED)
  // This replaces the fragile 5s isHedgingActive timer.
  const [daemonVaultStatus, setDaemonVaultStatus] = useState<string>('HEALTHY');

  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;

    const pollVault = async () => {
      try {
        const resp = await fetch(`${DAEMON_URL}/api/vaults/${address}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        if (data.vault?.status) {
          setDaemonVaultStatus(data.vault.status);
        }
      } catch {
        // Daemon offline — keep last known status
      }
    };

    pollVault();
    const iv = setInterval(pollVault, 1500);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [address, isConnected]);

  // Derive hedge status: daemon has priority, fallback to on-chain enum
  const hedgeStatusOnChain: HedgeStatus =
    daemonVaultStatus === 'HEDGING'
      ? HedgeStatus.HEDGING
      : daemonVaultStatus === 'PROTECTED'
      ? HedgeStatus.PROTECTED
      : vaultPosition?.status === 1
      ? HedgeStatus.HEDGING
      : vaultPosition?.status === 2
      ? HedgeStatus.PROTECTED
      : HedgeStatus.IDLE;

  // isHedgingActive for child components that need a boolean
  const isHedgingActive =
    daemonVaultStatus === 'HEDGING' || daemonVaultStatus === 'CRITICAL' || vaultPosition?.status === 1;

  const [daemonLastPayout, setDaemonLastPayout] = useState(0);
  const [totalHedgePayouts, setTotalHedgePayouts] = useState(0);

  const { events, addEvent, refreshActivity, payoutStats, isLoading: isActivityLoading } = useWalletActivity(address, isConnected);

  useEffect(() => {
    setDaemonLastPayout(payoutStats.lastPayout);
    setTotalHedgePayouts(payoutStats.totalPayout);
  }, [payoutStats]);
  const lastPayoutUSD =
    vaultPosition?.lastPayoutUSD && vaultPosition.lastPayoutUSD > 0
      ? vaultPosition.lastPayoutUSD
      : daemonLastPayout > 0
      ? daemonLastPayout
      : totalHedgePayouts;

  // ── HF: prefer chain value, fallback to simulated from oracle price ───────
  const priceIsSimulated = currentEthPrice !== liveOraclePrice;
  const localHF =
    depositedWETH > 0 && borrowedUSDC > 0
      ? (depositedWETH * currentEthPrice * 0.8) / borrowedUSDC
      : 2.5;

  const effectiveHF =
    priceIsSimulated && depositedWETH > 0 && borrowedUSDC > 0
      ? localHF
      : depositedWETH > 0 && chainHealthFactor > 0
      ? chainHealthFactor
      : localHF;

  const collateralUSD = depositedWETH * currentEthPrice;
  const liquidationPrice = depositedWETH > 0 ? borrowedUSDC / (depositedWETH * 0.8) : 0;

  const vaultSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToVault = () => {
    const el = document.getElementById('vault-terminal') || vaultSectionRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Refresh on-chain activity after confirmed transactions
  useEffect(() => {
    if (txStep === 'success' && lastTxHash) {
      addEvent({
        type: lastAction,
        title: `✅ ${lastAction === 'BORROW' ? 'Borrow' : lastAction === 'WITHDRAW' ? 'Withdrawal' : lastAction === 'FAUCET' ? 'Faucet' : 'Deposit'} Confirmed on-chain`,
        description: `tx: ${lastTxHash.slice(0, 12)}…${lastTxHash.slice(-6)}`,
        txHash: lastTxHash,
        source: 'ON-CHAIN',
      });
      setTimeout(() => { refetchAll(); refreshActivity(); }, 1000);
      setTimeout(() => resetTx(), 4000);
    }
    if (txStep === 'error' && txError) {
      addEvent({ type: lastAction, title: `❌ ${lastAction} Failed`, description: txError, source: 'LOCAL' });
      setTimeout(() => resetTx(), 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txStep]);

  // ── Deposit handler: approve WETH + depositAndBorrow atomically ──────────
  // Uses target HF ~1.40 formula to compute borrow amount (via shared suggestedBorrowUSDC)
  // Contract MAX_BORROW_LTV = 7500 (75%)
  const handleDeposit = async (amount: number) => {
    setLastAction('DEPOSIT');
    const ethPriceForCalc = liveOraclePrice > 0 ? liveOraclePrice : 2000;
    const borrowUSDC = suggestedBorrowUSDC(amount, ethPriceForCalc);
    const hash = await depositAndBorrow(amount, borrowUSDC);
    if (hash) {
      addEvent({
        type: 'DEPOSIT',
        title: `+${amount} WETH Deposited + ${borrowUSDC.toLocaleString()} tUSDC Borrowed`,
        description: `Vault deposit + borrow at target HF ~1.40.`,
        txHash: hash,
        source: 'ON-CHAIN',
      });
      setTimeout(() => refreshActivity(), 1500);
    }
  };

  // ── Withdraw handler (real wagmi tx) ─────────────────────────────────────
  const handleWithdraw = async (amount: number) => {
    setLastAction('WITHDRAW');
    const hash = await withdraw(amount);
    if (hash) {
      addEvent({
        type: 'WITHDRAW',
        title: `−${amount} WETH Withdrawn`,
        description: 'Collateral returned to wallet.',
        txHash: hash,
        source: 'ON-CHAIN',
      });
      setTimeout(() => refreshActivity(), 1500);
    }
  };

  // ── Borrow more handler ───────────────────────────────────────────────────
  const handleBorrow = async (amount: number) => {
    setLastAction('BORROW');
    const hash = await borrow(amount);
    if (hash) {
      addEvent({
        type: 'BORROW',
        title: `Borrowed ${amount.toLocaleString()} tUSDC`,
        description: 'Additional tUSDC borrowed against existing collateral.',
        txHash: hash,
        source: 'ON-CHAIN',
      });
      setTimeout(() => refreshActivity(), 1500);
    }
  };

  // ── Faucet handler (real wagmi mint txs) ─────────────────────────────────
  const handleMintTokens = async () => {
    setLastAction('FAUCET');
    await mintTokens();
    addEvent({
      type: 'FAUCET',
      title: 'Faucet: Minting 10 WETH + 10,000 tUSDC',
      description: 'Signed mint transactions on Somnia testnet.',
      source: 'ON-CHAIN',
    });
  };


  // ── Crash Simulator handler ───────────────────────────────────────────────
  const handleSimulateDrop = async (dropPercentage: number) => {
    setIsSimulating(true);
    const newPrice = BASE_ETH_PRICE * (1 - dropPercentage / 100);
    setCurrentEthPrice(newPrice);
    setLiveOraclePrice(newPrice);
    addEvent({
      type: 'PRICE_DROP',
      title: `Market Crash Simulated: -${dropPercentage}%`,
      description: `ETH/USD oracle → $${newPrice.toLocaleString()} (via Sentinel daemon → on-chain MockPriceOracle)`,
      source: 'DAEMON',
    });

    try {
      const resp = await fetch(`${DAEMON_URL}/api/simulate-crash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dropPercent: dropPercentage, newPrice }),
      });
      const data = await resp.json();
      if (data.onChainTxHash) {
        addEvent({
          type: 'PRICE_DROP',
          title: '⛓ Oracle price updated on-chain',
          description: `MockPriceOracle.setPrice → tx ${data.onChainTxHash.slice(0, 14)}…`,
          txHash: data.onChainTxHash,
          source: 'ON-CHAIN',
        });
      }

      await refetchAll();
      refreshActivity();
    } catch {
      addEvent({
        type: 'PRICE_DROP',
        title: 'ℹ️ Daemon offline — price simulated locally',
        description: 'Start daemon: npm run dev:daemon',
        source: 'LOCAL',
      });
    }

    // Check if HF is critical
    const newHF =
      depositedWETH > 0 && borrowedUSDC > 0
        ? (depositedWETH * newPrice * 0.8) / borrowedUSDC
        : 2.5;

    if (newHF < 1.30) {
      addEvent({
        type: 'HEDGE_TRIGGERED',
        title: `🚨 HF Critical (${newHF.toFixed(2)}) — Sentinel Triggered`,
        description: 'Submitting Immediate-or-Cancel (IOC) DOWN hedge on DreamDEX CLOB…',
        source: 'DAEMON',
      });

      setTimeout(() => { refetchAll(); refreshActivity(); }, 400);
      setTimeout(() => { refetchAll(); refreshActivity(); }, 1200);
      setTimeout(() => { refetchAll(); refreshActivity(); }, 2500);
      setTimeout(() => { refetchAll(); refreshActivity(); }, 5000);
    }

    setTimeout(() => setIsSimulating(false), 400);
  };

  const handleResetPrice = async () => {
    setCurrentEthPrice(BASE_ETH_PRICE);
    setLiveOraclePrice(BASE_ETH_PRICE);
    try {
      await fetch(`${DAEMON_URL}/api/reset`, { method: 'POST' });
    } catch (_) {}
    addEvent({
      type: 'PRICE_RESET',
      title: 'Oracle Reset to $2,000',
      description: 'Daemon reset: on-chain price and vault states normalized.',
      source: 'DAEMON',
    });
    setTimeout(() => {
      refetchAll();
      refreshActivity();
    }, 1200);
  };

  if (!mounted) return null;

  const explorerBase = 'https://shannon-explorer.somnia.network/tx';

  return (
    <div className="relative min-h-screen selection:bg-pink-500 selection:text-white">

      {/* ── LAYER 0: Fixed canvas ────────────────────────────────────────── */}
      <ScrollFrameCanvas />

      {/* ── LAYER 0b: Pixel sparks ───────────────────────────────────────── */}
      <PixelShatterCanvas />

      {/* ── LAYER 1: Floating navbar ─────────────────────────────────────── */}
      <Header onOpenArchitecture={() => setIsArchitectureOpen(true)} />

      {/* ── All content stacks on canvas ────────────────────────────────── */}
      <div className="relative" style={{ zIndex: 10 }}>

        {/* SECTION 1: Hero */}
        <HeroTextSection
          onLaunchVault={scrollToVault}
          onOpenArchitecture={() => setIsArchitectureOpen(true)}
        />

        {/* Tx Status Banner */}
        {txStep !== 'idle' && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-semibold backdrop-blur-xl transition-all
            ${txStep === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' :
              txStep === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' :
              'bg-purple-950/90 border-purple-500/40 text-purple-100'}`}
          >
            {txStep !== 'success' && txStep !== 'error' && (
              <span className="w-3 h-3 rounded-full bg-purple-400 animate-ping inline-block" />
            )}
            <span>{txLabel(txStep)}</span>
            {lastTxHash && txStep === 'success' && (
              <a
                href={`${explorerBase}/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 underline text-cyan-300 hover:text-cyan-100 text-xs"
              >
                View on Explorer ↗
              </a>
            )}
          </div>
        )}

        {/* Tx Error Banner */}
        {txError && txStep === 'error' && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm px-4 py-2 rounded-xl bg-red-950/90 border border-red-500/40 text-red-200 text-xs font-mono">
            {txError}
          </div>
        )}

        {/* SECTION 2: Telemetry Ticker */}
        <div className="w-full bg-black/30 backdrop-blur-xl border-y border-white/[0.06]">
          <LiveTelemetryTicker daemonStatus={daemonStatus} />
        </div>

        {/* SECTION 3: Ecosystem Bento */}
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
                  {daemonStatus.online && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-mono uppercase">
                      DAEMON {daemonStatus.dreamdexMode.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl overflow-hidden border border-purple-500/40 p-0.5 bg-purple-950/60 shadow-[0_0_16px_rgba(236,72,153,0.35)] shrink-0 hidden sm:flex items-center justify-center">
                    <img src="/logo.png" alt="LiquiGuard Logo" className="w-full h-full object-cover rounded-[10px]" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    LiquiGuard <span className="text-gradient-purple">Vault Command Center</span>
                  </h2>
                </div>
                <p className="text-xs text-purple-300/70 mt-1">
                  {isConnected && address
                    ? `Connected: ${address.slice(0, 6)}…${address.slice(-4)} · All actions send real MetaMask transactions to Somnia.`
                    : 'Connect wallet to interact with deployed contracts on Somnia Shannon Testnet.'}
                </p>
              </div>
              <div className="text-xs text-purple-300/80 font-mono flex items-center gap-3">
                <span>Oracle: <strong className="text-cyan-300">${liveOraclePrice.toLocaleString()}</strong></span>
                <span>•</span>
                <span>HF: <strong className={effectiveHF < 1.3 ? 'text-red-400' : effectiveHF < 1.5 ? 'text-yellow-400' : 'text-emerald-400'}>{effectiveHF.toFixed(2)}</strong></span>
              </div>
            </div>

            {/* Not connected warning */}
            {!isConnected && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
                ⚠️ Connect your MetaMask wallet (Somnia Shannon Testnet, Chain ID 50312) to deposit collateral, trigger hedges, and interact with real on-chain contracts.
              </div>
            )}

            {/* 3×2 Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
              <div className="h-full">
                <VaultControls
                  wethBalance={wethBalance}
                  tusdcBalance={tusdcBalance}
                  depositedWETH={depositedWETH}
                  borrowedUSDC={borrowedUSDC}
                  ethPrice={currentEthPrice > 0 ? currentEthPrice : BASE_ETH_PRICE}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                  onBorrow={handleBorrow}
                  onMintTokens={handleMintTokens}
                  isLoading={isActionLoading}
                />
              </div>
              <div className="h-full">
                <HealthFactorGauge
                  healthFactor={effectiveHF}
                  collateralUSD={collateralUSD}
                  borrowedUSD={borrowedUSDC}
                  collateralETH={depositedWETH}
                  ethPrice={currentEthPrice}
                  liquidationPrice={liquidationPrice}
                  priceIsSimulated={priceIsSimulated}
                />
              </div>
              <div className="h-full">
                <CrashSimulator
                  basePrice={liveOraclePrice}
                  currentPrice={currentEthPrice}
                  onSimulateDrop={handleSimulateDrop}
                  onResetPrice={handleResetPrice}
                  isSimulating={isSimulating}
                  depositedWETH={depositedWETH}
                  borrowedUSDC={borrowedUSDC}
                  daemonVaultStatus={daemonVaultStatus}
                />
              </div>
              <div className="h-full">
                <HedgeStatusBadge
                  status={hedgeStatusOnChain}
                  lastPayoutUSD={lastPayoutUSD}
                  currentHF={effectiveHF}
                  isHedging={isHedgingActive}
                />
              </div>
              <div className="h-full">
                <OrderBookVisualizer
                  currentEthPrice={currentEthPrice}
                  strikePrice={defaultMarket?.strikePrice ?? BASE_ETH_PRICE}
                  isHedging={isHedgingActive}
                  market={defaultMarket}
                  mode={dreamdexMode}
                />
              </div>
              <div className="h-full">
                <ActivityLog events={events} isConnected={isConnected} isLoading={isActivityLoading} />
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
