import { type PublicClient, formatUnits, type Address } from 'viem';
import { CONTRACT_ADDRESSES, LIQUIGUARD_VAULT_ABI } from '@/lib/contracts';
import { ProtocolEvent } from '@/types';

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || 'http://localhost:3001';

type VaultLogName =
  | 'CollateralDeposited'
  | 'DebtBorrowed'
  | 'CollateralWithdrawn'
  | 'DebtRepaid'
  | 'HedgeExecuted';

const VAULT_LOG_CONFIG: Record<
  VaultLogName,
  { type: ProtocolEvent['type']; decimals: number; title: (amount: number) => string }
> = {
  CollateralDeposited: {
    type: 'DEPOSIT',
    decimals: 18,
    title: (amount) => `+${amount.toLocaleString()} WETH Deposited`,
  },
  DebtBorrowed: {
    type: 'BORROW',
    decimals: 6,
    title: (amount) => `Borrowed ${amount.toLocaleString()} tUSDC`,
  },
  CollateralWithdrawn: {
    type: 'WITHDRAW',
    decimals: 18,
    title: (amount) => `−${amount.toLocaleString()} WETH Withdrawn`,
  },
  DebtRepaid: {
    type: 'DEBT_REPAID',
    decimals: 6,
    title: (amount) => `Repaid ${amount.toLocaleString()} tUSDC`,
  },
  HedgeExecuted: {
    type: 'HEDGE_SETTLED',
    decimals: 6,
    title: (amount) => `✅ Micro-Hedge Settled: +$${amount.toFixed(2)} tUSDC`,
  },
};

async function blockTimestamps(
  publicClient: PublicClient,
  blockNumbers: bigint[],
): Promise<Map<bigint, number>> {
  const unique = Array.from(new Set(blockNumbers));
  const entries = await Promise.all(
    unique.map(async (blockNumber) => {
      const block = await publicClient.getBlock({ blockNumber });
      return [blockNumber, Number(block.timestamp) * 1000] as const;
    }),
  );
  return new Map(entries);
}

export async function fetchOnChainVaultEvents(
  publicClient: PublicClient,
  userAddress: string,
): Promise<ProtocolEvent[]> {
  const user = userAddress.toLowerCase() as Address;
  const events: ProtocolEvent[] = [];

  for (const eventName of Object.keys(VAULT_LOG_CONFIG) as VaultLogName[]) {
    try {
      const logs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESSES.vault,
        abi: LIQUIGUARD_VAULT_ABI,
        eventName,
        args: { user },
        fromBlock: BigInt(0),
        toBlock: 'latest',
      });

      if (logs.length === 0) continue;

      const timestamps = await blockTimestamps(
        publicClient,
        logs.map((log) => log.blockNumber),
      );
      const cfg = VAULT_LOG_CONFIG[eventName];

      for (const log of logs) {
        const txHash = log.transactionHash;
        const timestamp = timestamps.get(log.blockNumber) ?? Date.now();

        if (eventName === 'HedgeExecuted') {
          const args = log.args as { payoutAmount: bigint; newHealthFactor: bigint };
          const payout = Number(formatUnits(args.payoutAmount, 6));
          const hf = Number(formatUnits(args.newHealthFactor, 18));
          events.push({
            id: `chain-hedge-${txHash}`,
            type: 'HEDGE_SETTLED',
            title: cfg.title(payout),
            description: `Operator repaid vault debt on-chain. HF → ${hf.toFixed(2)}`,
            timestamp,
            txHash,
            source: 'ON-CHAIN',
          });
          continue;
        }

        const amountRaw = (log.args as { amount?: bigint }).amount;
        if (amountRaw === undefined) continue;
        const amount = Number(formatUnits(amountRaw, cfg.decimals));
        events.push({
          id: `chain-${eventName}-${txHash}-${log.logIndex}`,
          type: cfg.type,
          title: cfg.title(amount),
          description: 'On-chain vault transaction',
          timestamp,
          txHash,
          source: 'ON-CHAIN',
        });
      }
    } catch {
      // Skip failed log fetches — daemon hedge history may still populate the feed.
    }
  }

  return events;
}

interface DaemonHedgeRecord {
  id: string;
  userAddress?: string;
  status?: string;
  payoutUSDC?: number;
  triggerHf?: number;
  hedgeSizeUSDC?: number;
  newHealthFactor?: number;
  txHash?: string;
  createdAt?: number;
  completedAt?: number;
}

export function daemonHedgesToEvents(
  history: DaemonHedgeRecord[],
  userAddress: string,
): ProtocolEvent[] {
  const user = userAddress.toLowerCase();
  const events: ProtocolEvent[] = [];

  for (const h of history) {
    if (!h.userAddress || h.userAddress.toLowerCase() !== user) continue;

    const chainHash =
      typeof h.txHash === 'string' && h.txHash.startsWith('0x') && h.txHash.length === 66
        ? h.txHash
        : undefined;

    if (h.status === 'SETTLED' || h.status === 'COMPLETED' || (h.payoutUSDC && Number(h.payoutUSDC) > 0)) {
      events.push({
        id: chainHash ? `chain-hedge-${chainHash}` : `hedge-settled-${h.id}`,
        type: 'HEDGE_SETTLED',
        title: `✅ Micro-Hedge Settled: +$${Number(h.payoutUSDC)?.toFixed(2)} tUSDC`,
        description: chainHash
          ? `Operator repaid vault debt on-chain. HF → ${h.newHealthFactor?.toFixed(2) || 'Safe'}`
          : `Payout simulated (no operator tx). HF → ${h.newHealthFactor?.toFixed(2) || 'Safe'}`,
        timestamp: h.completedAt || h.createdAt || Date.now(),
        txHash: chainHash,
        source: chainHash ? 'ON-CHAIN' : 'DAEMON',
      });
    }

    events.push({
      id: `hedge-triggered-${h.id}`,
      type: 'HEDGE_TRIGGERED',
      title: `🚨 Micro-Hedge Triggered (HF: ${Number(h.triggerHf)?.toFixed(2)})`,
      description: `DreamDEX mock DOWN sized $${Number(h.hedgeSizeUSDC)?.toFixed(2)} — not a chain tx`,
      timestamp: h.createdAt || Date.now(),
      source: 'DAEMON',
    });
  }

  return events;
}

export async function fetchDaemonHedgeEvents(userAddress: string): Promise<ProtocolEvent[]> {
  try {
    const resp = await fetch(
      `${DAEMON_URL}/api/history?address=${encodeURIComponent(userAddress)}&limit=50`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data.history)) return [];
    return daemonHedgesToEvents(data.history, userAddress);
  } catch {
    return [];
  }
}

export function mergeActivityEvents(events: ProtocolEvent[]): ProtocolEvent[] {
  const byId = new Map<string, ProtocolEvent>();

  for (const ev of events) {
    const existing = byId.get(ev.id);
    if (!existing) {
      byId.set(ev.id, ev);
      continue;
    }

    const preferNew =
      ev.source === 'ON-CHAIN' && existing.source !== 'ON-CHAIN' ||
      ev.txHash && !existing.txHash ||
      ev.timestamp > existing.timestamp;

    if (preferNew) {
      byId.set(ev.id, { ...existing, ...ev });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);
}

/** Remove legacy localStorage keys from the old session-persisted feed. */
export function clearLegacyActivityStorage(userAddress?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('liquiguard_events_global');
    if (userAddress) {
      localStorage.removeItem(`liquiguard_events_${userAddress.toLowerCase()}`);
    }
  } catch {
    // ignore
  }
}
