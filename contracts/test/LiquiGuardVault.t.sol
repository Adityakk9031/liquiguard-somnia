// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {LiquiGuardVault} from "../src/LiquiGuardVault.sol";
import {ILiquiGuardVault} from "../src/interfaces/ILiquiGuardVault.sol";
import {MockLendingPool} from "../src/MockLendingPool.sol";
import {MockPriceOracle} from "../src/MockPriceOracle.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {HedgeStatus, VaultState} from "../src/LiquiGuardTypes.sol";

/**
 * @title LiquiGuardVaultTest
 * @notice Comprehensive unit and integration test suite for LiquiGuardVault and MockLendingPool.
 */
contract LiquiGuardVaultTest is Test {
    LiquiGuardVault public vault;
    MockLendingPool public lendingPool;
    MockPriceOracle public oracle;
    MockERC20 public weth;
    MockERC20 public tUSDC;

    address public owner = address(this);
    address public operator = address(0x2002);
    address public user = address(0x1001);
    address public nonOperator = address(0x9999);

    uint256 public constant INITIAL_ETH_PRICE = 2000 * 1e8; // $2000 (8 decimals)
    uint256 public constant INITIAL_WETH_DEPOSIT = 1 ether; // 1 WETH
    uint256 public constant INITIAL_BORROW_AMOUNT = 1000 * 1e6; // $1000 tUSDC (6 decimals)

    function setUp() public {
        // Deploy Mock Oracle ($2000 / ETH)
        oracle = new MockPriceOracle(INITIAL_ETH_PRICE);

        // Deploy Mock Tokens
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        tUSDC = new MockERC20("Test USD Coin", "tUSDC", 6);

        // Deploy Mock Lending Pool
        lendingPool = new MockLendingPool(address(oracle), address(weth), address(tUSDC));

        // Deploy LiquiGuard Vault
        vault = new LiquiGuardVault(
            address(weth),
            address(tUSDC),
            address(lendingPool),
            address(oracle),
            operator
        );

        // Seed initial tokens
        weth.mint(user, 100 ether);
        tUSDC.mint(operator, 1_000_000 * 1e6); // Operator liquidity for hedging
        tUSDC.mint(address(lendingPool), 1_000_000 * 1e6); // Lending pool borrow liquidity

        // Approvals
        vm.prank(user);
        weth.approve(address(vault), type(uint256).max);

        vm.prank(user);
        tUSDC.approve(address(vault), type(uint256).max);

        vm.prank(operator);
        tUSDC.approve(address(vault), type(uint256).max);
    }

    /**
     * @notice Test 1: User deposits 1 WETH at $2000, borrows $1000 tUSDC, initial HF = 1.60 (> 1.50)
     */
    function test_DepositAndBorrow() public {
        vm.prank(user);
        vault.depositAndBorrow(INITIAL_WETH_DEPOSIT, INITIAL_BORROW_AMOUNT);

        VaultState memory state = vault.getVaultState(user);
        assertEq(state.depositedCollateral, 1 ether, "Collateral should be 1 WETH");
        assertEq(state.borrowedDebt, 1000 * 1e6, "Debt should be 1000 tUSDC");
        assertEq(uint256(state.status), uint256(HedgeStatus.Idle), "Status should be Idle");

        uint256 hf = vault.getHealthFactor(user);
        // Calculation: ($2000 * 0.80) / $1000 = 1.60 * 1e18
        assertEq(hf, 1.60e18, "Health factor must equal 1.60e18");
        assertTrue(hf > 1.50e18, "Health factor should be greater than 1.50 safe threshold");

        // Verify token balances
        assertEq(tUSDC.balanceOf(user), 1000 * 1e6, "User should receive 1000 tUSDC");
        assertEq(weth.balanceOf(address(lendingPool)), 1 ether, "Lending pool should hold 1 WETH");
    }

    /**
     * @notice Test 2: Price drops from $2000 to $1375 (-31%), HF drops to ~1.10 (< 1.30 trigger)
     */
    function test_HealthFactorDropsOnPriceDrop() public {
        vm.prank(user);
        vault.depositAndBorrow(INITIAL_WETH_DEPOSIT, INITIAL_BORROW_AMOUNT);

        // Price drops to $1375
        oracle.setPrice(1375 * 1e8);

        uint256 hf = vault.getHealthFactor(user);
        // Calculation: ($1375 * 0.80) / $1000 = 1.10 * 1e18
        assertEq(hf, 1.10e18, "Health factor must equal 1.10e18 after price drop");
        assertTrue(hf < 1.30e18, "Health factor should fall below 1.30 hedge trigger");
    }

    /**
     * @notice Test 3: Operator calls executeProtectionHedge with $400 payout, debt reduced from $1000 to $600, HF restored to 1.83 (> 1.50)
     */
    function test_HedgeRepaymentRestoresHealthFactor() public {
        vm.prank(user);
        vault.depositAndBorrow(INITIAL_WETH_DEPOSIT, INITIAL_BORROW_AMOUNT);

        // Crash price to $1375 (HF = 1.10)
        oracle.setPrice(1375 * 1e8);
        assertEq(vault.getHealthFactor(user), 1.10e18);

        // Operator executes $400 micro-hedge repayment
        uint256 payoutAmount = 400 * 1e6; // $400 tUSDC
        vm.prank(operator);
        vault.executeProtectionHedge(user, payoutAmount);

        VaultState memory state = vault.getVaultState(user);
        assertEq(state.borrowedDebt, 600 * 1e6, "Debt should be reduced to 600 tUSDC");
        assertEq(state.lastHedgePayout, 400 * 1e6, "Last hedge payout should record 400 tUSDC");
        assertEq(uint256(state.status), uint256(HedgeStatus.Protected), "Status should be Protected");

        uint256 hf = vault.getHealthFactor(user);
        // Calculation: ($1375 * 0.80) / $600 = 1100 / 600 = 1.833333333333333333 * 1e18
        assertEq(hf, 1833333333333333333, "Health factor must equal 1.8333...e18");
        assertTrue(hf > 1.50e18, "Health factor should be restored well above 1.50");
    }

    /**
     * @notice Test 4: Non-operator revert test
     */
    function test_OnlyOperatorCanExecuteHedge() public {
        vm.prank(user);
        vault.depositAndBorrow(INITIAL_WETH_DEPOSIT, INITIAL_BORROW_AMOUNT);

        oracle.setPrice(1375 * 1e8);

        // Non-operator attempt must revert
        vm.prank(nonOperator);
        vm.expectRevert(ILiquiGuardVault.Unauthorized.selector);
        vault.executeProtectionHedge(user, 400 * 1e6);
    }

    /**
     * @notice Test 5: Withdrawal that would cause liquidation / drops below safe HF reverts
     */
    function test_WithdrawRevertsWhenUnsafe() public {
        vm.prank(user);
        vault.depositAndBorrow(INITIAL_WETH_DEPOSIT, INITIAL_BORROW_AMOUNT);

        // User attempts to withdraw 0.5 WETH while holding $1000 debt
        // Remaining collateral = 0.5 WETH ($1000), HF would be ($1000 * 0.80)/$1000 = 0.80 (< 1.20 MIN_SAFE_HF)
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                ILiquiGuardVault.UnsafeHealthFactor.selector,
                0.80e18,
                1.20e18
            )
        );
        vault.withdrawCollateral(0.5 ether);
    }

    /**
     * @notice Test 6: End-to-end full lifecycle flow
     */
    function test_FullLifecycle() public {
        // Step 1: User deposits 2 WETH ($4000) and borrows 2000 tUSDC
        vm.prank(user);
        vault.depositAndBorrow(2 ether, 2000 * 1e6);

        uint256 hf1 = vault.getHealthFactor(user);
        assertEq(hf1, 1.60e18, "Initial HF should be 1.60");

        // Step 2: Price crash simulation to $1375
        oracle.setPrice(1375 * 1e8);
        uint256 hf2 = vault.getHealthFactor(user);
        assertEq(hf2, 1.10e18, "HF after crash should be 1.10");

        // Step 3: Daemon relayer executes protection hedge payout of $800 tUSDC
        vm.prank(operator);
        vault.executeProtectionHedge(user, 800 * 1e6);

        VaultState memory stateProtected = vault.getVaultState(user);
        assertEq(stateProtected.borrowedDebt, 1200 * 1e6, "Remaining debt should be 1200 tUSDC");
        assertEq(uint256(stateProtected.status), uint256(HedgeStatus.Protected), "State is Protected");

        uint256 hf3 = vault.getHealthFactor(user);
        // Collateral = 2 * 1375 = $2750. 2750 * 0.80 / 1200 = 2200 / 1200 = 1.8333...
        assertEq(hf3, 1833333333333333333, "HF restored to 1.833");

        // Step 4: Market recovery to $2500
        oracle.setPrice(2500 * 1e8);
        uint256 hf4 = vault.getHealthFactor(user);
        // Collateral = 2 * 2500 = $5000. 5000 * 0.80 / 1200 = 4000 / 1200 = 3.333...
        assertEq(hf4, 3333333333333333333, "HF improves to 3.33");

        // Step 5: User repays remaining 1200 tUSDC debt
        tUSDC.mint(user, 1200 * 1e6);
        vm.prank(user);
        vault.repayDebt(1200 * 1e6);

        VaultState memory stateRepaid = vault.getVaultState(user);
        assertEq(stateRepaid.borrowedDebt, 0, "Debt fully repaid");
        assertEq(vault.getHealthFactor(user), type(uint256).max, "HF is infinity with 0 debt");

        // Step 6: User withdraws all 2 WETH collateral
        uint256 userWethBefore = weth.balanceOf(user);
        vm.prank(user);
        vault.withdrawCollateral(2 ether);
        uint256 userWethAfter = weth.balanceOf(user);
        assertEq(userWethAfter - userWethBefore, 2 ether, "User recovered 2 WETH");

        VaultState memory stateFinal = vault.getVaultState(user);
        assertEq(stateFinal.depositedCollateral, 0, "0 collateral remaining in vault");
    }

    /**
     * @notice Test 7: Safe partial withdrawal when HF remains above threshold
     */
    function test_SafePartialWithdrawal() public {
        vm.prank(user);
        vault.depositAndBorrow(2 ether, 1000 * 1e6); // $4000 collateral, $1000 debt -> HF = 3.20

        // Withdraw 0.5 WETH -> Remaining 1.5 WETH ($3000 collateral), HF = ($3000 * 0.80) / $1000 = 2.40 >= 1.20
        vm.prank(user);
        vault.withdrawCollateral(0.5 ether);

        VaultState memory state = vault.getVaultState(user);
        assertEq(state.depositedCollateral, 1.5 ether);
        assertEq(vault.getHealthFactor(user), 2.40e18);
    }

    /**
     * @notice Test 8: Setting operator and access control
     */
    function test_SetOperator() public {
        address newOperator = address(0x3003);
        vault.setOperator(newOperator);
        assertEq(vault.operator(), newOperator);

        // Non-owner cannot update operator
        vm.prank(user);
        vm.expectRevert(ILiquiGuardVault.Unauthorized.selector);
        vault.setOperator(address(0x4004));
    }

    /**
     * @notice Test 9: Setting hedge status
     */
    function test_SetHedgeStatus() public {
        vm.prank(operator);
        vault.setHedgeStatus(user, HedgeStatus.Hedging);

        VaultState memory state = vault.getVaultState(user);
        assertEq(uint256(state.status), uint256(HedgeStatus.Hedging));
    }
}
