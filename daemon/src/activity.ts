import { formatUnits, getAddress, type Address } from 'viem';
import { config } from './config.js';
import { publicClient, LiquiGuardVaultABI } from './chain.js';
import { logger } from './logger.js';
import { store } from './store.js';

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: number;
  txHash?: string;
  source: 'ON-CHAIN' | 'DAEMON';
  sortKey?: number;
}

interface CachedActivity {
  toBlock: bigint;
  fromBlock: bigint;
  events: ActivityEvent[];
  fetchedAt: number;
  backfilling: boolean;
}

interface RawLog {
  eventName: string;
  transactionHash: `0x${string}`;
  logIndex: number;
  blockNumber: bigint;
  args: Record<string, unknown>;
}

const cache = new Map<string, CachedActivity>();
/** Somnia RPC rejects eth_getLogs ranges over ~1000 blocks. */
const CHUNK = 900n;
const FAST_LOOKBACK = 900n;
const FULL_LOOKBACK = 90_000n;
const CACHE_TTL_MS = 4_000;

const EVENT_NAMES = [
  'CollateralDeposited',
  'DebtBorrowed',
  'CollateralWithdrawn',
  'DebtRepaid',
  'HedgeExecuted',
] as const;

function sortActivityEvents(events: ActivityEvent[]): ActivityEvent[] {
  return [...events]
    .sort((a, b) => {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      return (b.sortKey ?? 0) - (a.sortKey ?? 0);
    })
    .slice(0, 50);
}

async function mapLogs(logs: RawLog[], latestBlock: bigint, latestTsMs: number): Promise<ActivityEvent[]> {
  if (logs.length === 0) return [];
  const events: ActivityEvent[] = [];

  for (const log of logs) {
    const txHash = log.transactionHash;
    const delta = Number(latestBlock - log.blockNumber);
    const timestamp = latestTsMs - delta * 1000;
    const sortKey = Number(log.blockNumber) * 10_000 + log.logIndex;
    const eventName = log.eventName;
    const args = log.args;

    if (eventName === 'CollateralDeposited' || eventName === 'CollateralWithdrawn') {
      const amount = Number(formatUnits((args.amount as bigint | undefined) ?? 0n, 18));
      events.push({
        id: `chain-${eventName}-${txHash}-${log.logIndex}`,
        type: eventName === 'CollateralDeposited' ? 'DEPOSIT' : 'WITHDRAW',
        title:
          eventName === 'CollateralDeposited'
            ? `+${amount.toLocaleString()} WETH Deposited`
            : `−${amount.toLocaleString()} WETH Withdrawn`,
        description:
          eventName === 'CollateralDeposited' ? 'On-chain vault deposit' : 'On-chain vault withdrawal',
        timestamp,
        sortKey,
        txHash,
        source: 'ON-CHAIN',
      });
      continue;
    }

    if (eventName === 'DebtBorrowed' || eventName === 'DebtRepaid') {
      const amount = Number(formatUnits((args.amount as bigint | undefined) ?? 0n, 6));
      events.push({
        id: `chain-${eventName}-${txHash}-${log.logIndex}`,
        type: eventName === 'DebtBorrowed' ? 'BORROW' : 'DEBT_REPAID',
        title:
          eventName === 'DebtBorrowed'
            ? `Borrowed ${amount.toLocaleString()} tUSDC`
            : `Repaid ${amount.toLocaleString()} tUSDC`,
        description: eventName === 'DebtBorrowed' ? 'On-chain vault borrow' : 'On-chain vault repay',
        timestamp,
        sortKey,
        txHash,
        source: 'ON-CHAIN',
      });
      continue;
    }

    if (eventName === 'HedgeExecuted') {
      const payout = Number(formatUnits((args.payoutAmount as bigint | undefined) ?? 0n, 6));
      const hf = Number(formatUnits((args.newHealthFactor as bigint | undefined) ?? 0n, 18));
      events.push({
        id: `chain-hedge-${txHash}`,
        type: 'HEDGE_SETTLED',
        title: `✅ Micro-Hedge Settled: +$${payout.toFixed(2)} tUSDC`,
        description: `Operator repaid vault debt on-chain. HF → ${hf.toFixed(2)}`,
        timestamp,
        sortKey,
        txHash,
        source: 'ON-CHAIN',
      });
    }
  }

  return events;
}

async function getLogsWindow(user: Address, fromBlock: bigint, toBlock: bigint): Promise<RawLog[]> {
  const chunks = await Promise.all(
    EVENT_NAMES.map(async (eventName) => {
      try {
        return await publicClient.getContractEvents({
          address: config.contracts.vaultAddress,
          abi: LiquiGuardVaultABI,
          eventName,
          args: { user },
          fromBlock,
          toBlock,
        });
      } catch (err) {
        logger.warn(
          `[Activity] getLogs ${eventName} ${fromBlock}-${toBlock} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return [];
      }
    }),
  );

  const logs: RawLog[] = [];
  for (const chunk of chunks) {
    for (const log of chunk) {
      logs.push({
        eventName: log.eventName,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex ?? 0,
        blockNumber: log.blockNumber,
        args: (log.args ?? {}) as Record<string, unknown>,
      });
    }
  }
  return logs;
}

function hedgeEventsForUser(userAddress: string): ActivityEvent[] {
  const history = store.getHedgeHistory(50, userAddress);
  const events: ActivityEvent[] = [];

  for (const h of history) {
    const chainHash =
      typeof h.txHash === 'string' && h.txHash.startsWith('0x') && h.txHash.length === 66
        ? h.txHash
        : undefined;
    const settledAt = h.completedAt || h.createdAt;

    if (h.status === 'SETTLED' || h.status === 'COMPLETED' || (h.payoutUSDC && h.payoutUSDC > 0)) {
      events.push({
        id: chainHash ? `chain-hedge-${chainHash}` : `hedge-settled-${h.id}`,
        type: 'HEDGE_SETTLED',
        title: `✅ Micro-Hedge Settled: +$${Number(h.payoutUSDC).toFixed(2)} tUSDC`,
        description: chainHash
          ? `Operator repaid vault debt on-chain. HF → ${h.newHealthFactor?.toFixed(2) || 'Safe'}`
          : `Payout simulated (no operator tx). HF → ${h.newHealthFactor?.toFixed(2) || 'Safe'}`,
        timestamp: settledAt,
        sortKey: settledAt,
        txHash: chainHash,
        source: chainHash ? 'ON-CHAIN' : 'DAEMON',
      });
    }

    events.push({
      id: `hedge-triggered-${h.id}`,
      type: 'HEDGE_TRIGGERED',
      title: `🚨 Micro-Hedge Triggered (HF: ${Number(h.triggerHf).toFixed(2)})`,
      description: `DreamDEX mock DOWN sized $${Number(h.hedgeSizeUSDC).toFixed(2)} — not a chain tx`,
      timestamp: h.createdAt,
      sortKey: h.createdAt,
      source: 'DAEMON',
    });
  }

  return events;
}

function mergeChainEvents(existing: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] {
  const byId = new Map(existing.map((ev) => [ev.id, ev]));
  for (const ev of incoming) byId.set(ev.id, ev);
  return Array.from(byId.values());
}

function assemble(chainEvents: ActivityEvent[], userKey: string) {
  const hedges = hedgeEventsForUser(userKey);
  const completed = store
    .getHedgeHistory(50, userKey)
    .filter((h) => h.status === 'COMPLETED' || (h.payoutUSDC && h.payoutUSDC > 0));
  const totalPayout = completed.reduce((sum, h) => sum + (Number(h.payoutUSDC) || 0), 0);
  const lastPayout = completed[0] ? Number(completed[0].payoutUSDC) || 0 : 0;

  const byId = new Map<string, ActivityEvent>();
  for (const ev of [...chainEvents, ...hedges]) {
    const existing = byId.get(ev.id);
    if (!existing || (ev.source === 'ON-CHAIN' && existing.source !== 'ON-CHAIN')) {
      byId.set(ev.id, ev);
    }
  }

  return {
    events: sortActivityEvents(Array.from(byId.values())),
    lastPayout,
    totalPayout,
  };
}

function scheduleBackfill(
  user: Address,
  userKey: string,
  oldestScanned: bigint,
  latestBlock: bigint,
  latestTsMs: number,
): void {
  const cached = cache.get(userKey);
  if (!cached || cached.backfilling) return;
  const minBlock = latestBlock > FULL_LOOKBACK ? latestBlock - FULL_LOOKBACK : 0n;
  if (oldestScanned <= minBlock) return;

  cached.backfilling = true;
  void (async () => {
    try {
      let cursor = oldestScanned;
      while (cursor > minBlock) {
        const end = cursor - 1n;
        const start = end > CHUNK ? end - CHUNK + 1n : minBlock;
        const from = start < minBlock ? minBlock : start;
        const logs = await getLogsWindow(user, from, end);
        const mapped = await mapLogs(logs, latestBlock, latestTsMs);
        const current = cache.get(userKey);
        if (!current) return;
        current.events = mergeChainEvents(current.events, mapped);
        current.fromBlock = from;
        cursor = from;
      }
    } catch (err) {
      logger.warn(`[Activity] backfill failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      const current = cache.get(userKey);
      if (current) current.backfilling = false;
    }
  })();
}

export async function getUserActivity(rawAddress: string): Promise<{
  events: ActivityEvent[];
  lastPayout: number;
  totalPayout: number;
}> {
  let user: Address;
  try {
    user = getAddress(rawAddress);
  } catch {
    return { events: [], lastPayout: 0, totalPayout: 0 };
  }

  const userKey = user.toLowerCase();
  const hedgesOnly = assemble([], userKey);

  let latestBlock: bigint;
  let latestTsMs: number;
  try {
    latestBlock = await publicClient.getBlockNumber();
    const latestHeader = await publicClient.getBlock({ blockNumber: latestBlock });
    latestTsMs = Number(latestHeader.timestamp) * 1000;
  } catch (err) {
    logger.warn(`[Activity] RPC head failed: ${err instanceof Error ? err.message : String(err)}`);
    return hedgesOnly;
  }

  const cached = cache.get(userKey);
  let chainEvents: ActivityEvent[] = cached?.events ?? [];
  const shouldRefresh = !cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS;

  if (shouldRefresh) {
    const fromBlock = cached
      ? cached.toBlock + 1n
      : latestBlock > FAST_LOOKBACK
        ? latestBlock - FAST_LOOKBACK
        : 0n;

    if (fromBlock <= latestBlock) {
      try {
        const logs = await getLogsWindow(user, fromBlock, latestBlock);
        const mapped = await mapLogs(logs, latestBlock, latestTsMs);
        chainEvents = mergeChainEvents(chainEvents, mapped);
      } catch (err) {
        logger.warn(`[Activity] recent logs failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const fromScanned = cached?.fromBlock ?? fromBlock;
    cache.set(userKey, {
      toBlock: latestBlock,
      fromBlock: fromScanned,
      events: chainEvents,
      fetchedAt: Date.now(),
      backfilling: cached?.backfilling ?? false,
    });

    if (!cached) {
      scheduleBackfill(user, userKey, fromBlock, latestBlock, latestTsMs);
    }
  }

  return assemble(chainEvents, userKey);
}
