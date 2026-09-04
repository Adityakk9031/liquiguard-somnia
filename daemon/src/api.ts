import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { parseUnits } from 'viem';
import { config } from './config.js';
import { logger, getRecentLogs } from './logger.js';
import { store } from './store.js';
import { monitor } from './monitor.js';
import { executor } from './executor.js';
import { dreamdex } from './dreamdex.js';
import {
  publicClient,
  walletClient,
  MockPriceOracleABI,
  MockERC20ABI,
  LiquiGuardVaultABI,
  isContractDeployed,
  withRetry,
} from './chain.js';

export function createApiServer(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Request logger middleware
  app.use((req, _res, next) => {
    if (req.path !== '/api/status' && req.path !== '/api/logs') {
      logger.debug(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health / Status Endpoint
  app.get('/api/status', async (_req: Request, res: Response) => {
    try {
      const stats = store.getStats();
      const currentEthPrice = await monitor.getCurrentETHPrice();
      const isVaultLive = await isContractDeployed(config.contracts.vaultAddress);

      res.json({
        status: 'online',
        uptimeSeconds: Math.floor((Date.now() - stats.startedAt) / 1000),
        chain: {
          id: config.chainId,
          name: 'Somnia Shannon Testnet',
          rpcUrl: config.rpcUrl,
          contracts: {
            vault: config.contracts.vaultAddress,
            lendingPool: config.contracts.lendingPoolAddress,
            priceOracle: config.contracts.priceOracleAddress,
            weth: config.contracts.wethAddress,
            tusdc: config.contracts.tusdcAddress,
            isVaultLive,
          },
        },
        dreamdex: {
          mode: dreamdex.getMode(),
          indexerUrl: config.dreamdex.indexerUrl,
          defaultMarket: config.dreamdex.defaultMarketId,
          entryPrice: config.dreamdex.entryPrice,
        },
        thresholds: {
          hedgeTriggerHf: config.thresholds.hedgeTriggerHf,
          targetHf: config.thresholds.targetHf,
          pollIntervalMs: config.thresholds.pollIntervalMs,
        },
        oracle: {
          currentEthPrice,
        },
        stats,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get all monitored vaults
  app.get('/api/vaults', (_req: Request, res: Response) => {
    try {
      const vaults = store.getAllVaults();
      res.json({ vaults, count: vaults.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get specific monitored vault
  app.get('/api/vaults/:address', async (req: Request, res: Response) => {
    try {
      const paramAddr = req.params.address;
      const addr = (Array.isArray(paramAddr) ? paramAddr[0] : paramAddr) as string;
      const vault = store.getVault(addr) || await monitor.checkVault(addr);
      if (!vault) {
        res.status(404).json({ error: `Vault not found for address: ${addr}` });
        return;
      }
      res.json({ vault });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Register new vault address to monitor
  app.post('/api/watch', async (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
        res.status(400).json({ error: 'Valid Ethereum address (0x...) is required in body.address' });
        return;
      }

      await monitor.addWatchAddress(address);
      const vault = store.getVault(address);
      res.status(201).json({ message: `Successfully registered vault for ${address}`, vault });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Unregister vault address
  app.post('/api/unwatch', (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== 'string') {
        res.status(400).json({ error: 'Address is required in body.address' });
        return;
      }

      monitor.removeWatchAddress(address);
      res.json({ message: `Unregistered vault for ${address}` });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get historical hedge executions
  app.get('/api/history', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      const history = store.getHedgeHistory(limit);
      res.json({ history, count: history.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get single hedge execution by ID
  app.get('/api/history/:id', (req: Request, res: Response) => {
    try {
      const paramId = req.params.id;
      const id = (Array.isArray(paramId) ? paramId[0] : paramId) as string;
      const hedge = store.getHedge(id);
      if (!hedge) {
        res.status(404).json({ error: `Hedge execution not found: ${id}` });
        return;
      }
      res.json({ hedge });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get recent daemon logs
  app.get('/api/logs', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string || '100', 10);
      const logs = getRecentLogs(limit);
      res.json({ logs, count: logs.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Get active DreamDEX binary markets
  app.get('/api/markets', async (_req: Request, res: Response) => {
    try {
      const markets = await dreamdex.getActiveMarkets();
      res.json({ markets, mode: dreamdex.getMode() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Simulate Market Crash endpoint
  app.post('/api/simulate-crash', async (req: Request, res: Response) => {
    try {
      const { dropPercent, newPrice } = req.body;
      const currentPrice = store.getSimulatedEthPrice();
      let targetPrice: number;

      if (typeof newPrice === 'number' && newPrice > 0) {
        targetPrice = newPrice;
      } else if (typeof dropPercent === 'number') {
        targetPrice = currentPrice * (1.0 - dropPercent / 100.0);
      } else {
        // Default 25% drop from $3000 to $2250 (which drops HF ~1.67 down to ~1.25)
        targetPrice = currentPrice * 0.75;
      }

      targetPrice = Math.max(100.0, Math.round(targetPrice * 100) / 100);
      logger.warn(`[API] ⚠️ SIMULATE CRASH triggered: ETH Price dropping from $${currentPrice.toFixed(2)} -> $${targetPrice.toFixed(2)} (-${(((currentPrice - targetPrice) / currentPrice) * 100).toFixed(1)}%)`);

      // Update store price
      store.setSimulatedEthPrice(targetPrice);

      // If price oracle contract is deployed on Somnia, update it on-chain as well
      const isOracleLive = await isContractDeployed(config.contracts.priceOracleAddress);
      let onChainTxHash: string | undefined;

      if (isOracleLive) {
        try {
          // Chainlink 8 decimals: $2000 -> 200000000000
          const priceUnits = parseUnits(targetPrice.toFixed(8), 8);
          const hash = await withRetry(async () => {
            return await walletClient.writeContract({
              address: config.contracts.priceOracleAddress,
              abi: MockPriceOracleABI,
              functionName: 'setPrice',
              args: [priceUnits],
            });
          }, 2, 500, 'setPrice');

          onChainTxHash = hash;
          logger.info(`[API] Oracle price updated on-chain: tx=${hash}`);
        } catch (contractErr) {
          logger.warn(`[API] Could not update oracle on-chain: ${contractErr instanceof Error ? contractErr.message : String(contractErr)}`);
        }
      }

      // Trigger immediate monitor check across all vaults
      await monitor.checkAllVaults();

      res.json({
        success: true,
        message: `Simulated price crash applied: $${currentPrice.toFixed(2)} -> $${targetPrice.toFixed(2)}`,
        previousPrice: currentPrice,
        newPrice: targetPrice,
        dropPercent: Math.round(((currentPrice - targetPrice) / currentPrice) * 10000) / 100,
        onChainTxHash,
        vaults: store.getAllVaults(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Manually trigger protection hedge
  app.post('/api/simulate-hedge', async (req: Request, res: Response) => {
    try {
      const { userAddress, hedgeSizeUSDC } = req.body;
      const targetUser = (userAddress && typeof userAddress === 'string')
        ? userAddress
        : (store.getAllVaults()[0]?.userAddress || '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');

      logger.info(`[API] Manual protection hedge requested for user ${targetUser}`);
      const execution = await executor.executeHedgeManually(targetUser, hedgeSizeUSDC);

      res.json({
        success: true,
        message: `Hedge executed successfully for ${targetUser}`,
        execution,
        vault: store.getVault(targetUser),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Reset simulation state
  app.post('/api/reset', async (_req: Request, res: Response) => {
    try {
      const defaultPrice = 2000.0;
      store.setSimulatedEthPrice(defaultPrice);

      // Reset watched vaults to initial healthy state
      const vaults = store.getAllVaults();
      for (const v of vaults) {
        store.upsertVault({
          ...v,
          collateralWETH: v.collateralWETH, // keep actual on-chain collateral
          debtUSDC: v.debtUSDC,              // keep actual on-chain debt
          healthFactor: 1.78,
          isProtected: false,
          status: 'HEALTHY',
          lastCheckedAt: Date.now(),
          lastPriceETH: defaultPrice,
        });
      }

      // Update on-chain oracle if deployed
      const isOracleLive = await isContractDeployed(config.contracts.priceOracleAddress);
      if (isOracleLive) {
        try {
          const priceUnits = parseUnits(defaultPrice.toFixed(8), 8);
          await walletClient.writeContract({
            address: config.contracts.priceOracleAddress,
            abi: MockPriceOracleABI,
            functionName: 'setPrice',
            args: [priceUnits],
          });
        } catch {
          // ignore contract error during reset
        }

        // Reset on-chain vault HedgeStatus to Idle (0) for all watched users
        // so future crash simulations can trigger new hedges
        const isVaultLive = await isContractDeployed(config.contracts.vaultAddress);
        if (isVaultLive) {
          for (const v of vaults) {
            try {
              await withRetry(async () => {
                return await walletClient.writeContract({
                  address: config.contracts.vaultAddress,
                  abi: LiquiGuardVaultABI,
                  functionName: 'setHedgeStatus',
                  args: [v.userAddress as `0x${string}`, 0], // 0 = Idle
                });
              }, 2, 500, `setHedgeStatus(${v.userAddress}, Idle)`);
              logger.info(`[API] Reset: cleared on-chain HedgeStatus to Idle for ${v.userAddress}`);
            } catch (err) {
              logger.warn(`[API] Reset: could not clear HedgeStatus for ${v.userAddress}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }

      // Trigger a fresh vault check to read actual on-chain state after reset
      await monitor.checkAllVaults();

      logger.info('[API] Simulation state reset to default ($2000 ETH, protection cleared)');
      res.json({
        success: true,
        message: 'Simulation state reset to default healthy parameters ($2,000 ETH, protection cleared)',
        price: defaultPrice,
        vaults: store.getAllVaults(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Faucet — mint WETH + tUSDC using deployer key (no gas needed from user) ──
  app.post('/api/faucet', async (req: Request, res: Response) => {
    try {
      const { address } = req.body;
      if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
        res.status(400).json({ error: 'Valid Ethereum address required in body.address' });
        return;
      }

      const userAddr = address as `0x${string}`;
      const results: Record<string, string | undefined> = {};

      // Mint 10 WETH
      try {
        const wethHash = await withRetry(async () =>
          walletClient.writeContract({
            address: config.contracts.wethAddress,
            abi: MockERC20ABI,
            functionName: 'mint',
            args: [userAddr, parseUnits('10', 18)],
          }), 2, 500, 'mintWETH');
        results.wethTxHash = wethHash;
        logger.info(`[API] Faucet: minted 10 WETH to ${address} — tx=${wethHash}`);
      } catch (e) {
        results.wethError = e instanceof Error ? e.message : String(e);
        logger.warn(`[API] Faucet WETH mint failed: ${results.wethError}`);
      }

      // Mint 10,000 tUSDC
      try {
        const tusdcHash = await withRetry(async () =>
          walletClient.writeContract({
            address: config.contracts.tusdcAddress,
            abi: MockERC20ABI,
            functionName: 'mint',
            args: [userAddr, parseUnits('10000', 6)],
          }), 2, 500, 'mintTUSDC');
        results.tusdcTxHash = tusdcHash;
        logger.info(`[API] Faucet: minted 10,000 tUSDC to ${address} — tx=${tusdcHash}`);
      } catch (e) {
        results.tusdcError = e instanceof Error ? e.message : String(e);
        logger.warn(`[API] Faucet tUSDC mint failed: ${results.tusdcError}`);
      }

      res.json({
        success: !results.wethError && !results.tusdcError,
        message: `Faucet dispatched for ${address}`,
        minted: { weth: '10', tusdc: '10000' },
        ...results,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
}
