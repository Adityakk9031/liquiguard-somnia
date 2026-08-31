// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {HedgeStatus, VaultState} from "../LiquiGuardTypes.sol";

/**
 * @title ILiquiGuardVault
 * @notice Interface for the LiquiGuard micro-hedging collateral vault.
 */
interface ILiquiGuardVault {
    // --- Events ---
    event CollateralDeposited(address indexed user, uint256 amount);
    event DebtBorrowed(address indexed user, uint256 amount);
    event DebtRepaid(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event HedgeExecuted(address indexed user, uint256 payoutAmount, uint256 newHealthFactor);
    event HedgeStatusUpdated(address indexed user, HedgeStatus status);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- Custom Errors ---
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientCollateral();
    error InsufficientDebt();
    error UnsafeHealthFactor(uint256 currentHealthFactor, uint256 requiredHealthFactor);
    error Unauthorized();
    error TransferFailed();

    // --- User Actions ---
    function depositCollateral(uint256 amount) external;
    function borrowDebt(uint256 amount) external;
    function depositAndBorrow(uint256 collateralAmount, uint256 borrowAmount) external;
    function repayDebt(uint256 amount) external;
    function withdrawCollateral(uint256 amount) external;

    // --- Operator / Admin Actions ---
    function executeProtectionHedge(address user, uint256 payoutAmount) external;
    function setHedgeStatus(address user, HedgeStatus status) external;
    function setOperator(address _operator) external;
    function transferOwnership(address newOwner) external;

    // --- View Functions ---
    function getHealthFactor(address user) external view returns (uint256);
    function getVaultState(address user) external view returns (VaultState memory);
    function weth() external view returns (address);
    function tUSDC() external view returns (address);
    function lendingPool() external view returns (address);
    function oracle() external view returns (address);
    function operator() external view returns (address);
    function owner() external view returns (address);
}
