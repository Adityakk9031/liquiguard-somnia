'use client';

import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Droplets, ShieldCheck } from 'lucide-react';
import { formatUSD } from '@/lib/utils';

interface VaultControlsProps {
  wethBalance: number;
  tusdcBalance: number;
  depositedWETH: number;
  borrowedUSDC: number;
  onDeposit: (amount: number) => Promise<void>;
  onWithdraw: (amount: number) => Promise<void>;
  onMintTokens: () => Promise<void>;
  isLoading: boolean;
}

export function VaultControls({
  wethBalance,
  tusdcBalance,
  depositedWETH,
  borrowedUSDC,
  onDeposit,
  onWithdraw,
  onMintTokens,
  isLoading,
}: VaultControlsProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'faucet'>('deposit');
  const [depositAmount, setDepositAmount] = useState<string>('1.0');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('0.5');

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(depositAmount);
    if (!isNaN(num) && num > 0) {
      onDeposit(num);
    }
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(withdrawAmount);
    if (!isNaN(num) && num > 0) {
      onWithdraw(num);
    }
  };

  return (
    <div className="rounded-2xl glass-panel p-5 flex flex-col justify-between h-full border border-purple-500/25">
      {/* Header Tabs */}
      <div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-purple-950/70 border border-purple-500/20 mb-4">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'deposit'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </button>

          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'withdraw'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>Withdraw</span>
          </button>

          <button
            onClick={() => setActiveTab('faucet')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'faucet'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
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
                className="w-full bg-purple-950/60 border border-purple-500/30 rounded-xl py-2.5 px-3.5 text-lg font-bold text-white focus:outline-none focus:border-pink-500"
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
                <span>Auto-Borrowed (50% LTV):</span>
                <strong className="text-pink-300">
                  +{((parseFloat(depositAmount) || 0) * 1000).toFixed(0)} tUSDC
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full glow-btn-primary py-2.5 rounded-xl font-bold text-white text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Approve & Deposit Collateral</span>
            </button>
          </form>
        )}

        {/* Tab 2: Withdraw */}
        {activeTab === 'withdraw' && (
          <form onSubmit={handleWithdrawSubmit} className="space-y-3">
            <div className="flex items-center justify-between text-xs text-purple-300/70">
              <span>Withdraw WETH</span>
              <span>
                Deposited: <strong className="text-white">{depositedWETH.toFixed(2)}</strong>
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full bg-purple-950/60 border border-purple-500/30 rounded-xl py-2.5 px-3.5 text-lg font-bold text-white focus:outline-none focus:border-pink-500"
                placeholder="0.0"
              />
              <button
                type="button"
                onClick={() => setWithdrawAmount((depositedWETH * 0.5).toFixed(2))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-purple-200"
              >
                50%
              </button>
            </div>

            <p className="text-[10px] text-purple-300/70">
              Health Factor must remain &ge; 1.20 after withdrawal.
            </p>

            <button
              type="submit"
              disabled={isLoading || depositedWETH === 0}
              className="w-full glass-button py-2.5 rounded-xl font-bold text-purple-100 text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:text-white disabled:opacity-50 mt-2"
            >
              <ArrowUpFromLine className="w-4 h-4 text-purple-400" />
              <span>Withdraw Collateral</span>
            </button>
          </form>
        )}

        {/* Tab 3: Faucet */}
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
              <span>Mint +10 WETH & +10k tUSDC</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
