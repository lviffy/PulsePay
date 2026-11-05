const fs = require('fs');
const path = require('path');

// Resolve viem modules from packages/adapter-whitechain
const viemPath = path.resolve(__dirname, '../../packages/adapter-whitechain/node_modules/viem');
const {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatEther,
} = require(viemPath);
const { privateKeyToAccount } = require(path.resolve(viemPath, 'accounts'));

// Helper to load environment variables from .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const rawPrivateKey =
  process.env.WHITECHAIN_PRIVATE_KEY ||
  'f9c69be21fb1ae1a3c5a3ba3eb12c5c69bd2eb5d016739a9ac1c0000efefb568';
const privateKey = rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`;
const rpcUrl = process.env.WHITECHAIN_RPC_URL || 'https://rpc.testnet.whitechain.io';
const chainId = parseInt(process.env.WHITECHAIN_CHAIN_ID || '1874', 10);
const usdtAddress =
  process.env.WHITECHAIN_USDT_ADDRESS || '0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7';
const explorerUrl =
  process.env.WHITECHAIN_EXPLORER_URL || 'https://explorer.testnet.whitechain.io';
const defaultReserveBps = 2000n; // 20%

const whitechainSepolia = defineChain({
  id: chainId,
  name: 'Whitechain Sepolia',
  nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: explorerUrl,
    },
  },
  testnet: true,
});

async function main() {
  console.log('====================================================');
  console.log('Deploying PulsePayMerchantHub to Whitechain Sepolia');
  console.log('====================================================');

  const account = privateKeyToAccount(privateKey);
  console.log('Deployer Address:', account.address);
  console.log('RPC URL:         ', rpcUrl);
  console.log('USDT Address:    ', usdtAddress);
  console.log('Default Reserve: ', `${defaultReserveBps} bps (20%)`);

  const publicClient = createPublicClient({
    chain: whitechainSepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: whitechainSepolia,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Deployer Balance:', formatEther(balance), 'WBT');

  if (balance === 0n) {
    throw new Error('Deployer account has 0 WBT balance. Cannot deploy.');
  }

  const buildPath = path.resolve(__dirname, 'build/PulsePayMerchantHub.json');
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build artifact not found at ${buildPath}. Run compile.js first.`);
  }

  const artifact = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
  const { abi, bytecode } = artifact;

  console.log('\nSubmitting deployment transaction...');
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    account,
    args: [usdtAddress, defaultReserveBps],
  });

  console.log('Deployment Tx Hash:', hash);
  console.log('Waiting for transaction confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  if (receipt.status !== 'success') {
    throw new Error(`Deployment transaction reverted! Status: ${receipt.status}`);
  }

  const deployedAddress = receipt.contractAddress;
  console.log('\n====================================================');
  console.log('PulsePayMerchantHub deployed successfully!');
  console.log('Contract Address:', deployedAddress);
  console.log('Block Number:    ', receipt.blockNumber.toString());
  console.log('Gas Used:        ', receipt.gasUsed.toString());
  console.log('Explorer Tx:     ', `${explorerUrl}/tx/${hash}`);
  console.log('Explorer Contract:', `${explorerUrl}/address/${deployedAddress}`);
  console.log('====================================================\n');

  // Update .env file
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('WHITECHAIN_MERCHANT_HUB_ADDRESS=')) {
      envContent = envContent.replace(
        /WHITECHAIN_MERCHANT_HUB_ADDRESS=.*/g,
        `WHITECHAIN_MERCHANT_HUB_ADDRESS=${deployedAddress}`
      );
    } else {
      envContent += `\nWHITECHAIN_MERCHANT_HUB_ADDRESS=${deployedAddress}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('Updated WHITECHAIN_MERCHANT_HUB_ADDRESS in .env');
  }

  // Write deployment info artifact
  const deploymentInfo = {
    contractAddress: deployedAddress,
    deployer: account.address,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    timestamp: new Date().toISOString(),
    network: 'Whitechain Sepolia',
    chainId,
    usdtAddress,
    defaultReserveBps: defaultReserveBps.toString(),
  };

  fs.writeFileSync(
    path.resolve(__dirname, 'build/deployment.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  return deployedAddress;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Deployment failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
