import Database from 'better-sqlite3';
import { logger } from './logger.js';

export interface WatchedVault {
  userAddress: string;
  collateralWETH: string;
  debtUSDC: string;
  healthFactor: number;
  isProtected: boolean;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'HEDGING' | 'PROTECTED';
  lastCheckedAt: number;
  lastPriceETH?: number;
}

export interface HedgeExecution {
  id: string;
  userAddress: string;
  triggerHf: number;
  targetHf: number;
  requiredDebtReductionUSDC: number;
  hedgeSizeUSDC: number;
  payoutUSDC: number;
  marketId: string;
  orderId: string;
  side: string;
  entryPrice: number;
  mode: 'mock' | 'live';
  txHash?: string;
  status: 'INITIATED' | 'ORDER_PLACED' | 'SETTLED' | 'REPAID_ON_CHAIN' | 'COMPLETED' | 'FAILED';
  error?: string;
  newHealthFactor?: number;
  createdAt: number;
  completedAt?: number;
}

export interface StoreStats {
  activeVaultsCount: number;
  totalHedgesExecuted: number;
  totalDebtRepaidUSDC: number;
  startedAt: number;
  currentSimulatedEthPrice: number;
}

export class DaemonStore {
  private db: Database.Database | null = null;
  private isSqlite = false;

  // In-memory maps (used directly or as fallback)
  private memoryVaults = new Map<string, WatchedVault>();
  private memoryHedges = new Map<string, HedgeExecution>();
  private startedAt = Date.now();
  private simulatedEthPrice = 3000.0;

  constructor(dbPath = ':memory:') {
    try {
      this.db = new Database(dbPath);
      this.initTables();
      this.isSqlite = true;
      logger.info(`[Store] Initialized SQLite database at ${dbPath}`);
    } catch (err) {
      logger.warn(`[Store] SQLite initialization failed, using in-memory store: ${err instanceof Error ? err.message : String(err)}`);
      this.isSqlite = false;
    }
  }

  private initTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watched_vaults (
        user_address TEXT PRIMARY KEY,
        collateral_weth TEXT NOT NULL,
        debt_usdc TEXT NOT NULL,
        health_factor REAL NOT NULL,
        is_protected INTEGER NOT NULL,
        status TEXT NOT NULL,
        last_checked_at INTEGER NOT NULL,
        last_price_eth REAL
      );

      CREATE TABLE IF NOT EXISTS hedge_executions (
        id TEXT PRIMARY KEY,
        user_address TEXT NOT NULL,
        trigger_hf REAL NOT NULL,
        target_hf REAL NOT NULL,
        required_debt_reduction_usdc REAL NOT NULL,
        hedge_size_usdc REAL NOT NULL,
        payout_usdc REAL NOT NULL,
        market_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL NOT NULL,
        mode TEXT NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL,
        error TEXT,
        new_health_factor REAL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );
    `);
  }

  // --- Watched Vaults ---

  public upsertVault(vault: WatchedVault): void {
    const address = vault.userAddress.toLowerCase();
    const normalized: WatchedVault = { ...vault, userAddress: address };

    this.memoryVaults.set(address, normalized);

    if (this.isSqlite && this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO watched_vaults (
            user_address, collateral_weth, debt_usdc, health_factor, is_protected, status, last_checked_at, last_price_eth
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_address) DO UPDATE SET
            collateral_weth = excluded.collateral_weth,
            debt_usdc = excluded.debt_usdc,
            health_factor = excluded.health_factor,
            is_protected = excluded.is_protected,
            status = excluded.status,
            last_checked_at = excluded.last_checked_at,
            last_price_eth = excluded.last_price_eth
        `);
        stmt.run(
          address,
          normalized.collateralWETH,
          normalized.debtUSDC,
          normalized.healthFactor,
          normalized.isProtected ? 1 : 0,
          normalized.status,
          normalized.lastCheckedAt,
          normalized.lastPriceETH ?? null
        );
      } catch (err) {
        logger.error(`[Store] Failed to upsert vault in SQLite: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  public getVault(userAddress: string): WatchedVault | undefined {
    const address = userAddress.toLowerCase();
    if (this.memoryVaults.has(address)) {
      return this.memoryVaults.get(address);
    }
    if (this.isSqlite && this.db) {
      try {
        const row = this.db.prepare('SELECT * FROM watched_vaults WHERE user_address = ?').get(address) as any;
        if (row) {
          const vault: WatchedVault = {
            userAddress: row.user_address,
            collateralWETH: row.collateral_weth,
            debtUSDC: row.debt_usdc,
            healthFactor: row.health_factor,
            isProtected: Boolean(row.is_protected),
            status: row.status,
            lastCheckedAt: row.last_checked_at,
            lastPriceETH: row.last_price_eth ?? undefined,
          };
          this.memoryVaults.set(address, vault);
          return vault;
        }
      } catch (err) {
        logger.error(`[Store] Failed to get vault from SQLite: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return undefined;
  }

  public getAllVaults(): WatchedVault[] {
    if (this.isSqlite && this.db) {
      try {
        const rows = this.db.prepare('SELECT * FROM watched_vaults').all() as any[];
        return rows.map((row) => ({
          userAddress: row.user_address,
          collateralWETH: row.collateral_weth,
          debtUSDC: row.debt_usdc,
          healthFactor: row.health_factor,
          isProtected: Boolean(row.is_protected),
          status: row.status,
          lastCheckedAt: row.last_checked_at,
          lastPriceETH: row.last_price_eth ?? undefined,
        }));
      } catch (err) {
        logger.error(`[Store] Failed to get all vaults from SQLite: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return Array.from(this.memoryVaults.values());
  }

  public removeVault(userAddress: string): boolean {
    const address = userAddress.toLowerCase();
    this.memoryVaults.delete(address);
    if (this.isSqlite && this.db) {
      try {
        const res = this.db.prepare('DELETE FROM watched_vaults WHERE user_address = ?').run(address);
        return res.changes > 0;
      } catch (err) {
        logger.error(`[Store] Failed to remove vault from SQLite: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return true;
  }

  // --- Hedge Executions ---

  public recordHedge(hedge: HedgeExecution): void {
    this.memoryHedges.set(hedge.id, { ...hedge });

    if (this.isSqlite && this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO hedge_executions (
            id, user_address, trigger_hf, target_hf, required_debt_reduction_usdc,
            hedge_size_usdc, payout_usdc, market_id, order_id, side, entry_price,
            mode, tx_hash, status, error, new_health_factor, created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            order_id = excluded.order_id,
            payout_usdc = excluded.payout_usdc,
            hedge_size_usdc = excluded.hedge_size_usdc,
            required_debt_reduction_usdc = excluded.required_debt_reduction_usdc,
            status = excluded.status,
            tx_hash = excluded.tx_hash,
            error = excluded.error,
            new_health_factor = excluded.new_health_factor,
            completed_at = excluded.completed_at
        `);
        stmt.run(
          hedge.id,
          hedge.userAddress.toLowerCase(),
          hedge.triggerHf,
          hedge.targetHf,
          hedge.requiredDebtReductionUSDC,
          hedge.hedgeSizeUSDC,
          hedge.payoutUSDC,
          hedge.marketId,
          hedge.orderId,
          hedge.side,
          hedge.entryPrice,
          hedge.mode,
          hedge.txHash ?? null,
          hedge.status,
          hedge.error ?? null,
          hedge.newHealthFactor ?? null,
          hedge.createdAt,
          hedge.completedAt ?? null
        );
      } catch (err) {
        logger.error(`[Store] Failed to record hedge execution in SQLite: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  public updateHedge(id: string, updates: Partial<HedgeExecution>): HedgeExecution | undefined {
    const existing = this.getHedge(id);
    if (!existing) return undefined;

    const updated: HedgeExecution = { ...existing, ...updates };
    this.recordHedge(updated);
    return updated;
  }

  public getHedge(id: string): HedgeExecution | undefined {
    if (this.memoryHedges.has(id)) {
      return this.memoryHedges.get(id);
    }
    if (this.isSqlite && this.db) {
      try {
        const row = this.db.prepare('SELECT * FROM hedge_executions WHERE id = ?').get(id) as any;
        if (row) {
          return this.mapHedgeRow(row);
        }
      } catch (err) {
        logger.error(`[Store] Failed to get hedge from SQLite: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return undefined;
  }

  public getHedgeHistory(limit = 50): HedgeExecution[] {
    if (this.isSqlite && this.db) {
      try {
        const rows = this.db.prepare('SELECT * FROM hedge_executions ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
        return rows.map((r) => this.mapHedgeRow(r));
      } catch (err) {
        logger.error(`[Store] Failed to get hedge history from SQLite: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return Array.from(this.memoryHedges.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  private mapHedgeRow(row: any): HedgeExecution {
    return {
      id: row.id,
      userAddress: row.user_address,
      triggerHf: row.trigger_hf,
      targetHf: row.target_hf,
      requiredDebtReductionUSDC: row.required_debt_reduction_usdc,
      hedgeSizeUSDC: row.hedge_size_usdc,
      payoutUSDC: row.payout_usdc,
      marketId: row.market_id,
      orderId: row.order_id,
      side: row.side,
      entryPrice: row.entry_price,
      mode: row.mode,
      txHash: row.tx_hash ?? undefined,
      status: row.status,
      error: row.error ?? undefined,
      newHealthFactor: row.new_health_factor ?? undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
    };
  }

  // --- Simulated Oracle & Price State ---

  public getSimulatedEthPrice(): number {
    return this.simulatedEthPrice;
  }

  public setSimulatedEthPrice(price: number): void {
    this.simulatedEthPrice = price;
  }

  // --- Stats ---

  public getStats(): StoreStats {
    const vaults = this.getAllVaults();
    const hedges = this.getHedgeHistory(1000);
    const completed = hedges.filter((h) => h.status === 'COMPLETED');
    const totalDebtRepaid = completed.reduce((acc, h) => acc + h.payoutUSDC, 0);

    return {
      activeVaultsCount: vaults.length,
      totalHedgesExecuted: completed.length,
      totalDebtRepaidUSDC: totalDebtRepaid,
      startedAt: this.startedAt,
      currentSimulatedEthPrice: this.simulatedEthPrice,
    };
  }
}

// Global store singleton
export const store = new DaemonStore();
