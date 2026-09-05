import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search for .env files in order of precedence: local daemon .env, root .env
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export interface Config {
  port: number;
  rpcUrl: string;
  wsUrl: string;
  chainId: number;
  privateKey: `0x${string}`;
  contracts: {
    vaultAddress: `0x${string}`;
    lendingPoolAddress: `0x${string}`;
    priceOracleAddress: `0x${string}`;
    wethAddress: `0x${string}`;
    tusdcAddress: `0x${string}`;
  };
  thresholds: {
    hedgeTriggerHf: number;
    targetHf: number;
    pollIntervalMs: number;
  };
  dreamdex: {
    mode: 'mock' | 'live';
    indexerUrl: string;
    wsUrl: string;
    defaultMarketId: string;
    entryPrice: number;
    strikePrice: number;
    strikeOffsetPercent: number;
    simulatedSettlementDelayMs: number;
  };
  logLevel: string;
}

// Fallback dummy private key (Foundry dev key #0) if none provided in environment
const DEFAULT_DEV_KEY: `0x${string}` = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Default zero address placeholder
const ZERO_ADDRESS: `0x${string}` = '0x0000000000000000000000000000000000000000';

function formatAddress(addr?: string): `0x${string}` {
  if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
    return ZERO_ADDRESS;
  }
  return addr as `0x${string}`;
}

function formatPrivateKey(key?: string): `0x${string}` {
  if (!key) return DEFAULT_DEV_KEY;
  const clean = key.startsWith('0x') ? key : `0x${key}`;
  if (clean.length === 66) {
    return clean as `0x${string}`;
  }
  return DEFAULT_DEV_KEY;
}

export const config: Config = {
  port: Number(process.env.DAEMON_PORT || process.env.PORT || 3001),
  rpcUrl: process.env.SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network',
  wsUrl: process.env.SOMNIA_WS_URL || 'wss://api.infra.testnet.somnia.network/ws',
  chainId: Number(process.env.SOMNIA_CHAIN_ID || 50312),
  privateKey: formatPrivateKey(process.env.PRIVATE_KEY),
  contracts: {
    vaultAddress: formatAddress(process.env.VAULT_ADDRESS),
    lendingPoolAddress: formatAddress(process.env.LENDING_POOL_ADDRESS),
    priceOracleAddress: formatAddress(process.env.PRICE_ORACLE_ADDRESS),
    wethAddress: formatAddress(process.env.WETH_ADDRESS),
    tusdcAddress: formatAddress(process.env.TUSDC_ADDRESS),
  },
  thresholds: {
    hedgeTriggerHf: parseFloat(process.env.HEDGE_TRIGGER_HF || '1.30'),
    targetHf: parseFloat(process.env.TARGET_HF || '1.50'),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
  },
  dreamdex: {
    mode: (process.env.DREAMDEX_MODE === 'live' ? 'live' : 'mock') as 'mock' | 'live',
    indexerUrl: process.env.DREAMDEX_INDEXER_URL || 'https://dev.smk.somnia.host/v1/graphql',
    wsUrl: process.env.DREAMDEX_WS_URL || 'wss://api.infra.testnet.somnia.network/ws',
    defaultMarketId: process.env.DREAMDEX_MARKET_ID || 'ETH-USD-15M-DOWN',
    entryPrice: parseFloat(process.env.DREAMDEX_ENTRY_PRICE || '0.40'),
    strikePrice: parseFloat(process.env.DREAMDEX_STRIKE_PRICE || '2000.0'),
    strikeOffsetPercent: parseFloat(process.env.DREAMDEX_STRIKE_OFFSET || '0.05'),
    simulatedSettlementDelayMs: parseInt(process.env.DREAMDEX_SETTLE_DELAY_MS || '1000', 10),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
