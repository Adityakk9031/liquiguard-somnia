// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ILiquiGuardVault} from "./interfaces/ILiquiGuardVault.sol";
import {HedgeStatus, VaultState} from "./LiquiGuardTypes.sol";
import {MockPriceOracle} from "./MockPriceOracle.sol";
import {MockLendingPool} from "./MockLendingPool.sol";
import {MockERC20} from "./MockERC20.sol";

/**
 * @title LiquiGuardVault
 * @notice Micro-hedging automated collateral vault.
 * @dev Manages user collateral (WETH) and borrowed debt (tUSDC) via MockLendingPool.
 * Enables automated micro-hedge payouts by authorized daemon operators to prevent liquidation.
 */
contract LiquiGuardVault is ILiquiGuardVault {
    // --- Constants ---
    uint256 public constant LIQUIDATION_THRESHOLD = 8000; // 80.00% (basis points)
    uint256 public constant MAX_BORROW_LTV = 7500; // 75.00% max borrow capacity (basis points)
    uint256 public constant PERCENTAGE_FACTOR = 10000;
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MIN_SAFE_HEALTH_FACTOR = 1.20e18; // 1.20 minimum HF for withdrawals

    // --- State Variables ---
    address public owner;
    address public operator;
    address public immutable override weth;
    address public immutable override tUSDC;
    address public immutable override lendingPool;
    address public immutable override oracle;

    mapping(address => VaultState) public vaultStates;

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner) revert Unauthorized();
        _;
    }

    /**
     * @notice Initializes the LiquiGuardVault contract.
     * @param _weth Address of MockERC20 WETH.
     * @param _tUSDC Address of MockERC20 tUSDC.
     * @param _lendingPool Address of MockLendingPool.
     * @param _oracle Address of MockPriceOracle.
     * @param _operator Address of automated hedging relayer/daemon.
     */
    constructor(
        address _weth,
        address _tUSDC,
        address _lendingPool,
        address _oracle,
        address _operator
    ) {
        if (
            _weth == address(0) ||
            _tUSDC == address(0) ||
            _lendingPool == address(0) ||
            _oracle == address(0) ||
            _operator == address(0)
        ) revert ZeroAddress();

        owner = msg.sender;
        operator = _operator;
        weth = _weth;
        tUSDC = _tUSDC;
        lendingPool = _lendingPool;
        oracle = _oracle;

        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorUpdated(address(0), _operator);
    }

    // =========================================================================
    // User Actions
    // =========================================================================

    /**
     * @notice Deposits WETH collateral into the vault and lending pool.
     * @param amount Amount of WETH to deposit (18 decimals).
     */
    function depositCollateral(uint256 amount) external override {
        _depositCollateral(msg.sender, amount);
    }

    /**
     * @notice Borrows tUSDC debt against deposited collateral.
     * @param amount Amount of tUSDC to borrow (6 decimals).
     */
    function borrowDebt(uint256 amount) external override {
        _borrowDebt(msg.sender, amount);
    }

    /**
     * @notice Atomically deposits WETH collateral and borrows tUSDC debt.
     * @param collateralAmount Amount of WETH to deposit (18 decimals).
     * @param borrowAmount Amount of tUSDC to borrow (6 decimals).
     */
    function depositAndBorrow(uint256 collateralAmount, uint256 borrowAmount) external override {
        if (collateralAmount > 0) {
            _depositCollateral(msg.sender, collateralAmount);
        }
        if (borrowAmount > 0) {
            _borrowDebt(msg.sender, borrowAmount);
        }
    }

    /**
     * @notice Repays borrowed tUSDC debt.
     * @param amount Amount of tUSDC to repay (6 decimals).
     */
    function repayDebt(uint256 amount) external override {
        if (amount == 0) revert ZeroAmount();

        VaultState storage state = vaultStates[msg.sender];
        uint256 currentDebt = state.borrowedDebt;
        if (currentDebt == 0) revert InsufficientDebt();

        uint256 repayAmount = amount > currentDebt ? currentDebt : amount;

        bool pullSuccess = MockERC20(tUSDC).transferFrom(msg.sender, address(this), repayAmount);
        if (!pullSuccess) revert TransferFailed();

        bool approveSuccess = MockERC20(tUSDC).approve(lendingPool, repayAmount);
        if (!approveSuccess) revert TransferFailed();

        MockLendingPool(lendingPool).repay(tUSDC, repayAmount);

        state.borrowedDebt = currentDebt - repayAmount;
        if (state.borrowedDebt == 0) {
            state.status = HedgeStatus.Idle;
        }

        uint256 newHF = getHealthFactor(msg.sender);
        state.lastHealthFactor = newHF;

        emit DebtRepaid(msg.sender, repayAmount);
    }

    /**
     * @notice Withdraws WETH collateral, validating resulting health factor safety.
     * @param amount Amount of WETH to withdraw (18 decimals).
     */
    function withdrawCollateral(uint256 amount) external override {
        if (amount == 0) revert ZeroAmount();

        VaultState storage state = vaultStates[msg.sender];
        if (state.depositedCollateral < amount) revert InsufficientCollateral();

        uint256 remainingCollateral = state.depositedCollateral - amount;

        if (state.borrowedDebt > 0) {
            if (remainingCollateral == 0) revert UnsafeHealthFactor(0, MIN_SAFE_HEALTH_FACTOR);

            (uint256 ethPrice, ) = MockPriceOracle(oracle).getLatestPrice();
            uint256 newHF = (remainingCollateral * ethPrice * LIQUIDATION_THRESHOLD) / (state.borrowedDebt * PERCENTAGE_FACTOR * 100);

            if (newHF < MIN_SAFE_HEALTH_FACTOR) {
                revert UnsafeHealthFactor(newHF, MIN_SAFE_HEALTH_FACTOR);
            }
        }

        state.depositedCollateral = remainingCollateral;

        MockLendingPool(lendingPool).withdraw(weth, amount);

        uint256 updatedHF = getHealthFactor(msg.sender);
        state.lastHealthFactor = updatedHF;
        emit CollateralWithdrawn(msg.sender, amount);

        bool success = MockERC20(weth).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
    }

    // =========================================================================
    // Operator / Daemon Actions
    // =========================================================================

    /**
     * @notice Executes a micro-hedge protection repayment for a user at risk of liquidation.
     * @dev Transfers tUSDC payout from operator/relayer, repays debt to MockLendingPool, and marks position Protected.
     * @param user Address of the user position receiving hedge payout.
     * @param payoutAmount Amount of tUSDC payout to apply towards debt (6 decimals).
     */
    function executeProtectionHedge(address user, uint256 payoutAmount) external override onlyOperator {
        if (user == address(0)) revert ZeroAddress();
        if (payoutAmount == 0) revert ZeroAmount();

        VaultState storage state = vaultStates[user];
        if (state.borrowedDebt == 0) revert InsufficientDebt();

        uint256 actualPayout = payoutAmount > state.borrowedDebt ? state.borrowedDebt : payoutAmount;

        // Pull tUSDC payout from operator
        bool pullSuccess = MockERC20(tUSDC).transferFrom(msg.sender, address(this), actualPayout);
        if (!pullSuccess) revert TransferFailed();

        // Repay debt into lending pool
        bool approveSuccess = MockERC20(tUSDC).approve(lendingPool, actualPayout);
        if (!approveSuccess) revert TransferFailed();

        MockLendingPool(lendingPool).repay(tUSDC, actualPayout);

        // Update user state
        state.borrowedDebt -= actualPayout;
        state.status = HedgeStatus.Protected;
        state.lastHedgePayout = actualPayout;

        uint256 newHF = getHealthFactor(user);
        state.lastHealthFactor = newHF;

        emit HedgeExecuted(user, actualPayout, newHF);
        emit HedgeStatusUpdated(user, HedgeStatus.Protected);
    }

    /**
     * @notice Updates the micro-hedge status of a user position.
     * @param user Address of the user.
     * @param status New HedgeStatus (Idle, Hedging, Protected).
     */
    function setHedgeStatus(address user, HedgeStatus status) external override onlyOperator {
        if (user == address(0)) revert ZeroAddress();
        vaultStates[user].status = status;
        emit HedgeStatusUpdated(user, status);
    }

    /**
     * @notice Updates the designated relayer/operator address.
     * @param _operator New operator address.
     */
    function setOperator(address _operator) external override onlyOwner {
        if (_operator == address(0)) revert ZeroAddress();
        address previousOperator = operator;
        operator = _operator;
        emit OperatorUpdated(previousOperator, _operator);
    }

    /**
     * @notice Transfers ownership of the vault contract.
     * @param newOwner Address of new owner.
     */
    function transferOwnership(address newOwner) external override onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Computes the current health factor for a user position.
     * @param user Address of user.
     * @return Current health factor scaled to 1e18 (1.0 = 1e18). Returns type(uint256).max if debt is 0.
     */
    function getHealthFactor(address user) public view override returns (uint256) {
        VaultState memory state = vaultStates[user];
        if (state.borrowedDebt == 0) {
            return type(uint256).max;
        }
        if (state.depositedCollateral == 0) {
            return 0;
        }

        (uint256 ethPrice, ) = MockPriceOracle(oracle).getLatestPrice(); // 8 decimals

        // HF = (collateralAmount * ethPrice * LIQUIDATION_THRESHOLD) / (debtAmount * PERCENTAGE_FACTOR * 100)
        return (state.depositedCollateral * ethPrice * LIQUIDATION_THRESHOLD) / (state.borrowedDebt * PERCENTAGE_FACTOR * 100);
    }

    /**
     * @notice Returns the full snapshot state of a user position.
     * @param user Address of user.
     * @return Snapshot struct containing collateral, debt, status, and health factor.
     */
    function getVaultState(address user) external view override returns (VaultState memory) {
        VaultState memory state = vaultStates[user];
        state.lastHealthFactor = getHealthFactor(user);
        return state;
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    function _depositCollateral(address user, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();

        bool pullSuccess = MockERC20(weth).transferFrom(user, address(this), amount);
        if (!pullSuccess) revert TransferFailed();

        bool approveSuccess = MockERC20(weth).approve(lendingPool, amount);
        if (!approveSuccess) revert TransferFailed();

        MockLendingPool(lendingPool).supply(weth, amount);

        VaultState storage state = vaultStates[user];
        state.depositedCollateral += amount;
        state.status = HedgeStatus.Idle;
        state.lastHealthFactor = getHealthFactor(user);

        emit CollateralDeposited(user, amount);
    }

    function _borrowDebt(address user, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();

        VaultState storage state = vaultStates[user];
        if (state.depositedCollateral == 0) revert InsufficientCollateral();

        uint256 newDebt = state.borrowedDebt + amount;
        (uint256 ethPrice, ) = MockPriceOracle(oracle).getLatestPrice();
        uint256 maxBorrowUSD = (state.depositedCollateral * ethPrice * MAX_BORROW_LTV) / (PERCENTAGE_FACTOR * 1e8);
        uint256 newDebtUSD = newDebt * 1e12;

        if (newDebtUSD > maxBorrowUSD) {
            revert UnsafeHealthFactor(0, 1e18);
        }

        MockLendingPool(lendingPool).borrow(tUSDC, amount);

        state.borrowedDebt = newDebt;
        state.lastHealthFactor = getHealthFactor(user);
        emit DebtBorrowed(user, amount);

        bool success = MockERC20(tUSDC).transfer(user, amount);
        if (!success) revert TransferFailed();
    }
}
