import { Address } from 'viem';

// ─── Contract Addresses ────────────────────────────────────────────────────
export const CONTRACT_ADDRESSES = {
  vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
    '0x14b2bb3f8a25301d6ea944d571f0e7608d36c095') as Address,
  lendingPool: (process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS ||
    '0x96b90274a27d7c933816ae6eae9959b3be05d260') as Address,
  oracle: (process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS ||
    '0xDD2A460Bfe22BfA7c757A35F6d68813770d39712') as Address,
  weth: (process.env.NEXT_PUBLIC_WETH_ADDRESS ||
    '0x36971ac6e98aafde5c0e2ee8d55abd6c45db8283') as Address,
  usdc: (process.env.NEXT_PUBLIC_TUSDC_ADDRESS ||
    '0x734a4b4d43aec0d7d58e3bae6e7b4a8fa253fd5e') as Address,
};

// ─── LiquiGuardVault ABI (matches deployed LiquiGuardVault.sol exactly) ─────
// Functions: depositCollateral, borrowDebt, depositAndBorrow, repayDebt,
//            withdrawCollateral, executeProtectionHedge, getHealthFactor,
//            getVaultState, vaultStates (public mapping)
export const LIQUIGUARD_VAULT_ABI = [
  // ── User Actions ──────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'depositCollateral',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'borrowDebt',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositAndBorrow',
    inputs: [
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'borrowAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repayDebt',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawCollateral',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ── Operator Actions ──────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'executeProtectionHedge',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'payoutAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setHedgeStatus',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'status', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ── View Functions ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getHealthFactor',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    // Returns VaultState struct:
    // { depositedCollateral, borrowedDebt, status (HedgeStatus), lastHedgePayout, lastHealthFactor }
    type: 'function',
    name: 'getVaultState',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'depositedCollateral', type: 'uint256' },
          { name: 'borrowedDebt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'lastHedgePayout', type: 'uint256' },
          { name: 'lastHealthFactor', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    // Public mapping: vaultStates[user]
    type: 'function',
    name: 'vaultStates',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'depositedCollateral', type: 'uint256' },
      { name: 'borrowedDebt', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'lastHedgePayout', type: 'uint256' },
      { name: 'lastHealthFactor', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'weth',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tUSDC',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'oracle',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lendingPool',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'operator',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'CollateralDeposited',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DebtBorrowed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CollateralWithdrawn',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DebtRepaid',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'HedgeExecuted',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'payoutAmount', type: 'uint256', indexed: false },
      { name: 'newHealthFactor', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'HedgeStatusUpdated',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'status', type: 'uint8', indexed: false },
    ],
    anonymous: false,
  },
  // ── Custom Errors ─────────────────────────────────────────────────────────
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'InsufficientCollateral', inputs: [] },
  { type: 'error', name: 'InsufficientDebt', inputs: [] },
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },
  {
    type: 'error',
    name: 'UnsafeHealthFactor',
    inputs: [
      { name: 'currentHealthFactor', type: 'uint256' },
      { name: 'requiredHealthFactor', type: 'uint256' },
    ],
  },
] as const;

// ─── MockPriceOracle ABI (matches deployed MockPriceOracle.sol exactly) ──────
// Functions: getLatestPrice → (uint256 price, uint256 timestamp)
//            setPrice(uint256)  — Chainlink 8-decimal units, public for demo simulation
//            decimals() → 8
export const MOCK_PRICE_ORACLE_ABI = [
  {
    type: 'function',
    name: 'getLatestPrice',
    inputs: [],
    outputs: [
      { name: 'price', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setPrice',
    inputs: [{ name: 'newPrice', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'pure',
  },
] as const;


// ─── MockLendingPool ABI (matches deployed MockLendingPool.sol) ───────────
export const MOCK_LENDING_POOL_ABI = [
  {
    type: 'function',
    name: 'supply',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'borrow',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repay',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getUserAccountData',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'totalCollateralUSD', type: 'uint256' },
      { name: 'totalDebtUSD', type: 'uint256' },
      { name: 'availableBorrowsUSD', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'userCollateral',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'userDebt',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ─── ERC20 ABI (MockERC20 — WETH 18 dec, tUSDC 6 dec) ────────────────────
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const;
