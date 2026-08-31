import { createPublicClient, createWalletClient, http, parseEther, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load root .env
dotenv.config();

const SOMNIA_RPC = 'https://api.infra.testnet.somnia.network';
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith('0x')) {
  console.error('❌ Error: Valid PRIVATE_KEY not found in .env');
  process.exit(1);
}

// Somnia Shannon Testnet definition
const somniaShannon = {
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: [SOMNIA_RPC] },
    public: { http: [SOMNIA_RPC] },
  },
  blockExplorers: {
    default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
  testnet: true,
} as const;

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: somniaShannon,
  transport: http(SOMNIA_RPC),
});

const walletClient = createWalletClient({
  account,
  chain: somniaShannon,
  transport: http(SOMNIA_RPC),
});

// Helper to load Foundry compiled artifact
function loadArtifact(contractName: string, solFile: string) {
  const artifactPath = path.join(
    process.cwd(),
    'contracts',
    'out',
    solFile,
    `${contractName}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Run 'forge build' first.`);
  }
  const data = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return {
    abi: data.abi,
    bytecode: data.bytecode.object as `0x${string}`,
  };
}

async function main() {
  console.log('====================================================');
  console.log('🛡️  LiquiGuard Direct On-Chain Deployer (Viem)');
  console.log('====================================================');
  console.log(`🌐 Network:     Somnia Shannon Testnet (ID: 50312)`);
  console.log(`📡 RPC:         ${SOMNIA_RPC}`);
  console.log(`👤 Deployer:    ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance:     ${Number(balance) / 1e18} STT`);

  if (balance === 0n) {
    console.error('❌ Insufficient balance to deploy.');
    process.exit(1);
  }

  // 1. MockPriceOracle (Already deployed or deploy fresh)
  let oracleAddress = '0xDD2A460Bfe22BfA7c757A35F6d68813770d39712' as `0x${string}`;
  console.log(`\n[1/5] Using deployed MockPriceOracle at: ${oracleAddress}`);

  async function waitReceipt(hash: `0x${string}`) {
    for (let i = 0; i < 30; i++) {
      try {
        const r = await publicClient.getTransactionReceipt({ hash });
        if (r && r.status === 'success') return r;
      } catch (e) {}
      await new Promise((res) => setTimeout(res, 1000));
    }
    return await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  }

  // 2. Deploy MockERC20 (WETH)
  console.log('\n[2/5] Deploying MockERC20 (WETH)...');
  const erc20Artifact = loadArtifact('MockERC20', 'MockERC20.sol');
  const wethHash = await walletClient.deployContract({
    abi: erc20Artifact.abi,
    bytecode: erc20Artifact.bytecode,
    args: ['Wrapped Ether', 'WETH', 18],
  });
  console.log(`   ⏳ Tx Hash: ${wethHash}`);
  const wethReceipt = await waitReceipt(wethHash);
  const wethAddress = wethReceipt.contractAddress!;
  console.log(`   ✅ WETH deployed at: ${wethAddress}`);

  // 3. Deploy MockERC20 (tUSDC)
  console.log('\n[3/5] Deploying MockERC20 (tUSDC)...');
  const tusdcHash = await walletClient.deployContract({
    abi: erc20Artifact.abi,
    bytecode: erc20Artifact.bytecode,
    args: ['Test USD Coin', 'tUSDC', 6],
  });
  console.log(`   ⏳ Tx Hash: ${tusdcHash}`);
  const tusdcReceipt = await waitReceipt(tusdcHash);
  const tusdcAddress = tusdcReceipt.contractAddress!;
  console.log(`   ✅ tUSDC deployed at: ${tusdcAddress}`);

  // 4. Deploy MockLendingPool
  console.log('\n[4/5] Deploying MockLendingPool...');
  const poolArtifact = loadArtifact('MockLendingPool', 'MockLendingPool.sol');
  const poolHash = await walletClient.deployContract({
    abi: poolArtifact.abi,
    bytecode: poolArtifact.bytecode,
    args: [oracleAddress, wethAddress, tusdcAddress],
  });
  console.log(`   ⏳ Tx Hash: ${poolHash}`);
  const poolReceipt = await waitReceipt(poolHash);
  const poolAddress = poolReceipt.contractAddress!;
  console.log(`   ✅ MockLendingPool deployed at: ${poolAddress}`);

  // 5. Deploy LiquiGuardVault
  console.log('\n[5/5] Deploying LiquiGuardVault...');
  const vaultArtifact = loadArtifact('LiquiGuardVault', 'LiquiGuardVault.sol');
  const vaultHash = await walletClient.deployContract({
    abi: vaultArtifact.abi,
    bytecode: vaultArtifact.bytecode,
    args: [wethAddress, tusdcAddress, poolAddress, oracleAddress, account.address],
  });
  console.log(`   ⏳ Tx Hash: ${vaultHash}`);
  const vaultReceipt = await waitReceipt(vaultHash);
  const vaultAddress = vaultReceipt.contractAddress!;
  console.log(`   ✅ LiquiGuardVault deployed at: ${vaultAddress}`);

  // 6. Seed Pool Liquidity (10,000,000 tUSDC)
  console.log('\n[6/6] Seeding Initial Lending Pool Liquidity (10M tUSDC)...');
  const seedHash = await walletClient.writeContract({
    address: tusdcAddress,
    abi: erc20Artifact.abi,
    functionName: 'mint',
    args: [poolAddress, parseUnits('10000000', 6)],
  });
  await waitReceipt(seedHash);
  console.log(`   ✅ Seeded 10M tUSDC liquidity to Lending Pool!`);

  // Update .env file
  console.log('\n📝 Updating .env and frontend contract addresses...');
  let envContent = fs.readFileSync('.env', 'utf8');
  envContent = envContent.replace(/VAULT_ADDRESS=.*/, `VAULT_ADDRESS=${vaultAddress}`);
  envContent = envContent.replace(/LENDING_POOL_ADDRESS=.*/, `LENDING_POOL_ADDRESS=${poolAddress}`);
  envContent = envContent.replace(/PRICE_ORACLE_ADDRESS=.*/, `PRICE_ORACLE_ADDRESS=${oracleAddress}`);
  envContent = envContent.replace(/WETH_ADDRESS=.*/, `WETH_ADDRESS=${wethAddress}`);
  envContent = envContent.replace(/TUSDC_ADDRESS=.*/, `TUSDC_ADDRESS=${tusdcAddress}`);
  fs.writeFileSync('.env', envContent);

  // Update frontend contracts.ts addresses
  const frontendContractsPath = path.join(
    process.cwd(),
    'frontend',
    'src',
    'lib',
    'contracts.ts'
  );
  if (fs.existsSync(frontendContractsPath)) {
    let frontendContracts = fs.readFileSync(frontendContractsPath, 'utf8');
    frontendContracts = frontendContracts.replace(
      /vault:\s*['"]0x[a-fA-F0-9]*['"]/,
      `vault: '${vaultAddress}'`
    );
    frontendContracts = frontendContracts.replace(
      /lendingPool:\s*['"]0x[a-fA-F0-9]*['"]/,
      `lendingPool: '${poolAddress}'`
    );
    frontendContracts = frontendContracts.replace(
      /priceOracle:\s*['"]0x[a-fA-F0-9]*['"]/,
      `priceOracle: '${oracleAddress}'`
    );
    frontendContracts = frontendContracts.replace(
      /weth:\s*['"]0x[a-fA-F0-9]*['"]/,
      `weth: '${wethAddress}'`
    );
    frontendContracts = frontendContracts.replace(
      /tusdc:\s*['"]0x[a-fA-F0-9]*['"]/,
      `tusdc: '${tusdcAddress}'`
    );
    fs.writeFileSync(frontendContractsPath, frontendContracts);
    console.log(`   ✅ Frontend contracts.ts updated!`);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL CONTRACTS SUCCESSFULLY DEPLOYED TO SOMNIA!');
  console.log('====================================================');
  console.log(`• LiquiGuardVault:  ${vaultAddress}`);
  console.log(`• MockLendingPool:  ${poolAddress}`);
  console.log(`• MockPriceOracle:  ${oracleAddress}`);
  console.log(`• WETH:             ${wethAddress}`);
  console.log(`• tUSDC:            ${tusdcAddress}`);
  console.log('====================================================');
  console.log(`🔗 Shannon Explorer: https://shannon-explorer.somnia.network/address/${vaultAddress}`);
}

main().catch((err) => {
  console.error('❌ Deployment error:', err);
  process.exit(1);
});
