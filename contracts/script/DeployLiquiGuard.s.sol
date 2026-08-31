// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockPriceOracle} from "../src/MockPriceOracle.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {MockLendingPool} from "../src/MockLendingPool.sol";
import {LiquiGuardVault} from "../src/LiquiGuardVault.sol";

/**
 * @title DeployLiquiGuard
 * @notice Foundry deployment script for Somnia Shannon Testnet and local Anvil environments.
 * @dev Deploys the complete suite: MockPriceOracle, WETH, tUSDC, MockLendingPool, and LiquiGuardVault.
 * Seeds initial pool liquidity and testnet faucet balances.
 */
contract DeployLiquiGuard is Script {
    // Initial ETH/USD Oracle Price: $2,000 (8 decimals)
    uint256 public constant INITIAL_PRICE = 2000 * 1e8;

    // Initial Lending Pool Liquidity: 10,000,000 tUSDC
    uint256 public constant INITIAL_POOL_USDC = 10_000_000 * 1e6;

    // Faucet Seed Amount for Deployer/Operator: 1,000 WETH and 1,000,000 tUSDC
    uint256 public constant FAUCET_SEED_WETH = 1_000 ether;
    uint256 public constant FAUCET_SEED_USDC = 1_000_000 * 1e6;

    function run()
        external
        returns (
            MockPriceOracle oracle,
            MockERC20 weth,
            MockERC20 tUSDC,
            MockLendingPool lendingPool,
            LiquiGuardVault vault
        )
    {
        uint256 deployerPrivateKey;
        address deployerAddress;

        // Retrieve deployer private key from environment or fallback to default foundry sender
        try vm.envUint("PRIVATE_KEY") returns (uint256 pk) {
            deployerPrivateKey = pk;
            deployerAddress = vm.addr(pk);
        } catch {
            deployerAddress = msg.sender;
        }

        address operatorAddress;
        try vm.envAddress("OPERATOR_ADDRESS") returns (address op) {
            operatorAddress = op;
        } catch {
            operatorAddress = deployerAddress;
        }

        console.log("==================================================");
        console.log("Starting LiquiGuard Suite Deployment");
        console.log("Deployer Address:", deployerAddress);
        console.log("Operator Address:", operatorAddress);
        console.log("==================================================");

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        // 1. Deploy MockPriceOracle
        oracle = new MockPriceOracle(INITIAL_PRICE);
        console.log("MockPriceOracle deployed at:", address(oracle));

        // 2. Deploy Mock Tokens
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        console.log("MockERC20 WETH deployed at:  ", address(weth));

        tUSDC = new MockERC20("Test USD Coin", "tUSDC", 6);
        console.log("MockERC20 tUSDC deployed at: ", address(tUSDC));

        // 3. Deploy MockLendingPool
        lendingPool = new MockLendingPool(address(oracle), address(weth), address(tUSDC));
        console.log("MockLendingPool deployed at: ", address(lendingPool));

        // 4. Deploy LiquiGuardVault
        vault = new LiquiGuardVault(
            address(weth),
            address(tUSDC),
            address(lendingPool),
            address(oracle),
            operatorAddress
        );
        console.log("LiquiGuardVault deployed at: ", address(vault));

        // 5. Seed Liquidity and Faucet Balances
        console.log("Seeding pool liquidity and faucet balances...");
        tUSDC.mint(address(lendingPool), INITIAL_POOL_USDC);
        weth.mint(deployerAddress, FAUCET_SEED_WETH);
        tUSDC.mint(deployerAddress, FAUCET_SEED_USDC);

        if (operatorAddress != deployerAddress && operatorAddress != address(0)) {
            weth.mint(operatorAddress, FAUCET_SEED_WETH);
            tUSDC.mint(operatorAddress, FAUCET_SEED_USDC);
        }

        vm.stopBroadcast();

        console.log("==================================================");
        console.log("Deployment & Seeding Complete!");
        console.log("==================================================");
        console.log("Environment variables to copy to .env:");
        console.log("VAULT_ADDRESS=", address(vault));
        console.log("LENDING_POOL_ADDRESS=", address(lendingPool));
        console.log("PRICE_ORACLE_ADDRESS=", address(oracle));
        console.log("WETH_ADDRESS=", address(weth));
        console.log("TUSDC_ADDRESS=", address(tUSDC));
        console.log("==================================================");
    }
}
