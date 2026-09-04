import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  defineChain,
  parseAbi,
  formatUnits,
  parseUnits,
  formatEther,
  parseEther,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from './config.js';
import { logger } from './logger.js';

// Define Somnia Shannon Testnet chain
export const somniaShannon = defineChain({
  id: config.chainId,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: {
    name: 'Somnia Test Token',
    symbol: 'STT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.rpcUrl],
      webSocket: [config.wsUrl],
    },
    public: {
      http: [config.rpcUrl],
      webSocket: [config.wsUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
  testnet: true,
});

// Create Public Client
export const publicClient = createPublicClient({
  chain: somniaShannon,
  transport: http(config.rpcUrl, {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 15_000,
  }),
});

// Create Account & Wallet Client
export const relayerAccount = privateKeyToAccount(config.privateKey);

export const walletClient = createWalletClient({
  account: relayerAccount,
  chain: somniaShannon,
  transport: http(config.rpcUrl, {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 15_000,
  }),
});

// ABIs matching deployed Solidity contracts
export const LiquiGuardVaultABI = parseAbi([
  'function getHealthFactor(address user) external view returns (uint256)',
  'function getVaultState(address user) external view returns ((uint256 depositedCollateral, uint256 borrowedDebt, uint8 status, uint256 lastHedgePayout, uint256 lastHealthFactor))',
  'function depositCollateral(uint256 amount) external',
  'function withdrawCollateral(uint256 amount) external',
  'function depositAndBorrow(uint256 collateralAmount, uint256 borrowAmount) external',
  'function borrowDebt(uint256 amount) external',
  'function repayDebt(uint256 amount) external',
  'function executeProtectionHedge(address user, uint256 payoutAmount) external',
  'function setHedgeStatus(address user, uint8 status) external',
  'function setOperator(address _operator) external',
  'function weth() external view returns (address)',
  'function tUSDC() external view returns (address)',
  'function lendingPool() external view returns (address)',
  'function oracle() external view returns (address)',
  'function operator() external view returns (address)',
  'function owner() external view returns (address)',
  'event CollateralDeposited(address indexed user, uint256 amount)',
  'event DebtBorrowed(address indexed user, uint256 amount)',
  'event DebtRepaid(address indexed user, uint256 amount)',
  'event CollateralWithdrawn(address indexed user, uint256 amount)',
  'event HedgeExecuted(address indexed user, uint256 payoutAmount, uint256 newHealthFactor)',
  'event HedgeStatusUpdated(address indexed user, uint8 status)',
]);

export const MockLendingPoolABI = parseAbi([
  'function supply(address asset, uint256 amount) external',
  'function borrow(address asset, uint256 amount) external',
  'function repay(address asset, uint256 amount) external returns (uint256)',
  'function withdraw(address asset, uint256 amount) external returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralUSD, uint256 totalDebtUSD, uint256 availableBorrowsUSD, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function userCollateral(address user) external view returns (uint256)',
  'function userDebt(address user) external view returns (uint256)',
]);

export const MockPriceOracleABI = parseAbi([
  'function getLatestPrice() external view returns (uint256 price, uint256 timestamp)',
  'function setPrice(uint256 newPrice) external',
  'function decimals() external pure returns (uint8)',
]);

export const MockERC20ABI = parseAbi([
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function mint(address to, uint256 amount) external',
]);

// Utility functions
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
  operationName = 'RPC operation'
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      logger.warn(`[Chain] ${operationName} failed (attempt ${attempt}/${maxRetries}): ${err instanceof Error ? err.message : String(err)}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

export async function isContractDeployed(address: `0x${string}`): Promise<boolean> {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return false;
  }
  try {
    const bytecode = await publicClient.getBytecode({ address });
    return Boolean(bytecode && bytecode !== '0x');
  } catch (err) {
    logger.debug(`[Chain] Failed to check bytecode at ${address}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export {
  formatUnits,
  parseUnits,
  formatEther,
  parseEther,
};
