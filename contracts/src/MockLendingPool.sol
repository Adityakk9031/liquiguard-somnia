// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockPriceOracle} from "./MockPriceOracle.sol";
import {MockERC20} from "./MockERC20.sol";

/**
 * @title MockLendingPool
 * @notice Simplified Aave V2-style lending pool for WETH collateral and tUSDC borrow positions.
 * @dev Interacts with MockPriceOracle to compute collateral value and health factors.
 */
contract MockLendingPool {
    // --- Constants ---
    uint256 public constant LIQUIDATION_THRESHOLD = 8000; // 80.00% (basis points)
    uint256 public constant LTV = 7500; // 75.00% max borrow LTV (basis points)
    uint256 public constant PERCENTAGE_FACTOR = 10000;
    uint256 public constant PRECISION = 1e18;

    // --- Immutables ---
    MockPriceOracle public immutable oracle;
    MockERC20 public immutable weth;
    MockERC20 public immutable tUSDC;

    // --- State Variables ---
    mapping(address => uint256) public userCollateral; // WETH in 18 decimals
    mapping(address => uint256) public userDebt; // tUSDC in 6 decimals

    // --- Events ---
    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);

    // --- Errors ---
    error ZeroAddress();
    error ZeroAmount();
    error UnsupportedAsset(address asset);
    error InsufficientCollateral(uint256 available, uint256 required);
    error InsufficientDebt(uint256 available, uint256 required);
    error ExceedsMaxLtv(uint256 requestedDebtUSD, uint256 maxBorrowUSD);
    error UnsafeHealthFactor(uint256 healthFactor, uint256 minimumHealthFactor);
    error TransferFailed();

    /**
     * @notice Initializes the lending pool with oracle, WETH, and tUSDC contract references.
     * @param _oracle Address of MockPriceOracle.
     * @param _weth Address of MockERC20 WETH.
     * @param _tUSDC Address of MockERC20 tUSDC.
     */
    constructor(address _oracle, address _weth, address _tUSDC) {
        if (_oracle == address(0) || _weth == address(0) || _tUSDC == address(0)) revert ZeroAddress();
        oracle = MockPriceOracle(_oracle);
        weth = MockERC20(_weth);
        tUSDC = MockERC20(_tUSDC);
    }

    /**
     * @notice Supplies collateral asset into the lending pool.
     * @param asset Address of asset to supply (must be WETH).
     * @param amount Amount to deposit (18 decimals).
     */
    function supply(address asset, uint256 amount) external {
        _supply(asset, amount, msg.sender);
    }

    /**
     * @notice Supplies collateral asset on behalf of a specific user.
     * @param asset Address of asset to supply (must be WETH).
     * @param amount Amount to deposit (18 decimals).
     * @param onBehalfOf Beneficiary address credited with the collateral.
     */
    function supply(address asset, uint256 amount, address onBehalfOf) external {
        _supply(asset, amount, onBehalfOf);
    }

    /**
     * @notice Borrows debt asset against user collateral.
     * @param asset Address of asset to borrow (must be tUSDC).
     * @param amount Amount of tUSDC to borrow (6 decimals).
     */
    function borrow(address asset, uint256 amount) external {
        if (asset != address(tUSDC)) revert UnsupportedAsset(asset);
        if (amount == 0) revert ZeroAmount();

        uint256 currentDebt = userDebt[msg.sender];
        uint256 newDebt = currentDebt + amount;
        uint256 newDebtUSD = newDebt * 1e12; // 6 decimals -> 18 decimals USD

        (uint256 totalCollateralUSD, , , , , ) = getUserAccountData(msg.sender);
        uint256 maxBorrowUSD = (totalCollateralUSD * LTV) / PERCENTAGE_FACTOR;

        if (newDebtUSD > maxBorrowUSD) {
            revert ExceedsMaxLtv(newDebtUSD, maxBorrowUSD);
        }

        userDebt[msg.sender] = newDebt;
        emit Borrow(msg.sender, asset, amount);

        // Ensure pool has sufficient liquidity (mint if needed in test environment)
        if (tUSDC.balanceOf(address(this)) < amount) {
            tUSDC.mint(address(this), amount);
        }

        bool success = tUSDC.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Repays borrowed debt asset.
     * @param asset Address of debt asset (must be tUSDC).
     * @param amount Amount of tUSDC to repay (6 decimals).
     * @return actualRepaid Amount of debt actually repaid.
     */
    function repay(address asset, uint256 amount) external returns (uint256 actualRepaid) {
        return _repay(asset, amount, msg.sender);
    }

    /**
     * @notice Repays borrowed debt asset on behalf of a specific user.
     * @param asset Address of debt asset (must be tUSDC).
     * @param amount Amount of tUSDC to repay (6 decimals).
     * @param onBehalfOf Address of user whose debt is being repaid.
     * @return actualRepaid Amount of debt actually repaid.
     */
    function repay(address asset, uint256 amount, address onBehalfOf) external returns (uint256 actualRepaid) {
        return _repay(asset, amount, onBehalfOf);
    }

    /**
     * @notice Withdraws collateral asset.
     * @param asset Address of collateral asset (must be WETH).
     * @param amount Amount to withdraw (18 decimals).
     * @return actualWithdrawn Amount of collateral withdrawn.
     */
    function withdraw(address asset, uint256 amount) external returns (uint256 actualWithdrawn) {
        return _withdraw(asset, amount, msg.sender, msg.sender);
    }

    /**
     * @notice Withdraws collateral asset to a designated recipient.
     * @param asset Address of collateral asset (must be WETH).
     * @param amount Amount to withdraw (18 decimals).
     * @param to Recipient address for withdrawn collateral.
     * @return actualWithdrawn Amount of collateral withdrawn.
     */
    function withdraw(address asset, uint256 amount, address to) external returns (uint256 actualWithdrawn) {
        return _withdraw(asset, amount, msg.sender, to);
    }

    /**
     * @notice Returns comprehensive account data for a user in USD with 18 decimals.
     * @param user Address of user.
     * @return totalCollateralUSD Total collateral value in USD (18 decimals).
     * @return totalDebtUSD Total borrowed debt in USD (18 decimals).
     * @return availableBorrowsUSD Remaining borrow capacity in USD (18 decimals).
     * @return currentLiquidationThreshold Liquidation threshold in bps (8000 = 80%).
     * @return ltv Loan-To-Value in bps (7500 = 75%).
     * @return healthFactor Health factor scaled to 1e18 (1.0 = 1e18).
     */
    function getUserAccountData(address user)
        public
        view
        returns (
            uint256 totalCollateralUSD,
            uint256 totalDebtUSD,
            uint256 availableBorrowsUSD,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        uint256 collateralAmount = userCollateral[user];
        (uint256 ethPrice, ) = oracle.getLatestPrice(); // 8 decimals

        // Collateral USD: WETH (18 dec) * Price (8 dec) / 1e8 = 18 decimals USD
        totalCollateralUSD = (collateralAmount * ethPrice) / 1e8;

        // Debt USD: tUSDC (6 dec) * 1e12 = 18 decimals USD ($1.00 peg)
        uint256 debtAmount = userDebt[user];
        totalDebtUSD = debtAmount * 1e12;

        currentLiquidationThreshold = LIQUIDATION_THRESHOLD;
        ltv = LTV;

        uint256 maxBorrowUSD = (totalCollateralUSD * LTV) / PERCENTAGE_FACTOR;
        availableBorrowsUSD = maxBorrowUSD > totalDebtUSD ? (maxBorrowUSD - totalDebtUSD) : 0;

        if (debtAmount == 0) {
            healthFactor = type(uint256).max;
        } else {
            // (collateralAmount * ethPrice * LIQUIDATION_THRESHOLD) / (debtAmount * PERCENTAGE_FACTOR * 100)
            healthFactor = (collateralAmount * ethPrice * LIQUIDATION_THRESHOLD) / (debtAmount * PERCENTAGE_FACTOR * 100);
        }
    }

    // --- Internal Functions ---

    function _supply(address asset, uint256 amount, address onBehalfOf) internal {
        if (asset != address(weth)) revert UnsupportedAsset(asset);
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        bool success = weth.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        userCollateral[onBehalfOf] += amount;
        emit Supply(onBehalfOf, asset, amount);
    }

    function _repay(address asset, uint256 amount, address onBehalfOf) internal returns (uint256) {
        if (asset != address(tUSDC)) revert UnsupportedAsset(asset);
        if (amount == 0) revert ZeroAmount();
        if (onBehalfOf == address(0)) revert ZeroAddress();

        uint256 currentDebt = userDebt[onBehalfOf];
        if (currentDebt == 0) revert InsufficientDebt(0, amount);

        uint256 repayAmount = amount > currentDebt ? currentDebt : amount;

        bool success = tUSDC.transferFrom(msg.sender, address(this), repayAmount);
        if (!success) revert TransferFailed();

        userDebt[onBehalfOf] = currentDebt - repayAmount;
        emit Repay(onBehalfOf, asset, repayAmount);

        return repayAmount;
    }

    function _withdraw(address asset, uint256 amount, address user, address to) internal returns (uint256) {
        if (asset != address(weth)) revert UnsupportedAsset(asset);
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 currentCollateral = userCollateral[user];
        if (currentCollateral < amount) revert InsufficientCollateral(currentCollateral, amount);

        uint256 remainingCollateral = currentCollateral - amount;
        uint256 debt = userDebt[user];

        if (debt > 0) {
            (uint256 ethPrice, ) = oracle.getLatestPrice();
            uint256 newHF = (remainingCollateral * ethPrice * LIQUIDATION_THRESHOLD) / (debt * PERCENTAGE_FACTOR * 100);
            if (newHF < 1.05e18) {
                revert UnsafeHealthFactor(newHF, 1.05e18);
            }
        }

        userCollateral[user] = remainingCollateral;
        emit Withdraw(user, asset, amount);

        bool success = weth.transfer(to, amount);
        if (!success) revert TransferFailed();

        return amount;
    }
}
