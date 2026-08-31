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

// ABIs
export const LiquiGuardVaultABI = parseAbi([
  'function getHealthFactor(address user) external view returns (uint256)',
  'function getUserPosition(address user) external view returns (uint256 collateralWETH, uint256 debtUSDC, uint256 healthFactor, bool isProtected)',
  'function calculateRequiredHedge(address user, uint256 targetHealthFactor) external view returns (uint256 hedgeAmountUSDC)',
  'function executeProtectionHedge(address user, uint256 payoutAmount) external',
  'function deposit(uint256 amount) external',
  'function withdraw(uint256 amount) external',
  'function getActiveUsers() external view returns (address[])',
  'function getActiveUserCount() external view returns (uint256)',
  'function activeUsers(uint256 index) external view returns (address)',
  'function isUserActive(address user) external view returns (bool)',
  'function targetHealthFactor() external view returns (uint256)',
  'function hedgeTriggerThreshold() external view returns (uint256)',
  'function lendingPool() external view returns (address)',
  'function priceOracle() external view returns (address)',
  'function weth() external view returns (address)',
  'function tusdc() external view returns (address)',
  'function operator() external view returns (address)',
  'event ProtectionExecuted(address indexed user, uint256 debtRepaid, uint256 newHealthFactor)',
  'event Deposit(address indexed user, uint256 amountWETH, uint256 borrowedUSDC)',
  'event Withdraw(address indexed user, uint256 amountWETH)',
  'event HedgeTriggered(address indexed user, uint256 healthFactor, uint256 requiredHedge)'
]);

export const MockLendingPoolABI = parseAbi([
  'function getHealthFactor(address user) external view returns (uint256)',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256)',
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  'function setUserPosition(address user, uint256 collateralBase, uint256 debtBase) external'
]);

export const MockPriceOracleABI = parseAbi([
  'function getAssetPrice(address asset) external view returns (uint256)',
  'function setAssetPrice(address asset, uint256 price) external',
  'function getETHPrice() external view returns (uint256)',
  'function setETHPrice(uint256 price) external'
]);

export const MockERC20ABI = parseAbi([
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function mint(address to, uint256 amount) external'
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
