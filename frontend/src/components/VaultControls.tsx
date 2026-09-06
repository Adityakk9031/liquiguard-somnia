'use client';

import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Droplets, ShieldCheck, Wallet } from 'lucide-react';
import { formatUSD } from '@/lib/utils';
import { DataSourceBadge, CardChipRow } from '@/lib/dataSource';
import { suggestedBorrowUSDC } from '@/lib/ltv';

interface VaultControlsProps {
  wethBalance: number;
  tusdcBalance: number;
  depositedWETH: number;
  borrowedUSDC: number;
  ethPrice: number;
  onDeposit: (amount: number) => Promise<void>;
  onWithdraw: (amount: number) => Promise<void>;
  onBorrow: (amount: number) => Promise<void>;
  onMintTokens: () => Promise<void>;
  isLoading: boolean;
}

export function VaultControls({
  wethBalance,
  tusdcBalance,
  depositedWETH,
  borrowedUSDC,
  ethPrice,
  onDeposit,
  onWithdraw,
  onBorrow,
  onMintTokens,
  isLoading,
}: VaultControlsProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'borrow' | 'withdraw' | 'faucet'>('deposit');
  const [depositAmount, setDepositAmount] = useState<string>('1.0');
  const [borrowAmount, setBorrowAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('0.5');
  const [forceUnsafeWithdraw, setForceUnsafeWithdraw] = useState<boolean>(false);

  // Guard: never compute on zero price (oracle not loaded yet)
  const safePrice = ethPrice > 0 ? ethPrice : 2000;

  // Current HF calculation
  const currentHF = depositedWETH > 0 && borrowedUSDC > 0
    ? (depositedWETH * safePrice * 0.80) / borrowedUSDC
    : 999;

  // Maximum borrow capacity supported by on-chain LiquiGuardVault (MAX_BORROW_LTV = 75%)
  const maxBorrowUSD = depositedWETH * safePrice * 0.75; // 75% on-chain LTV cap
  const remainingBorrow = Math.max(0, maxBorrowUSD - borrowedUSDC);

  // Target debt to bring HF down to ~1.40 (so a -35% crash cleanly triggers Sentinel at < 1.30)
  // HF = col * price * 0.80 / debt = 1.40 → targetDebt = col * price * 0.80 / 1.40
  const targetDebtForTrigger = depositedWETH > 0
    ? (depositedWETH * safePrice * 0.80) / 1.40
    : 0;

  // Amount needed to reach 1.40 HF, capped by contract's remaining borrow capacity
  const neededToReach140 = Math.max(0, targetDebtForTrigger - borrowedUSDC);
  const suggestedBorrow = Math.min(remainingBorrow, neededToReach140);


  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(depositAmount);
    if (!isNaN(num) && num > 0) onDeposit(num);
  };

  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(borrowAmount);
    if (isNaN(num) || num <= 0) return;
    if (num > remainingBorrow) return;
    onBorrow(num);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(withdrawAmount);
    if (!isNaN(num) && num > 0) onWithdraw(num);
  };

  const borrowNum = parseFloat(borrowAmount) || 0;
  const projectedHFAfterBorrow = (() => {
    const newDebt = borrowedUSDC + borrowNum;
    if (depositedWETH > 0 && newDebt > 0) {
      return (depositedWETH * safePrice * 0.80) / newDebt;
    }
    return null;
  })();
  const exceedsMaxLtv = borrowNum > 0 && borrowNum - remainingBorrow > 0.0001;
  const borrowBlocked = depositedWETH === 0 || remainingBorrow <= 0 || exceedsMaxLtv || borrowNum <= 0;

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header Tabs */}
      <div>
        {/* Card Header */}
        <div className="flex flex-col gap-1.5 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/30 shrink-0">
              <Wallet className="w-4 h-4 text-pink-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white tracking-tight leading-snug whitespace-nowrap">Vault Actions</h3>
              <p className="text-[10px] text-purple-300/70">Collateral &amp; Debt Management</p>
            </div>
          </div>
          <CardChipRow>
            <DataSourceBadge source="LIVE_ONCHAIN" />
            <span className="h-5 inline-flex items-center px-1.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-wide leading-none border border-purple-500/30 bg-purple-950/50 text-purple-300/80 whitespace-nowrap">
              50312
            </span>
          </CardChipRow>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-purple-950/70 border border-purple-500/20 mb-4">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'deposit'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-3 h-3" />
            <span>Deposit</span>
          </button>

          <button
            onClick={() => setActiveTab('borrow')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'borrow'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <Wallet className="w-3 h-3" />
            <span>Borrow</span>
          </button>

          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'withdraw'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <ArrowUpFromLine className="w-3 h-3" />
            <span>Withdraw</span>
          </button>

          <button
            onClick={() => setActiveTab('faucet')}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'faucet'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span>Faucet</span>
          </button>
        </div>

        {/* Tab 1: Deposit */}
        {activeTab === 'deposit' && (
          <form onSubmit={handleDepositSubmit} className="space-y-3">
            <div className="flex items-center justify-between text-xs text-purple-300/70">
              <span>Supply WETH Collateral</span>
              <span>
                Wallet: <strong className="text-white">{wethBalance.toFixed(2)}</strong>
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full bg-purple-950/60 border border-purple-500/30 rounded-xl py-2.5 px-3.5 pr-16 text-lg font-bold text-white focus:outline-none focus:border-pink-500"
                placeholder="0.0"
              />

              <button
                type="button"
                onClick={() => setDepositAmount(wethBalance > 0 ? wethBalance.toString() : '1.0')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-purple-200"
              >
                MAX
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20 space-y-1 text-xs text-purple-200/80">
              <div className="flex justify-between">
                <span>Auto-Supplied to Pool:</span>
                <strong className="text-white">+{depositAmount || '0'} WETH</strong>
              </div>
              <div className="flex justify-between">
                <span>Auto-Borrowed (target HF 1.40, max 75% LTV):</span>
                <strong className="text-pink-300">
                  +{suggestedBorrowUSDC(parseFloat(depositAmount) || 0, ethPrice).toLocaleString()} tUSDC
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full glow-btn-primary py-2.5 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Approve &amp; Deposit Collateral</span>
            </button>
          </form>
        )}

        {/* Tab 2: Borrow More */}
        {activeTab === 'borrow' && (
          <form onSubmit={handleBorrowSubmit} className="space-y-3">
            <div className="flex items-center justify-between text-xs text-purple-300/70">
              <span>Borrow tUSDC Against Collateral</span>
              <span>
                Deposited: <strong className="text-white">{depositedWETH.toFixed(2)} WETH</strong>
              </span>
            </div>

            {depositedWETH === 0 ? (
              <div className="p-2.5 rounded-xl bg-yellow-950/40 border border-yellow-500/30 text-xs text-yellow-300">
                ⚠️ You have no collateral deposited. Deposit WETH first.
              </div>
            ) : (
              <>
                {/* High-HF demo hint */}
                {currentHF > 2 && remainingBorrow > 0 && (
                  <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[10px] text-amber-200/90 leading-tight">
                    💡 HF is very safe. Borrow suggested amount so a crash can trigger Sentinel (HF ~1.40).
                  </div>
                )}

                {/* Suggested borrow for sentinel demo */}
                {suggestedBorrow > 0 ? (

                  <div className="p-2.5 rounded-xl bg-pink-950/40 border border-pink-500/30 text-[10px] text-pink-200 space-y-1">
                    <div className="font-bold text-pink-300">💡 Suggested for Sentinel Demo:</div>
                    <div>Borrow <strong className="text-white">${suggestedBorrow.toFixed(0)}</strong> tUSDC to bring HF to ~1.40</div>
                    <div className="text-purple-300/70">This lets a -35% crash cleanly trigger the Sentinel Guard.</div>
                    <button
                      type="button"
                      onClick={() => setBorrowAmount(suggestedBorrow.toFixed(0))}
                      className="mt-1 px-2 py-1 rounded bg-pink-600/40 hover:bg-pink-600/70 text-white text-[10px] font-bold border border-pink-500/40 w-full transition-colors"
                    >
                      Use ${suggestedBorrow.toFixed(0)} tUSDC
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[10px] text-emerald-200">
                    <span className="font-bold text-emerald-300">✅ Vault Primed for Sentinel:</span> Current HF ({currentHF.toFixed(2)}) is already ≤ 1.40. A market crash will trigger the Sentinel Guard!
                  </div>
                )}

                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max={Math.max(0, Math.floor(remainingBorrow))}
                    value={borrowAmount}
                    onChange={(e) => setBorrowAmount(e.target.value)}
                    className={`w-full bg-purple-950/60 border rounded-xl py-2.5 px-3.5 pr-16 text-lg font-bold text-white focus:outline-none transition-colors ${
                      exceedsMaxLtv
                        ? 'border-red-500/70 focus:border-red-400 text-red-200'
                        : 'border-purple-500/30 focus:border-pink-500'
                    }`}
                    placeholder="Amount in tUSDC"
                  />
                  <button
                    type="button"
                    disabled={remainingBorrow < 1}
                    onClick={() => setBorrowAmount(Math.floor(remainingBorrow).toString())}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-purple-200 disabled:opacity-40"
                  >
                    MAX
                  </button>
                </div>

                <div className={`p-2.5 rounded-xl border space-y-1 text-xs ${
                  exceedsMaxLtv
                    ? 'bg-red-950/50 border-red-500/50 text-red-200'
                    : 'bg-purple-950/40 border-purple-500/20 text-purple-200/80'
                }`}>
                  <div className="flex justify-between">
                    <span>Current Debt:</span>
                    <strong className="text-white">${borrowedUSDC.toFixed(2)} tUSDC</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Available to Borrow (75% Max LTV):</span>
                    <strong className="text-emerald-300">${remainingBorrow.toFixed(0)} tUSDC</strong>
                  </div>
                  <div className="flex justify-between pt-0.5 border-t border-purple-500/20">
                    <span>{borrowNum > 0 ? 'Projected HF after borrow:' : 'Current Health Factor:'}</span>
                    <strong className={
                      exceedsMaxLtv || (projectedHFAfterBorrow ?? currentHF) < 1.30
                        ? 'text-red-400'
                        : (projectedHFAfterBorrow ?? currentHF) < 2.0
                        ? 'text-yellow-400'
                        : 'text-emerald-400'
                    }>
                      {(projectedHFAfterBorrow ?? currentHF).toFixed(2)}
                    </strong>
                  </div>
                  {exceedsMaxLtv && (
                    <div className="text-red-300 text-[10px] leading-relaxed pt-1 border-t border-red-500/30">
                      ⛔ <strong>Safety Guard Active:</strong> This borrow exceeds the vault&apos;s <strong>75% LTV cap</strong>
                      {projectedHFAfterBorrow !== null ? ` (projected HF ${projectedHFAfterBorrow.toFixed(2)})` : ''}.
                      The contract will reject it. Max remaining: <strong>${Math.floor(remainingBorrow)} tUSDC</strong>
                      {' '}(HF stays ≥ ~1.07).
                    </div>
                  )}
                </div>
              </>
            )}


            <button
              type="submit"
              disabled={isLoading || borrowBlocked}
              className={`w-full py-2.5 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2 ${
                exceedsMaxLtv ? 'bg-red-900/60 border border-red-500/50 text-red-200' : 'glow-btn-primary'
              }`}
            >
              <Wallet className="w-4 h-4 text-pink-300" />
              <span>
                {exceedsMaxLtv
                  ? '⛔ Blocked: Over 75% LTV'
                  : remainingBorrow <= 0 && depositedWETH > 0
                    ? '⛔ Max LTV reached'
                    : 'Borrow tUSDC'}
              </span>
            </button>
          </form>
        )}

        {/* Tab 3: Withdraw */}
        {activeTab === 'withdraw' && (() => {
          // HF = (collateral × price × 0.80) / debt
          // After withdrawing x WETH: HF_new = ((col - x) × price × 0.80) / debt
          // Max safe: solve for x where HF_new = 1.20
          // x_max = col - (1.20 × debt) / (price × 0.80)
          const MIN_HF = 1.20;
          // Apply a 0.005 buffer so rounding never causes newHF to land on 1.19999
          const maxSafeWithdraw = borrowedUSDC > 0
            ? Math.max(0, depositedWETH - (MIN_HF * borrowedUSDC) / (ethPrice * 0.80) - 0.005)
            : depositedWETH;

          const withdrawNum = parseFloat(withdrawAmount) || 0;
          const projectedHFAfterWithdraw = (() => {
            if (depositedWETH <= 0) return null;
            const newCol = depositedWETH - withdrawNum;
            if (newCol <= 0) return 0;
            if (borrowedUSDC <= 0) return 999;
            return (newCol * ethPrice * 0.80) / borrowedUSDC;
          })();

          const willRevert = projectedHFAfterWithdraw !== null && projectedHFAfterWithdraw < MIN_HF;
          const isButtonDisabled = isLoading || depositedWETH === 0 || withdrawNum <= 0 || (willRevert && !forceUnsafeWithdraw);

          return (
            <form onSubmit={handleWithdrawSubmit} className="space-y-3">
              <div className="flex items-center justify-between text-xs text-purple-300/70">
                <span>Withdraw WETH Collateral</span>
                <span>
                  Deposited: <strong className="text-white">{depositedWETH.toFixed(2)} WETH</strong>
                </span>
              </div>

              {/* Safe Withdrawal Presets & Dynamic Math Breakdown */}
              {depositedWETH > 0 && (
                <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20 space-y-2 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-purple-300/80">Max Safe Withdrawal:</span>
                    <strong className="text-emerald-300 font-mono text-xs">{maxSafeWithdraw.toFixed(2)} WETH</strong>
                  </div>

                  {/* Live Formula Telemetry */}
                  <div className="p-1.5 rounded-lg bg-black/30 border border-purple-500/15 text-[9px] font-mono text-purple-300/80 space-y-0.5">
                    <div className="text-purple-400 flex justify-between items-center">
                      <span>Formula (HF ≥ 1.20):</span>
                      <span className="text-[8px] text-cyan-300">Live Oracle ${ethPrice.toLocaleString()}</span>
                    </div>
                    <div className="text-purple-200/90 truncate">
                      {depositedWETH.toFixed(2)} - (1.20 × ${borrowedUSDC.toFixed(0)}) / (${ethPrice} × 0.8) = <strong className="text-emerald-400">{maxSafeWithdraw.toFixed(2)} WETH</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      disabled={maxSafeWithdraw <= 0}
                      onClick={() => setWithdrawAmount(
                        maxSafeWithdraw > 2.0 ? '1.0' : (maxSafeWithdraw * 0.5).toFixed(2)
                      )}
                      className="py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-purple-200 border border-purple-500/20 text-[10px] font-medium transition-colors disabled:opacity-40"
                    >
                      🧪 {maxSafeWithdraw > 2.0 ? 'Withdraw 1.0 WETH' : `Withdraw ${(maxSafeWithdraw * 0.5).toFixed(2)} WETH`}
                    </button>
                    <button
                      type="button"
                      disabled={maxSafeWithdraw <= 0}
                      onClick={() => setWithdrawAmount(maxSafeWithdraw > 0 ? maxSafeWithdraw.toFixed(2) : '0')}
                      className="py-1 px-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-colors disabled:opacity-40"
                    >
                      ✅ Max Safe ({maxSafeWithdraw.toFixed(2)} WETH)
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className={`w-full bg-purple-950/60 border rounded-xl py-2.5 px-3.5 pr-24 text-lg font-bold text-white focus:outline-none transition-colors ${
                    withdrawNum > depositedWETH || willRevert
                      ? 'border-red-500/70 focus:border-red-400 text-red-200'
                      : 'border-purple-500/30 focus:border-pink-500'
                  }`}
                  placeholder="0.0"
                />
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(maxSafeWithdraw > 0 ? maxSafeWithdraw.toFixed(2) : '0')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-purple-200"
                >
                  MAX SAFE
                </button>
              </div>

              {/* Live projected HF */}
              {withdrawNum > depositedWETH ? (
                <div className="p-2 rounded-xl bg-red-950/50 border border-red-500/50 text-[10px] text-red-300">
                  ⛔ <strong>Exceeds Deposited Collateral:</strong> You only have {depositedWETH.toFixed(2)} WETH deposited in this vault.
                </div>
              ) : (
                projectedHFAfterWithdraw !== null && withdrawNum > 0 && (
                  <div className={`p-2.5 rounded-xl border space-y-1.5 text-xs ${
                    willRevert
                      ? 'bg-red-950/50 border-red-500/50'
                      : 'bg-purple-950/40 border-purple-500/20'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-300/70">Projected Health Factor:</span>
                      <strong className={`font-mono text-sm ${
                        projectedHFAfterWithdraw < MIN_HF ? 'text-red-400 font-bold animate-pulse' :
                        projectedHFAfterWithdraw < 1.5 ? 'text-yellow-400 font-bold' : 'text-emerald-400 font-bold'
                      }`}>
                        {projectedHFAfterWithdraw === 999 ? '∞' : projectedHFAfterWithdraw.toFixed(2)}
                      </strong>
                    </div>

                    {willRevert ? (
                      <div className="space-y-1.5 pt-1 border-t border-red-500/30">
                        <div className="text-red-300 text-[10px] leading-relaxed">
                          ⛔ <strong>Safety Guard Active:</strong> Resulting HF ({projectedHFAfterWithdraw.toFixed(2)}) is below the <strong>1.20 minimum threshold</strong>. The on-chain vault contract will reject this withdrawal to prevent immediate liquidation.
                        </div>
                        <label className="flex items-center gap-1.5 text-[10px] text-red-300/80 cursor-pointer pt-0.5">
                          <input
                            type="checkbox"
                            checked={forceUnsafeWithdraw}
                            onChange={(e) => setForceUnsafeWithdraw(e.target.checked)}
                            className="rounded border-red-500/50 text-red-500 focus:ring-0 cursor-pointer"
                          />
                          <span>Allow sending anyway (MetaMask will reject on-chain)</span>
                        </label>
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-300/90 flex items-center gap-1">
                        <span>✓ Safe withdrawal (HF remains ≥ 1.20)</span>
                      </div>
                    )}
                  </div>
                )
              )}


              <button
                type="submit"
                disabled={isButtonDisabled}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-1 transition-all ${
                  willRevert
                    ? 'bg-red-900/60 border border-red-500/50 text-red-200 hover:bg-red-900/80'
                    : 'glow-btn-primary text-white'
                }`}
              >
                <ArrowUpFromLine className="w-4 h-4" />
                <span>
                  {willRevert
                    ? forceUnsafeWithdraw
                      ? 'Send Unsafe Tx (Expect Contract Revert)'
                      : '⛔ Blocked: Resulting HF < 1.20'
                    : `Withdraw ${withdrawNum > 0 ? `${withdrawNum} WETH` : 'Collateral'}`}
                </span>
              </button>
            </form>
          );
        })()}



        {/* Tab 4: Faucet */}
        {activeTab === 'faucet' && (
          <div className="space-y-3">
            <p className="text-xs text-purple-300/80">
              Mint 10 WETH and 10,000 tUSDC directly to test vault positions.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/20">
                <div className="text-[10px] text-purple-300/70">WETH:</div>
                <div className="font-bold text-white">{wethBalance.toFixed(1)} WETH</div>
              </div>
              <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/20">
                <div className="text-[10px] text-purple-300/70">tUSDC:</div>
                <div className="font-bold text-white">{formatUSD(tusdcBalance)}</div>
              </div>
            </div>

            <button
              onClick={onMintTokens}
              disabled={isLoading}
              className="w-full glow-btn-primary py-2.5 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              <Droplets className="w-4 h-4 text-cyan-200" />
              <span>Mint +10 WETH &amp; +10k tUSDC</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

