'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useVaultContracts } from '@/hooks/useVaultContracts';

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
  } = useVaultContracts();

  // ── Derived vault state ───────────────────────────────────────────────────
  const depositedWETH = vaultPosition?.collateralWETH ?? 0;
  const borrowedUSDC = vaultPosition?.debtUSDC ?? 0;
  const chainHealthFactor = vaultPosition?.healthFactor ?? 0;
  const hedgeStatusOnChain: HedgeStatus =
    vaultPosition?.status === 1
      ? HedgeStatus.HEDGING
      : vaultPosition?.status === 2
      ? HedgeStatus.PROTECTED
      : HedgeStatus.IDLE;

  // ── Crash Simulator state (oracle price) ─────────────────────────────────
  const BASE_ETH_PRICE = 2000; // The reference "reset" price
  const [baseEthPrice] = useState(BASE_ETH_PRICE);
  // liveOraclePrice = the ACTUAL on-chain oracle price (changes when you crash or reset)
  const [liveOraclePrice, setLiveOraclePrice] = useState(2000);
  const [currentEthPrice, setCurrentEthPrice] = useState(2000);
  const [isHedgingActive, setIsHedgingActive] = useState(false);
  const [daemonLastPayout, setDaemonLastPayout] = useState(0);
  const [totalHedgePayouts, setTotalHedgePayouts] = useState(0);

  // Poll actual on-chain oracle price every 2 seconds from daemon /api/vaults
  useEffect(() => {
    const pollOracle = async () => {
      try {
        const resp = await fetch(`${DAEMON_URL}/api/vaults`);
        if (!resp.ok) return;
        const data = await resp.json();
        // daemon tracks the last price it set on each vault
        if (data.vaults && data.vaults.length > 0) {
          const price = data.vaults[0]?.lastPriceETH;
          if (price && price > 0) {
            setLiveOraclePrice(price);
            // If currentEthPrice is still at the old value but oracle moved (e.g. reset happened externally), sync it
            setCurrentEthPrice((prev) => {
              // Only auto-sync if we haven't manually set a different crash price recently
              // We rely on liveOraclePrice for display, keep currentEthPrice for HF calc
              return prev;
            });
          }
        }
      } catch (_) {}
    };
    pollOracle();
    const iv = setInterval(pollOracle, 2000);
    return () => clearInterval(iv);
  }, []);

  // Real last payout: prefer on-chain vaultState, fallback to daemon history
  const lastPayoutUSD =
    vaultPosition?.lastPayoutUSD && vaultPosition.lastPayoutUSD > 0
      ? vaultPosition.lastPayoutUSD
      : daemonLastPayout > 0
      ? daemonLastPayout
      : totalHedgePayouts;

  // ── HF: prefer chain value, fallback to simulated from oracle price ───────
  // During crash simulation (price ≠ base), use local formula since the on-chain
  // getHealthFactor read may be stale (5-6 second refetch delay).
  const priceIsSimulated = currentEthPrice !== baseEthPrice;
  const localHF =
    depositedWETH > 0 && borrowedUSDC > 0
      ? (depositedWETH * currentEthPrice * 0.8) / borrowedUSDC
      : 2.5;

  const effectiveHF =
    priceIsSimulated && depositedWETH > 0 && borrowedUSDC > 0
      ? localHF // Use local calculation when crash simulation is active
      : depositedWETH > 0 && chainHealthFactor > 0
      ? chainHealthFactor
      : localHF;

  const collateralUSD = depositedWETH * currentEthPrice;
  const liquidationPrice = depositedWETH > 0 ? borrowedUSDC / (depositedWETH * 0.8) : 0;

  // ── Persistent Activity Log Storage Helpers ────────────────────────────────
  const getStorageKey = useCallback((userAddr?: string) => {
    return userAddr ? `liquiguard_events_${userAddr.toLowerCase()}` : 'liquiguard_events_global';
  }, []);

  const loadStoredEvents = useCallback((userAddr?: string): ProtocolEvent[] => {
    if (typeof window === 'undefined') return [];
    try {
      const specificKey = getStorageKey(userAddr);
      const rawSpecific = localStorage.getItem(specificKey);
      const rawGlobal = localStorage.getItem('liquiguard_events_global');

      const specificList: ProtocolEvent[] = rawSpecific ? JSON.parse(rawSpecific) : [];
      const globalList: ProtocolEvent[] = rawGlobal ? JSON.parse(rawGlobal) : [];

      const combined = [...specificList, ...globalList];
      const seen = new Set<string>();
      const deduped: ProtocolEvent[] = [];
      for (const ev of combined) {
        if (ev && ev.id && !seen.has(ev.id)) {
          seen.add(ev.id);
          deduped.push(ev);
        }
      }
      return deduped.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    } catch {
      return [];
    }
  }, [getStorageKey]);

  const persistEvents = useCallback((newEvents: ProtocolEvent[], userAddr?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const toSave = JSON.stringify(newEvents.slice(0, 50));
      const key = getStorageKey(userAddr);
      localStorage.setItem(key, toSave);
      localStorage.setItem('liquiguard_events_global', toSave);
    } catch {}
  }, [getStorageKey]);

  // ── Activity events ───────────────────────────────────────────────────────
  const [events, setEvents] = useState<ProtocolEvent[]>([
    {
      id: 'evt-0',
      type: 'DEPOSIT',
      title: 'Somnia Shannon Testnet Live (Chain ID: 50312)',
      description: 'Connected to on-chain LiquiGuardVault at 0x14b2bb…c095',
      timestamp: Date.now() - 60000,
    },
  ]);

  const vaultSectionRef = useRef<HTMLDivElement>(null);

  // 1. Initial mount: load any stored events from localStorage
  useEffect(() => {
    setMounted(true);
    const stored = loadStoredEvents();
    if (stored.length > 0) {
      setEvents((prev) => {
        const seen = new Set(stored.map((e) => e.id));
        const unrecorded = prev.filter((e) => !seen.has(e.id));
        return [...stored, ...unrecorded].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
      });
    }
  }, [loadStoredEvents]);

  // 2. When wallet connects/changes address: restore wallet-specific events from localStorage
  useEffect(() => {
    if (!isConnected || !address) return;
    const stored = loadStoredEvents(address);
    const connectEventId = `wallet-connect-${address.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

    setEvents((prev) => {
      const seen = new Set<string>();
      const combined = [...stored, ...prev];
      const deduped: ProtocolEvent[] = [];

      let hasConnect = false;
      for (const ev of combined) {
        if (ev.id.startsWith('wallet-connect-') && ev.id.includes(address.toLowerCase().slice(0, 8))) {
          hasConnect = true;
        }
        if (!seen.has(ev.id)) {
          seen.add(ev.id);
          deduped.push(ev);
        }
      }

      if (!hasConnect) {
        deduped.unshift({
          id: connectEventId,
          type: 'DEPOSIT',
          title: `Wallet Connected: ${address.slice(0, 6)}…${address.slice(-4)}`,
          description: 'On-chain vault state loaded from Somnia. Activity history restored.',
          timestamp: Date.now(),
        });
      }

      const sorted = deduped.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
      persistEvents(sorted, address);
      return sorted;
    });
  }, [address, isConnected, loadStoredEvents, persistEvents]);

  // 3. Anchor on-chain active vault position so even on a fresh browser it appears in activity
  useEffect(() => {
    if (!address || !vaultPosition) return;
    if (vaultPosition.collateralWETH > 0 || vaultPosition.debtUSDC > 0) {
      const posId = `pos-anchor-${address.toLowerCase()}`;
      setEvents((prev) => {
        const existing = prev.find((e) => e.id === posId);
        if (existing) return prev;

        const posEvent: ProtocolEvent = {
          id: posId,
          type: 'DEPOSIT',
          title: `🏦 Active Vault: ${vaultPosition.collateralWETH.toFixed(2)} WETH Collateral`,
          description: `On-chain debt: $${vaultPosition.debtUSDC.toFixed(2)} tUSDC · Health Factor: ${vaultPosition.healthFactor.toFixed(2)}`,
          timestamp: Date.now() - 45000,
        };

        const updated = [posEvent, ...prev].slice(0, 50);
        persistEvents(updated, address);
        return updated;
      });
    }
  }, [address, vaultPosition, persistEvents]);

  // ── Stream real hedge history from Sentinel daemon ────────────────────────
  const fetchHedgeHistory = useCallback(async () => {
    try {
      const resp = await fetch(`${DAEMON_URL}/api/history`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.history) && data.history.length > 0) {
        // history is sorted by createdAt DESC (newest at index 0)
        const latestCompleted = data.history.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (h: any) => h.status === 'COMPLETED' || (h.payoutUSDC && Number(h.payoutUSDC) > 0)
        );
        if (latestCompleted && Number(latestCompleted.payoutUSDC) > 0) {
          setDaemonLastPayout(Number(latestCompleted.payoutUSDC));
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalPayout = data.history.reduce((sum: number, h: any) => {
          if (h.status === 'COMPLETED' || (h.payoutUSDC && Number(h.payoutUSDC) > 0)) {
            return sum + (Number(h.payoutUSDC) || 0);
          }
          return sum;
        }, 0);
        if (totalPayout > 0) {
          setTotalHedgePayouts(totalPayout);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hedgeEvents: ProtocolEvent[] = data.history.flatMap((h: any) => {
          const evts: ProtocolEvent[] = [];
          if (h.status === 'SETTLED' || h.status === 'COMPLETED' || h.payoutUSDC > 0) {
            evts.push({
              id: `hedge-settled-${h.id}`,
              type: 'HEDGE_SETTLED' as const,
              title: `✅ Micro-Hedge Settled: +$${Number(h.payoutUSDC)?.toFixed(2)} tUSDC`,
              description: `Debt repaid into LendingPool. HF restored to ${h.newHealthFactor?.toFixed(2) || 'Safe'}`,
              timestamp: h.completedAt || h.createdAt,
              txHash: h.txHash,
            });
          }
          evts.push({
            id: `hedge-triggered-${h.id}`,
            type: 'HEDGE_TRIGGERED' as const,
            title: `🚨 Micro-Hedge Triggered (HF: ${Number(h.triggerHf)?.toFixed(2)})`,
            description: `Placed DOWN order on DreamDEX CLOB (Size: $${Number(h.hedgeSizeUSDC)?.toFixed(2)})`,
            timestamp: h.createdAt,
            txHash: h.txHash,
          });
          return evts;
        });

        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEvents = hedgeEvents.filter((e) => !existingIds.has(e.id));
          if (newEvents.length === 0) return prev;
          const updated = [...newEvents, ...prev].slice(0, 50);
          persistEvents(updated, address);
          return updated;
        });
      }
    } catch (_) {}
  }, [address, persistEvents]);

  useEffect(() => {
    fetchHedgeHistory();
    const interval = setInterval(fetchHedgeHistory, 1200);
    return () => clearInterval(interval);
  }, [fetchHedgeHistory]);

  const addEvent = useCallback((event: Omit<ProtocolEvent, 'id' | 'timestamp'>) => {
    setEvents((prev) => {
      const newEvt: ProtocolEvent = {
        ...event,
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      };
      const updated = [newEvt, ...prev].slice(0, 50);
      persistEvents(updated, address);
      return updated;
    });
  }, [address, persistEvents]);


  const scrollToVault = () => {
    const el = document.getElementById('vault-terminal') || vaultSectionRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Log txStep changes as activity events
  useEffect(() => {
    if (txStep === 'success' && lastTxHash) {
      addEvent({
        type: 'DEPOSIT',
        title: '✅ On-chain Transaction Confirmed',
        description: `tx: ${lastTxHash.slice(0, 12)}…${lastTxHash.slice(-6)}`,
        txHash: lastTxHash,
      });
      // Auto-reset txStep banner after 4s
      setTimeout(() => resetTx(), 4000);
      // Refetch position
      setTimeout(() => { refetchAll(); fetchHedgeHistory(); }, 1000);
    }
    if (txStep === 'error' && txError) {
      addEvent({ type: 'WITHDRAW', title: '❌ Transaction Failed', description: txError });
      setTimeout(() => resetTx(), 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txStep]);

  // ── Deposit handler: approve WETH + depositAndBorrow atomically ──────────
  // Vault's depositAndBorrow(collateralAmount, borrowAmount):
  //   - pulls WETH from user → supplies to lending pool
  //   - borrows tUSDC from lending pool at 45% LTV → sends to user
  const handleDeposit = async (amount: number) => {
    const ethPriceForCalc = currentEthPrice > 0 ? currentEthPrice : 2000;
    const borrowUSDC = Math.floor(amount * ethPriceForCalc * 0.45);
    const hash = await depositAndBorrow(amount, borrowUSDC);
    if (hash) {
      addEvent({
        type: 'DEPOSIT',
        title: `+${amount} WETH Supplied + ${borrowUSDC} tUSDC Borrowed`,
        description: `Approved WETH, deposited to vault, borrowed ${borrowUSDC} tUSDC at 45% LTV.`,
        txHash: hash,
      });
    }
  };

  // ── Withdraw handler (real wagmi tx) ─────────────────────────────────────
  const handleWithdraw = async (amount: number) => {
    const hash = await withdraw(amount);
    if (hash) {
      addEvent({
        type: 'WITHDRAW',
        title: `${amount} WETH Withdrawn`,
        description: 'Collateral returned to wallet.',
        txHash: hash,
      });
    }
  };

  // ── Borrow more handler ───────────────────────────────────────────────────
  const handleBorrow = async (amount: number) => {
    const hash = await borrow(amount);
    if (hash) {
      addEvent({
        type: 'DEPOSIT',
        title: `Borrowed ${amount} tUSDC`,
        description: `Additional tUSDC borrowed against existing collateral.`,
        txHash: hash,
      });
    }
  };

  // ── Faucet handler (real wagmi mint txs) ─────────────────────────────────
  const handleMintTokens = async () => {
    await mintTokens();
    addEvent({
      type: 'DEPOSIT',
      title: 'Faucet: Minting 10 WETH + 10,000 tUSDC',
      description: 'Signed mint transactions on Somnia testnet.',
    });
  };

  // ── Crash Simulator handler ───────────────────────────────────────────────
  // - Calls daemon /api/simulate-crash (daemon updates MockPriceOracle.setPrice() on-chain)
  // - Daemon checks all vaults, triggers DreamDEX DOWN hedge, and executes on-chain repayment
  const handleSimulateDrop = async (dropPercentage: number) => {
    setIsSimulating(true);
    const newPrice = baseEthPrice * (1 - dropPercentage / 100);
    setCurrentEthPrice(newPrice);
    setLiveOraclePrice(newPrice); // ← show real crashed price immediately
    addEvent({
      type: 'PRICE_DROP',
      title: `Market Crash Simulated: -${dropPercentage}%`,
      description: `ETH/USD oracle → $${newPrice.toLocaleString()} (via Sentinel daemon)`,
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
        });
      }

      // Immediately refetch contract state to reflect dropped oracle price
      await refetchAll();
      fetchHedgeHistory();
    } catch {
      addEvent({
        type: 'PRICE_DROP',
        title: 'ℹ️ Daemon offline — price simulated locally',
        description: 'Start daemon: npm run dev:daemon',
      });
    }

    // Check if HF is critical
    const newHF =
      depositedWETH > 0 && borrowedUSDC > 0
        ? (depositedWETH * newPrice * 0.8) / borrowedUSDC
        : 2.5;

    if (newHF < 1.30) {
      setIsHedgingActive(true);
      addEvent({
        type: 'HEDGE_TRIGGERED',
        title: `🚨 HF Critical (${newHF.toFixed(2)}) — Sentinel Triggered`,
        description: 'Submitting Immediate-or-Cancel (IOC) DOWN hedge on DreamDEX CLOB…',
      });

      // Rapidly poll to catch the on-chain hedge execution as fast as it mines (<1s)
      setTimeout(() => { refetchAll(); fetchHedgeHistory(); }, 400);
      setTimeout(() => { refetchAll(); fetchHedgeHistory(); }, 1200);
      setTimeout(() => { refetchAll(); fetchHedgeHistory(); }, 2500);
      setTimeout(() => {
        refetchAll();
        fetchHedgeHistory();
        setIsHedgingActive(false);
      }, 5000);
    }

    setTimeout(() => setIsSimulating(false), 400);
  };

  const handleResetPrice = async () => {
    setCurrentEthPrice(baseEthPrice);
    setLiveOraclePrice(baseEthPrice); // ← show $2000 immediately
    setIsHedgingActive(false);
    try {
      await fetch(`${DAEMON_URL}/api/reset`, { method: 'POST' });
    } catch (_) {}
    addEvent({
      type: 'PRICE_RESET',
      title: 'Oracle Reset to $2,000',
      description: 'Daemon reset: on-chain price and vault states normalized.',
    });
    setTimeout(() => {
      refetchAll();
      fetchHedgeHistory();
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
          <LiveTelemetryTicker />
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
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  LiquiGuard <span className="text-gradient-purple">Vault Command Center</span>
                </h2>
                <p className="text-xs text-purple-300/70 mt-1">
                  {isConnected && address
                    ? `Connected: ${address.slice(0, 6)}…${address.slice(-4)} · All actions send real MetaMask transactions to Somnia.`
                    : 'Connect wallet to interact with deployed contracts on Somnia Shannon Testnet.'}
                </p>
              </div>
              <div className="text-xs text-purple-300/80 font-mono flex items-center gap-3">
                <span>Oracle: <strong className="text-cyan-300">${currentEthPrice.toLocaleString()}</strong></span>
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
                  ethPrice={liveOraclePrice}
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
