import { type PublicClient, formatUnits, getAddress, type Address } from 'viem';
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

/** Somnia RPC rejects eth_getLogs ranges over ~1000 blocks. */
const LOOKBACK = BigInt(900);

function sortActivityEvents(events: ProtocolEvent[]): ProtocolEvent[] {
  return [...events]
    .sort((a, b) => {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      return (b.sortKey ?? 0) - (a.sortKey ?? 0);
    })
    .slice(0, 50);
}

export async function fetchOnChainVaultEvents(
  publicClient: PublicClient,
  userAddress: string,
): Promise<ProtocolEvent[]> {
  let user: Address;
  try {
    user = getAddress(userAddress);
  } catch {
    return [];
  }

  const latestBlock = await publicClient.getBlockNumber();
  const latestHeader = await publicClient.getBlock({ blockNumber: latestBlock });
  const latestTsMs = Number(latestHeader.timestamp) * 1000;
  const fromBlock = latestBlock > LOOKBACK ? latestBlock - LOOKBACK : BigInt(0);
  const eventNames = Object.keys(VAULT_LOG_CONFIG) as VaultLogName[];

  const logBatches = await Promise.all(
    eventNames.map(async (eventName) => {
      try {
        return await publicClient.getContractEvents({
          address: CONTRACT_ADDRESSES.vault,
          abi: LIQUIGUARD_VAULT_ABI,
          eventName,
          args: { user },
          fromBlock,
          toBlock: latestBlock,
        });
      } catch {
        return [];
      }
    }),
  );

  const events: ProtocolEvent[] = [];

  for (const logs of logBatches) {
    for (const log of logs) {
      const eventName = log.eventName as VaultLogName;
      const cfg = VAULT_LOG_CONFIG[eventName];
      if (!cfg) continue;

      const txHash = log.transactionHash;
      const delta = Number(latestBlock - log.blockNumber);
      const timestamp = latestTsMs - delta * 1000;
      const sortKey = Number(log.blockNumber) * 10_000 + (log.logIndex ?? 0);

      if (eventName === 'HedgeExecuted') {
        const args = log.args as { payoutAmount?: bigint; newHealthFactor?: bigint };
        const payout = Number(formatUnits(args.payoutAmount ?? BigInt(0), 6));
        const hf = Number(formatUnits(args.newHealthFactor ?? BigInt(0), 18));
        events.push({
          id: `chain-hedge-${txHash}`,
          type: 'HEDGE_SETTLED',
          title: cfg.title(payout),
          description: `Operator repaid vault debt on-chain. HF → ${hf.toFixed(2)}`,
          timestamp,
          sortKey,
          txHash,
          source: 'ON-CHAIN',
        });
        continue;
      }

      const amountRaw = (log.args as { amount?: bigint }).amount;
      if (amountRaw === undefined) continue;
      const amount = Number(formatUnits(amountRaw, cfg.decimals));
      events.push({
        id: `chain-${eventName}-${txHash}-${log.logIndex ?? 0}`,
        type: cfg.type,
        title: cfg.title(amount),
        description: 'On-chain vault transaction',
        timestamp,
        sortKey,
        txHash,
        source: 'ON-CHAIN',
      });
    }
  }

  return events;
}

export async function fetchDaemonActivity(userAddress: string): Promise<{
  ok: boolean;
  events: ProtocolEvent[];
  lastPayout: number;
  totalPayout: number;
}> {
  try {
    const resp = await fetch(`${DAEMON_URL}/api/activity/${encodeURIComponent(userAddress)}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return { ok: false, events: [], lastPayout: 0, totalPayout: 0 };
    const data = await resp.json();
    const events: ProtocolEvent[] = Array.isArray(data.events) ? data.events : [];
    return {
      ok: true,
      events,
      lastPayout: Number(data.lastPayout) || 0,
      totalPayout: Number(data.totalPayout) || 0,
    };
  } catch {
    return { ok: false, events: [], lastPayout: 0, totalPayout: 0 };
  }
}

export function mergeActivityEvents(events: ProtocolEvent[]): ProtocolEvent[] {
  const byId = new Map<string, ProtocolEvent>();

  for (const ev of events) {
    if (!ev?.id) continue;
    const existing = byId.get(ev.id);
    if (!existing) {
      byId.set(ev.id, ev);
      continue;
    }

    const preferNew =
      (ev.source === 'ON-CHAIN' && existing.source !== 'ON-CHAIN') ||
      Boolean(ev.txHash && !existing.txHash);

    if (preferNew) {
      byId.set(ev.id, { ...existing, ...ev });
    }
  }

  return sortActivityEvents(Array.from(byId.values()));
}

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
