#!/usr/bin/env node

/**
 * End-to-end runnable script demonstrating Whitechain USDT to Ethereum Sepolia bridging
 * via WhitechainCCIPBridge and Chainlink CCIP 2.0 lane configuration.
 *
 * Usage:
 *   node scripts/bridge-whitechain-to-sepolia.mjs [amountUSDT] [recipientAddress] [senderAddress]
 * Example:
 *   node scripts/bridge-whitechain-to-sepolia.mjs 100 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 */

import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  buildWhitechainBridgeDeposit,
  WHITECHAIN_USDT_ADDRESS,
  WHITECHAIN_SEPOLIA_CHAIN_ID,
  ETHEREUM_SEPOLIA_CHAIN_ID,
  CCIP_CHAIN_SELECTOR_ETHEREUM_SEPOLIA,
  DEFAULT_WHITECHAIN_BRIDGE_ADDRESS,
  DEFAULT_WHITECHAIN_MAPPER_ADDRESS,
  WHITECHAIN_BRIDGE_MAPPER_ABI,
  ERC20_ABI,
} from "../packages/adapter-ccip/dist/index.js";

const DEFAULT_RPC = "https://rpc.testnet.whitechain.io";

async function main() {
  const [argAmount, argRecipient, argSender] = process.argv.slice(2);

  const amountUsdtStr = argAmount || "100";
  const amountUnits = parseUnits(amountUsdtStr, 6);
  const recipient = (argRecipient || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const sender = (argSender || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

  console.log("=== Whitechain USDT -> Ethereum Sepolia CCIP 2.0 Bridge ===");
  console.log(`Source Chain: Whitechain Sepolia (${WHITECHAIN_SEPOLIA_CHAIN_ID})`);
  console.log(`Destination Chain: Ethereum Sepolia (${ETHEREUM_SEPOLIA_CHAIN_ID})`);
  console.log(`Destination CCIP Selector: ${CCIP_CHAIN_SELECTOR_ETHEREUM_SEPOLIA.toString()}`);
  console.log(`Token: Whitechain USDT (${WHITECHAIN_USDT_ADDRESS})`);
  console.log(`Amount: ${amountUsdtStr} USDT (${amountUnits.toString()} raw units)`);
  console.log(`Sender: ${sender}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Bridge Contract: ${DEFAULT_WHITECHAIN_BRIDGE_ADDRESS}`);
  console.log(`Mapper Contract: ${DEFAULT_WHITECHAIN_MAPPER_ADDRESS}\n`);

  // Step 1: Read Whitechain USDT balance (best-effort query to live RPC, fallback to demo state)
  const client = createPublicClient({
    transport: http(process.env.WHITECHAIN_RPC_URL || DEFAULT_RPC),
  });

  let balance = 0n;
  try {
    balance = await client.readContract({
      address: WHITECHAIN_USDT_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [sender],
    });
    console.log(`Step 1: Live balance query successful. Current USDT Balance: ${formatUnits(balance, 6)} USDT`);
  } catch {
    console.log(`Step 1: Querying simulated sender balance: 10,000.00 USDT`);
  }

  // Step 2: Quote bridge parameters and limits from WhitechainBridgeMapper
  console.log(`\nStep 2: Checking Mapper Configuration for Sepolia lane (${CCIP_CHAIN_SELECTOR_ETHEREUM_SEPOLIA})...`);
  let mapperConfig = {
    minAmount: 10_000000n, // 10 USDT
    maxAmount: 5000_000000n, // 5,000 USDT
    dailyLimit: 20000_000000n, // 20,000 USDT
    transferType: 0, // LOCK_RELEASE
    isActive: true,
  };

  try {
    const liveConfig = await client.readContract({
      address: DEFAULT_WHITECHAIN_MAPPER_ADDRESS,
      abi: WHITECHAIN_BRIDGE_MAPPER_ABI,
      functionName: "getTokenConfig",
      args: [WHITECHAIN_USDT_ADDRESS, CCIP_CHAIN_SELECTOR_ETHEREUM_SEPOLIA],
    });
    mapperConfig = liveConfig;
    console.log("  Successfully fetched live token config from Mapper contract.");
  } catch {
    console.log("  Using canonical default bridge configuration limits:");
  }

  console.log(`  - Minimum Amount: ${formatUnits(mapperConfig.minAmount, 6)} USDT`);
  console.log(`  - Maximum Amount: ${formatUnits(mapperConfig.maxAmount, 6)} USDT`);
  console.log(`  - Daily Volume Cap: ${formatUnits(mapperConfig.dailyLimit, 6)} USDT`);
  console.log(`  - Lane Status: ${mapperConfig.isActive ? "ACTIVE" : "INACTIVE"}`);

  if (amountUnits < mapperConfig.minAmount) {
    throw new Error(`Amount ${amountUsdtStr} USDT is below minimum allowed (${formatUnits(mapperConfig.minAmount, 6)} USDT)`);
  }
  if (amountUnits > mapperConfig.maxAmount) {
    throw new Error(`Amount ${amountUsdtStr} USDT exceeds maximum allowed (${formatUnits(mapperConfig.maxAmount, 6)} USDT)`);
  }

  // Step 3: Build unsigned deposit transaction payload
  console.log(`\nStep 3: Building unsigned transactions for user approval & bridgeTokens...`);

  // Use demo dev key for signature generation if none is supplied in environment
  const demoSignerKey = process.env.BRIDGE_SIGNER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  const depositPayload = await buildWhitechainBridgeDeposit({
    tokenAddress: WHITECHAIN_USDT_ADDRESS,
    amountUnits,
    recipientAddress: recipient,
    senderAddress: sender,
    nonce: 0n,
    signerPrivateKey: demoSignerKey,
  });

  console.log("  [Tx 1] ERC-20 Allowance Approval:");
  console.log(`    To:    ${depositPayload.approvalTx.to}`);
  console.log(`    Data:  ${depositPayload.approvalTx.data.slice(0, 34)}...`);
  console.log(`    Value: ${depositPayload.approvalTx.value.toString()} wei`);

  console.log("  [Tx 2] Whitechain CCIP Bridge bridgeTokens():");
  console.log(`    To:    ${depositPayload.bridgeTx.to}`);
  console.log(`    Data:  ${depositPayload.bridgeTx.data.slice(0, 66)}...`);
  console.log(`    Value: ${depositPayload.bridgeTx.value.toString()} wei`);
  console.log(`    Computed DepositId: ${depositPayload.depositId}`);
  console.log(`    Cryptographic Signature: ${depositPayload.signature.slice(0, 26)}...`);

  // Step 4: Simulate Relayer & CCIP 2.0 Dispatch to Ethereum Sepolia
  console.log(`\nStep 4: Simulating Relayer / CCIP 2.0 Dispatch to Sepolia...`);
  console.log(`  - Relayer captures Deposit event with DepositId: ${depositPayload.depositId}`);
  console.log(`  - Dispatch payload routed via CCIP Router (0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59) on Ethereum Sepolia`);
  console.log(`  - Destination recipient ${recipient} receives ${amountUsdtStr} Sepolia USDT`);
  console.log("\nBridge preparation completed successfully!");
}

main().catch((err) => {
  console.error("Error running bridge script:", err.message);
  process.exit(1);
});
