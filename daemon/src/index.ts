import { createServer } from 'http';
import { config } from './config.js';
import { logger } from './logger.js';
import { dreamdex } from './dreamdex.js';
import { monitor } from './monitor.js';
import { executor } from './executor.js';
import { createApiServer } from './api.js';

async function main(): Promise<void> {
  console.log(`
  ==================================================================
  🛡️   LIQUIGUARD SENTINEL DAEMON — SOMNIA SHANNON TESTNET
  ==================================================================
  Chain ID:          ${config.chainId}
  RPC URL:           ${config.rpcUrl}
  Hedge Trigger HF:  < ${config.thresholds.hedgeTriggerHf}
  Target HF:         ${config.thresholds.targetHf}
  Poll Interval:     ${config.thresholds.pollIntervalMs}ms
  DreamDEX Mode:     ${config.dreamdex.mode.toUpperCase()}
  Port:              ${config.port}
  ==================================================================
  `);

  logger.info('[Main] Starting LiquiGuard Sentinel Daemon...');

  // 1. Initialize DreamDEX client
  await dreamdex.initialize();

  // 2. Attach Executor to Monitor risk events
  executor.attachToMonitor(monitor);

  // 3. Start Health Factor Monitor
  await monitor.start();

  // 4. Start REST API Server
  const app = createApiServer();
  const server = createServer(app);

  server.listen(config.port, () => {
    logger.info(`[API] Sentinel API server listening on http://localhost:${config.port}`);
    logger.info(`[API] Health status endpoint: http://localhost:${config.port}/api/status`);
    logger.info(`[API] Monitored vaults endpoint: http://localhost:${config.port}/api/vaults`);
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[Main] Received ${signal}. Initiating graceful shutdown...`);
    monitor.stop();

    server.close(() => {
      logger.info('[Main] HTTP server closed.');
      process.exit(0);
    });

    // Force exit if hanging
    setTimeout(() => {
      logger.error('[Main] Forced shutdown after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`[Main] Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  });

  process.on('uncaughtException', (err) => {
    logger.error(`[Main] Uncaught exception: ${err.message}`, { stack: err.stack });
  });
}


main().catch((err) => {
  logger.error(`[Main] Fatal daemon error: ${err instanceof Error ? err.message : String(err)}`, { stack: err instanceof Error ? err.stack : undefined });
  process.exit(1);
});
