// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @notice Status of the micro-hedge protection for a user's vault position.
 * @dev
 * - Idle: Normal operations, health factor is healthy (above the monitoring trigger threshold).
 * - Hedging: Price drop detected, position is currently active in hedging or awaiting resolution.
 * - Protected: Micro-hedge payout executed and debt repaid, restoring position to target safety.
 */
enum HedgeStatus {
    Idle,
    Hedging,
    Protected
}

/**
 * @notice Snapshot state of a user's vault position.
 * @param depositedCollateral Total amount of WETH deposited by the user as collateral (18 decimals).
 * @param borrowedDebt Total amount of tUSDC debt borrowed by the user (6 decimals).
 * @param status Current micro-hedge protection status.
 * @param lastHedgePayout Amount of tUSDC repaid during the last hedge execution (6 decimals).
 * @param lastHealthFactor Cached health factor from the last state update (18 decimals precision).
 */
struct VaultState {
    uint256 depositedCollateral;
    uint256 borrowedDebt;
    HedgeStatus status;
    uint256 lastHedgePayout;
    uint256 lastHealthFactor;
}
