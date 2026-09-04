'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
  usePublicClient,
} from 'wagmi';
import { parseUnits, formatUnits, type Address } from 'viem';
import { CONTRACT_ADDRESSES, LIQUIGUARD_VAULT_ABI, ERC20_ABI } from '@/lib/contracts';

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:3001';

// Matches VaultState struct in LiquiGuardTypes.sol:
// { depositedCollateral, borrowedDebt, status (HedgeStatus enum), lastHedgePayout, lastHealthFactor }
export interface VaultPosition {
  collateralWETH: number; // depositedCollateral formatted (18 dec)
  debtUSDC: number;       // borrowedDebt formatted (6 dec)
  healthFactor: number;   // lastHealthFactor formatted from 1e18
  status: number;         // HedgeStatus: 0=Idle, 1=Hedging, 2=Protected
  lastPayoutUSD: number;  // lastHedgePayout in USD (6 dec)
}

export type TxStep =
  | 'idle'
  | 'approving'
  | 'approve-confirming'
  | 'depositing'
  | 'deposit-confirming'
  | 'withdrawing'
  | 'withdraw-confirming'
  | 'minting-weth'
  | 'minting-weth-confirming'
  | 'minting-tusdc'
  | 'minting-tusdc-confirming'
  | 'success'
  | 'error';

// ─────────────────────────────────────────────────────────────────────────────
export function useVaultContracts() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [txStep, setTxStep] = useState<TxStep>('idle');
  const [txError, setTxError] = useState<string | null>(null);
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>(undefined);
  const [lastTxHash, setLastTxHash] = useState<string | undefined>(undefined);

  const { writeContractAsync, reset: resetWrite } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: pendingHash });

  // ── Native STT balance ───────────────────────────────────────────────────
  const { data: sttData } = useBalance({
    address: address as Address | undefined,
    query: { refetchInterval: 12_000, enabled: isConnected && !!address },
  });

  // ── WETH wallet balance ──────────────────────────────────────────────────
  const { data: wethBalRaw, refetch: refetchWeth } = useReadContract({
    address: CONTRACT_ADDRESSES.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as Address],
    query: { refetchInterval: 8_000, enabled: isConnected && !!address },
  });

  // ── tUSDC wallet balance ─────────────────────────────────────────────────
  const { data: tusdcBalRaw, refetch: refetchTusdc } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as Address],
    query: { refetchInterval: 8_000, enabled: isConnected && !!address },
  });

  // ── Vault state: uses getVaultState() which returns VaultState struct ─────
  // VaultState { depositedCollateral, borrowedDebt, status, lastHedgePayout, lastHealthFactor }
  const { data: vaultStateRaw, refetch: refetchVault } = useReadContract({
    address: CONTRACT_ADDRESSES.vault,
    abi: LIQUIGUARD_VAULT_ABI,
    functionName: 'getVaultState',
    args: [address as Address],
    query: { refetchInterval: 6_000, enabled: isConnected && !!address },
  });

  // ── Also read live HF separately (computed fresh from oracle price) ───────
  const { data: liveHFRaw, refetch: refetchHF } = useReadContract({
    address: CONTRACT_ADDRESSES.vault,
    abi: LIQUIGUARD_VAULT_ABI,
    functionName: 'getHealthFactor',
    args: [address as Address],
    query: { refetchInterval: 5_000, enabled: isConnected && !!address },
  });

  // ── Parse balances ────────────────────────────────────────────────────────
  const wethBalance =
    wethBalRaw != null ? parseFloat(formatUnits(wethBalRaw as bigint, 18)) : 0;

  const tusdcBalance =
    tusdcBalRaw != null ? parseFloat(formatUnits(tusdcBalRaw as bigint, 6)) : 0;

  const sttBalance = sttData ? parseFloat(sttData.formatted) : 0;

  // ── Parse vault state ─────────────────────────────────────────────────────
  // vaultStateRaw is the VaultState struct returned as a tuple/object from wagmi
  let vaultPosition: VaultPosition | null = null;
  if (vaultStateRaw && typeof vaultStateRaw === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = vaultStateRaw as any;
    const col: bigint = s.depositedCollateral ?? s[0] ?? BigInt(0);
    const debt: bigint = s.borrowedDebt ?? s[1] ?? BigInt(0);
    const status: number = Number(s.status ?? s[2] ?? 0);
    const lastPayout: bigint = s.lastHedgePayout ?? s[3] ?? BigInt(0);
    const lastHF: bigint = s.lastHealthFactor ?? s[4] ?? BigInt(0);

    // Use live HF if available (oracle-computed), fallback to cached lastHealthFactor
    const liveHF = liveHFRaw as bigint | undefined;
    const hf = liveHF && liveHF > BigInt(0) ? liveHF : lastHF;

    vaultPosition = {
      collateralWETH: parseFloat(formatUnits(col, 18)),
      debtUSDC: parseFloat(formatUnits(debt, 6)),
      // type(uint256).max means no debt → treat as very high HF
      healthFactor:
        col === BigInt(0)
          ? 0
          : hf >= BigInt('0xffffffffffffffffffffffffffffffff')
          ? 999
          : parseFloat(formatUnits(hf, 18)),
      status,
      lastPayoutUSD: parseFloat(formatUnits(lastPayout, 6)),
    };
  }

  // ── Register user with daemon on wallet connect ───────────────────────────
  useEffect(() => {
    if (!isConnected || !address) return;
    fetch(`${DAEMON_URL}/api/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    }).catch(() => {});
  }, [address, isConnected]);

  // ── Refetch everything after tx confirmed ─────────────────────────────────
  const refetchAll = useCallback(async () => {
    await Promise.all([refetchWeth(), refetchTusdc(), refetchVault(), refetchHF()]);
  }, [refetchWeth, refetchTusdc, refetchVault, refetchHF]);

  useEffect(() => {
    if (isConfirmed) refetchAll();
  }, [isConfirmed, refetchAll]);

  const parseError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('User rejected') || msg.includes('user rejected'))
      return 'Transaction cancelled by user.';
    if (msg.includes('insufficient funds') || msg.includes('InsufficientFunds'))
      return 'Insufficient STT for gas.';
    if (msg.includes('UnsafeHealthFactor') || msg.includes('0xc1e7621d'))
      return 'Withdrawal rejected by contract: Health Factor would fall below the 1.20 minimum safety limit.';
    if (msg.includes('ExceedsMaxLtv'))
      return 'Borrow amount exceeds max LTV (75%).';
    return msg.replace(/.*execution reverted: /, '').slice(0, 150);
  };


  // Helper to ensure WETH allowance before any vault deposit
  const ensureWethAllowance = async (requiredAmount: bigint): Promise<void> => {
    if (!address || !publicClient) return;
    try {
      const currentAllowance = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.weth,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as Address, CONTRACT_ADDRESSES.vault],
      })) as bigint;

      if (currentAllowance < requiredAmount) {
        setTxStep('approving');
        // Approve 1,000,000 WETH so user only has to sign approval once
        const approveBig = parseUnits('1000000', 18);
        const approveHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.weth,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.vault, approveBig],
        });
        setPendingHash(approveHash);
        setTxStep('approve-confirming');

        // Wait for real on-chain receipt confirmation
        await publicClient.waitForTransactionReceipt({
          hash: approveHash,
          confirmations: 1,
        });
      }
    } catch (e) {
      // If reading allowance fails, attempt explicit approval
      setTxStep('approving');
      const approveHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.weth,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.vault, requiredAmount],
      });
      setPendingHash(approveHash);
      setTxStep('approve-confirming');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
      }
    }
  };

  // ── ACTION: Deposit WETH collateral ──────────────────────────────────────
  const deposit = useCallback(
    async (amount: number): Promise<string | undefined> => {
      if (!address) return;
      setTxError(null);
      resetWrite();

      try {
        const amountBig = parseUnits(amount.toFixed(18), 18);

        // Step 1: Ensure allowance (only asks MetaMask if needed!)
        await ensureWethAllowance(amountBig);

        // Step 2: Deposit collateral into vault
        setTxStep('depositing');
        const depositHash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.vault,
          abi: LIQUIGUARD_VAULT_ABI,
          functionName: 'depositCollateral',
          args: [amountBig],
        });
        setPendingHash(depositHash);
        setTxStep('deposit-confirming');
        setLastTxHash(depositHash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: depositHash, confirmations: 1 });
        }

        setTimeout(() => refetchAll(), 1500);
        setTxStep('success');
        return depositHash;
      } catch (err) {
        setTxError(parseError(err));
        setTxStep('error');
      }
      return undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, writeContractAsync, publicClient, refetchAll, resetWrite]
  );

  // ── ACTION: Borrow tUSDC against existing collateral ─────────────────────
  const borrow = useCallback(
    async (amountUSDC: number): Promise<string | undefined> => {
      if (!address) return;
      setTxError(null);
      resetWrite();

      try {
        setTxStep('depositing');
        const amountBig = parseUnits(amountUSDC.toFixed(6), 6);
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.vault,
          abi: LIQUIGUARD_VAULT_ABI,
          functionName: 'borrowDebt',
          args: [amountBig],
        });
        setPendingHash(hash);
        setTxStep('deposit-confirming');
        setLastTxHash(hash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        }

        setTimeout(() => refetchAll(), 1500);
        setTxStep('success');
        return hash;
      } catch (err) {
        setTxError(parseError(err));
        setTxStep('error');
      }
      return undefined;
    },
    [address, writeContractAsync, publicClient, refetchAll, resetWrite]
  );

  // ── ACTION: Deposit + Borrow atomically ────────────────────────────────
  const depositAndBorrow = useCallback(
    async (collateralWETH: number, borrowUSDC: number): Promise<string | undefined> => {
      if (!address) return;
      setTxError(null);
      resetWrite();

      try {
        const colBig = parseUnits(collateralWETH.toFixed(18), 18);
        const debtBig = parseUnits(borrowUSDC.toFixed(6), 6);

        // Step 1: Ensure allowance (only asks MetaMask if needed!)
        await ensureWethAllowance(colBig);

        // Step 2: Deposit + Borrow atomically
        setTxStep('depositing');
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.vault,
          abi: LIQUIGUARD_VAULT_ABI,
          functionName: 'depositAndBorrow',
          args: [colBig, debtBig],
        });
        setPendingHash(hash);
        setTxStep('deposit-confirming');
        setLastTxHash(hash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        }

        setTimeout(() => refetchAll(), 1500);
        setTxStep('success');
        return hash;
      } catch (err) {
        setTxError(parseError(err));
        setTxStep('error');
      }
      return undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, writeContractAsync, publicClient, refetchAll, resetWrite]
  );

  // ── ACTION: Withdraw WETH collateral ──────────────────────────────────────
  const withdraw = useCallback(
    async (amount: number): Promise<string | undefined> => {
      if (!address) return;
      setTxError(null);
      resetWrite();

      try {
        setTxStep('withdrawing');
        const amountBig = parseUnits(amount.toFixed(18), 18);
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.vault,
          abi: LIQUIGUARD_VAULT_ABI,
          functionName: 'withdrawCollateral',
          args: [amountBig],
        });
        setPendingHash(hash);
        setTxStep('withdraw-confirming');
        setLastTxHash(hash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        }

        setTimeout(() => refetchAll(), 1500);
        setTxStep('success');
        return hash;
      } catch (err) {
        setTxError(parseError(err));
        setTxStep('error');
      }
      return undefined;
    },
    [address, writeContractAsync, publicClient, refetchAll, resetWrite]
  );

  // ── ACTION: Faucet — mint 10 WETH + 10,000 tUSDC directly ────────────────
  const mintTokens = useCallback(async (): Promise<void> => {
    if (!address) return;
    setTxError(null);
    resetWrite();

    try {
      // Mint WETH (18 dec)
      setTxStep('minting-weth');
      const wethHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.weth,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, parseUnits('10', 18)],
      });
      setPendingHash(wethHash);
      setTxStep('minting-weth-confirming');
      setLastTxHash(wethHash);

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: wethHash, confirmations: 1 });
      }

      // Mint tUSDC (6 dec)
      setTxStep('minting-tusdc');
      const tusdcHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.usdc,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, parseUnits('10000', 6)],
      });
      setPendingHash(tusdcHash);
      setTxStep('minting-tusdc-confirming');
      setLastTxHash(tusdcHash);

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tusdcHash, confirmations: 1 });
      }

      setTimeout(() => refetchAll(), 1500);
      setTxStep('success');
    } catch (err) {
      setTxError(parseError(err));
      setTxStep('error');
    }
  }, [address, writeContractAsync, publicClient, refetchAll, resetWrite]);

  const resetTx = useCallback(() => {
    setTxStep('idle');
    setTxError(null);
    setPendingHash(undefined);
    resetWrite();
  }, [resetWrite]);

  const isLoading =
    txStep !== 'idle' && txStep !== 'success' && txStep !== 'error';

  return {
    // On-chain balances & vault position (from real chain reads)
    wethBalance,
    tusdcBalance,
    sttBalance,
    vaultPosition,
    // Tx state
    txStep,
    txError,
    lastTxHash,
    isLoading,
    isConfirming,
    // Actions
    deposit,          // approve WETH + depositCollateral
    borrow,           // borrowDebt (after deposit)
    depositAndBorrow, // atomic approve + depositAndBorrow
    withdraw,         // withdrawCollateral
    mintTokens,       // faucet: mint WETH + tUSDC
    resetTx,
    refetchAll,
  };
}

