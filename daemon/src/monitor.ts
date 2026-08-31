import { EventEmitter } from 'events';
import { formatUnits, parseUnits } from 'viem';
import { config } from './config.js';
import { logger } from './logger.js';
import { store, type WatchedVault } from './store.js';
import {
  publicClient,
  LiquiGuardVaultABI,
  MockPriceOracleABI,
  MockLendingPoolABI,
  isContractDeployed,
  withRetry,
} from './chain.js';

export interface RiskDetectedPayload {
  userAddress: string;
  currentHF: number;
  targetHF: number;
  requiredDebtReductionUSDC: number;
  hedgeSizeUSDC: number;
  collateralWETH: number;
  debtUSDC: number;
  priceETH: number;
  timestamp: number;
}

export interface HealthCheckPayload {
  watchedCount: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  hedgingCount: number;
  timestamp: number;
}

export class HealthFactorMonitor extends EventEmitter {
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private isChecking = false;
  private contractsAvailable = false;
  private liquidationThreshold = 0.80; // 80% liquidation threshold

  constructor() {
    super();
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Monitor] HealthFactorMonitor is already running.');
      return;
    }

    this.isRunning = true;
    logger.info(`[Monitor] Starting HealthFactorMonitor (interval: ${config.thresholds.pollIntervalMs}ms, triggerHF: < ${config.thresholds.hedgeTriggerHf}, targetHF: ${config.thresholds.targetHf})`);

    // Check if on-chain contracts are reachable
    this.contractsAvailable = await this.checkContractAvailability();

    // Initial check
    await this.checkAllVaults();

    // Start polling loop
    this.pollTimer = setInterval(async () => {
      try {
        await this.checkAllVaults();
      } catch (err) {
        logger.error(`[Monitor] Error during health factor polling: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, config.thresholds.pollIntervalMs);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('[Monitor] HealthFactorMonitor stopped.');
  }

  public async checkContractAvailability(): Promise<boolean> {
    const isVaultDeployed = await isContractDeployed(config.contracts.vaultAddress);
    if (isVaultDeployed) {
      logger.info(`[Monitor] On-chain LiquiGuardVault verified at ${config.contracts.vaultAddress}`);
      return true;
    } else {
      logger.info(`[Monitor] On-chain LiquiGuardVault not found at ${config.contracts.vaultAddress}. Running in dual simulated mode.`);
      return false;
    }
  }

  public async addWatchAddress(userAddress: string): Promise<void> {
    const addr = userAddress.toLowerCase();
    const existing = store.getVault(addr);
    if (!existing) {
      // Default initial mock vault position if none exists
      const initialVault: WatchedVault = {
        userAddress: addr,
        collateralWETH: '1.0',
        debtUSDC: '1440.0', // Collateral 1 ETH * $3000 * 0.80 / 1.67 HF ≈ 1440 debt
        healthFactor: 1.67,
        isProtected: false,
        status: 'HEALTHY',
        lastCheckedAt: Date.now(),
        lastPriceETH: store.getSimulatedEthPrice(),
      };
      store.upsertVault(initialVault);
      logger.info(`[Monitor] Added new watched user vault: ${addr}`);
      await this.checkVault(addr);
    }
  }

  public removeWatchAddress(userAddress: string): void {
    const addr = userAddress.toLowerCase();
    store.removeVault(addr);
    logger.info(`[Monitor] Removed watched user vault: ${addr}`);
  }

  public async checkAllVaults(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      // 1. If on-chain contract is available, discover new active users from contract
      if (this.contractsAvailable) {
        await this.syncOnChainUsers();
      }

      // 2. Fetch current ETH price
      const ethPrice = await this.getCurrentETHPrice();

      // 3. Check every registered vault
      const vaults = store.getAllVaults();

      // Seed a default demo vault if store is empty
      if (vaults.length === 0) {
        const demoUser = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
        await this.addWatchAddress(demoUser);
      }

      let healthyCount = 0;
      let warningCount = 0;
      let criticalCount = 0;
      let hedgingCount = 0;

      for (const vault of store.getAllVaults()) {
        const updatedVault = await this.checkVaultPosition(vault.userAddress, ethPrice);
        if (updatedVault) {
          if (updatedVault.status === 'HEALTHY' || updatedVault.status === 'PROTECTED') healthyCount++;
          else if (updatedVault.status === 'WARNING') warningCount++;
          else if (updatedVault.status === 'CRITICAL') criticalCount++;
          else if (updatedVault.status === 'HEDGING') hedgingCount++;
        }
      }

      const checkPayload: HealthCheckPayload = {
        watchedCount: store.getAllVaults().length,
        healthyCount,
        warningCount,
        criticalCount,
        hedgingCount,
        timestamp: Date.now(),
      };

      this.emit('healthCheck', checkPayload);
    } finally {
      this.isChecking = false;
    }
  }

  public async checkVault(userAddress: string): Promise<WatchedVault | undefined> {
    const ethPrice = await this.getCurrentETHPrice();
    return this.checkVaultPosition(userAddress, ethPrice);
  }

  private async checkVaultPosition(userAddress: string, ethPrice: number): Promise<WatchedVault | undefined> {
    const addr = userAddress.toLowerCase();
    let collateralWETH = 1.0;
    let debtUSDC = 1440.0;
    let healthFactor = 1.67;
    let isProtected = false;

    // Try reading on-chain first if contract deployed
    if (this.contractsAvailable) {
      try {
        const position = await withRetry(async () => {
          return await publicClient.readContract({
            address: config.contracts.vaultAddress,
            abi: LiquiGuardVaultABI,
            functionName: 'getUserPosition',
            args: [addr as `0x${string}`],
          });
        }, 2, 500, `getUserPosition(${addr})`);

        if (position) {
          const [colWethRaw, debtUsdcRaw, hfRaw, prot] = position;
          collateralWETH = parseFloat(formatUnits(colWethRaw, 18));
          debtUSDC = parseFloat(formatUnits(debtUsdcRaw, 6)); // USDC 6 decimals
          healthFactor = parseFloat(formatUnits(hfRaw, 18));
          isProtected = prot;
        }
      } catch (err) {
        logger.debug(`[Monitor] On-chain position query failed for ${addr}, falling back to simulated formula: ${err instanceof Error ? err.message : String(err)}`);
        // Fallback to calculation from store/simulation
        const existing = store.getVault(addr);
        if (existing) {
          collateralWETH = parseFloat(existing.collateralWETH) || 1.0;
          debtUSDC = parseFloat(existing.debtUSDC) || 1440.0;
          isProtected = existing.isProtected;
          // Calculate HF = (Collateral * Price * LT) / Debt
          if (debtUSDC > 0) {
            healthFactor = (collateralWETH * ethPrice * this.liquidationThreshold) / debtUSDC;
          } else {
            healthFactor = 999.0;
          }
        }
      }
    } else {
      // Pure simulation mode
      const existing = store.getVault(addr);
      if (existing) {
        collateralWETH = parseFloat(existing.collateralWETH) || 1.0;
        debtUSDC = parseFloat(existing.debtUSDC) || 1440.0;
        isProtected = existing.isProtected;
      }
      if (debtUSDC > 0) {
        healthFactor = (collateralWETH * ethPrice * this.liquidationThreshold) / debtUSDC;
      } else {
        healthFactor = 999.0;
      }
    }

    // Determine vault status
    let status: WatchedVault['status'] = 'HEALTHY';
    const existing = store.getVault(addr);

    if (existing?.status === 'HEDGING') {
      status = 'HEDGING';
    } else if (isProtected) {
      status = 'PROTECTED';
    } else if (healthFactor < config.thresholds.hedgeTriggerHf) {
      status = 'CRITICAL';
    } else if (healthFactor < config.thresholds.hedgeTriggerHf + 0.15) {
      status = 'WARNING';
    } else {
      status = 'HEALTHY';
    }

    const updatedVault: WatchedVault = {
      userAddress: addr,
      collateralWETH: collateralWETH.toString(),
      debtUSDC: debtUSDC.toString(),
      healthFactor: Math.round(healthFactor * 100) / 100,
      isProtected,
      status,
      lastCheckedAt: Date.now(),
      lastPriceETH: ethPrice,
    };

    store.upsertVault(updatedVault);
    this.emit('vaultUpdated', updatedVault);

    // Trigger hedge when HF < trigger threshold and not already hedging or protected
    if (healthFactor < config.thresholds.hedgeTriggerHf && !isProtected && existing?.status !== 'HEDGING') {
      // Calculate required debt reduction ΔL to restore HF to TARGET_HF (1.50)
      // HF_target = (Collateral * Price * LT) / (Debt - ΔL)
      // (Debt - ΔL) = (Collateral * Price * LT) / HF_target
      // ΔL = Debt - [(Collateral * Price * LT) / HF_target]
      const targetHF = config.thresholds.targetHf;
      const targetMaxDebt = (collateralWETH * ethPrice * this.liquidationThreshold) / targetHF;
      const deltaL = Math.max(0, debtUSDC - targetMaxDebt);

      // Hedge size Q_hedge = ΔL / (1 - P_entry)
      const pEntry = config.dreamdex.entryPrice;
      const hedgeSize = deltaL / (1.0 - pEntry);

      logger.warn(
        `[Monitor] 🚨 RISK DETECTED for vault ${addr}: HF=${healthFactor.toFixed(2)} (< ${config.thresholds.hedgeTriggerHf}). Required ΔL=$${deltaL.toFixed(2)}, HedgeSize=$${hedgeSize.toFixed(2)}`
      );

      const riskPayload: RiskDetectedPayload = {
        userAddress: addr,
        currentHF: healthFactor,
        targetHF,
        requiredDebtReductionUSDC: deltaL,
        hedgeSizeUSDC: hedgeSize,
        collateralWETH,
        debtUSDC,
        priceETH: ethPrice,
        timestamp: Date.now(),
      };

      // Mark vault status as HEDGING
      store.upsertVault({ ...updatedVault, status: 'HEDGING' });

      // Emit risk detected event for executor to handle
      this.emit('riskDetected', riskPayload);
    }

    return updatedVault;
  }

  private async syncOnChainUsers(): Promise<void> {
    try {
      const activeUsers = await publicClient.readContract({
        address: config.contracts.vaultAddress,
        abi: LiquiGuardVaultABI,
        functionName: 'getActiveUsers',
      });

      if (Array.isArray(activeUsers)) {
        for (const user of activeUsers) {
          if (user && typeof user === 'string') {
            await this.addWatchAddress(user);
          }
        }
      }
    } catch (err) {
      logger.debug(`[Monitor] getActiveUsers contract call failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async getCurrentETHPrice(): Promise<number> {
    if (this.contractsAvailable && config.contracts.priceOracleAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        const rawPrice = await publicClient.readContract({
          address: config.contracts.priceOracleAddress,
          abi: MockPriceOracleABI,
          functionName: 'getETHPrice',
        });
        const price = parseFloat(formatUnits(rawPrice, 8)); // 8 decimals standard Chainlink
        if (price > 0) {
          store.setSimulatedEthPrice(price);
          return price;
        }
      } catch (err) {
        logger.debug(`[Monitor] On-chain oracle query failed, using simulated price: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return store.getSimulatedEthPrice();
  }
}

// Global monitor singleton
export const monitor = new HealthFactorMonitor();
