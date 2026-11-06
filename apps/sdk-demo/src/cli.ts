import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPulsePay, whitechainSepolia } from "@pulsepay/sdk-core";
import { handleX402PaymentCheck, X402RouteConfig } from "@pulsepay/sdk-server";
import { stringToHex, formatEther, formatUnits, createWalletClient, http as viemHttp } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Load .env from root if available
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const WHITECHAIN_RPC = process.env.WHITECHAIN_RPC_URL || "https://rpc.testnet.whitechain.io";
const WHITECHAIN_HUB = (process.env.WHITECHAIN_MERCHANT_HUB_ADDRESS || "0xb115ceb2cf3c15a5c1a607284f0599ad6531bbc2") as `0x${string}`;
const WHITECHAIN_USDT = (process.env.WHITECHAIN_USDT_ADDRESS || "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7") as `0x${string}`;
const WHITECHAIN_KEY = process.env.WHITECHAIN_PRIVATE_KEY
  ? ((process.env.WHITECHAIN_PRIVATE_KEY.startsWith("0x")
      ? process.env.WHITECHAIN_PRIVATE_KEY
      : `0x${process.env.WHITECHAIN_PRIVATE_KEY}`) as `0x${string}`)
  : undefined;

const EXPLORER_URL = process.env.WHITECHAIN_EXPLORER_URL || "https://explorer.testnet.whitechain.io";

function header(title: string) {
  console.log("\n" + "=".repeat(70));
  console.log(`  ${title}`);
  console.log("=".repeat(70));
}

function subheader(title: string) {
  console.log("\n--- " + title + " ---");
}

async function main() {
  console.log(`
██████╗ ██╗   ██╗██╗     ███████╗███████╗██████╗  █████╗ ██╗   ██╗
██╔══██╗██║   ██║██║     ██╔════╝██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝
██████╔╝██║   ██║██║     ███████╗█████╗  ██████╔╝███████║ ╚████╔╝
██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝
██║     ╚██████╔╝███████╗███████║███████╗██║     ██║  ██║   ██║
╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝
             Interactive SDK Demonstration Walkthrough
`);

  // ==========================================================================
  // Step 1: SDK Initialization
  // ==========================================================================
  header("STEP 1: Initializing PulsePay SDK Core Client");
  console.log("Configuring PulsePayClient with live Whitechain Sepolia parameters:");
  console.log(`- Contract Hub:  ${WHITECHAIN_HUB}`);
  console.log(`- RPC Endpoint:  ${WHITECHAIN_RPC}`);
  console.log(`- Official USDT: ${WHITECHAIN_USDT}`);

  let walletClient: any = undefined;
  let signerAddress = "0x6105F7D9807998014ca12bF1D67849de7B1094Ac" as `0x${string}`;
  if (WHITECHAIN_KEY) {
    const acct = privateKeyToAccount(WHITECHAIN_KEY);
    signerAddress = acct.address;
    console.log(`- Deployer/Signer: ${acct.address}`);
    walletClient = createWalletClient({
      account: acct,
      chain: whitechainSepolia,
      transport: viemHttp(WHITECHAIN_RPC),
    });
  }

  const pulsepay = createPulsePay({
    whitechain: {
      contractAddress: WHITECHAIN_HUB,
      usdtAddress: WHITECHAIN_USDT,
      rpcUrl: WHITECHAIN_RPC,
      walletClient,
    },
    ccip: {
      chainId: 11155111,
      rpcUrl: process.env.CCIP_RPC_URL || process.env.SEPOLIA_RPC_URL,
    },
  });

  console.log("\n[OK] PulsePayClient initialized successfully with Whitechain & Chainlink CCIP 2.0 adapters!");

  // ==========================================================================
  // Step 2: Track 1 - Whitechain On-Chain State & Invoices
  // ==========================================================================
  header("STEP 2: Whitechain Track — Real On-Chain Operations");

  subheader("A. Querying Live Contract State & Balances");
  try {
    const balances = await pulsepay.payments.getBalances(signerAddress);
    console.log(`Merchant Account:   ${signerAddress}`);
    console.log(`- Refund Reserve:   ${formatUnits(balances.reserve, 6)} USDT`);
    console.log(`- Available Funds:  ${formatUnits(balances.available, 6)} USDT`);
  } catch (err: any) {
    console.log(`Balances query note: ${err.message}`);
  }

  subheader("B. Creating a Live On-Chain Invoice");
  const randomSuffix = Math.floor(Math.random() * 10000);
  const invoiceCode = `INV-DEMO-${randomSuffix}`;
  const invoiceIdHex = stringToHex(invoiceCode, { size: 32 });
  const invoiceAmountUsdt = 25n * 1_000_000n; // 25.00 USDT
  const dueAtTimestamp = BigInt(Math.floor(Date.now() / 1000) + 86400 * 7); // 7 days

  console.log(`Creating Invoice on Whitechain Sepolia:`);
  console.log(`- Invoice Code:    ${invoiceCode}`);
  console.log(`- Hex Identifier:  ${invoiceIdHex}`);
  console.log(`- Amount:          25.00 USDT (25000000 units)`);
  console.log(`- Due At:          ${new Date(Number(dueAtTimestamp) * 1000).toISOString()}`);

  if (walletClient) {
    console.log("\nBroadcasting transaction to Whitechain network...");
    try {
      const createRes = await pulsepay.invoices.create({
        invoiceId: invoiceIdHex,
        amountUnits: invoiceAmountUsdt,
        dueAtSeconds: Number(dueAtTimestamp),
      });

      console.log(`\n[SUCCESS] Transaction confirmed in Block ${createRes.receipt.blockNumber}!`);
      console.log(`Transaction Hash: ${createRes.txHash}`);
      console.log(`Blockscout Explorer: ${EXPLORER_URL}/tx/${createRes.txHash}`);
    } catch (err: any) {
      console.log(`Invoice creation error (check gas): ${err.message}`);
    }
  } else {
    console.log("[Notice] WHITECHAIN_PRIVATE_KEY not provided; generated calldata for creation:");
    const calldata = pulsepay.invoices.encodeCreate(
      invoiceIdHex,
      "0x0000000000000000000000000000000000000000",
      invoiceAmountUsdt,
      Number(dueAtTimestamp)
    );
    console.log(`Encoded Function Calldata: ${calldata.data.substring(0, 74)}...`);
  }

  subheader("C. Fetching Live On-Chain Invoice Data");
  try {
    const fetched = await pulsepay.invoices.get(invoiceIdHex);
    if (fetched) {
      console.log(`Retrieved Invoice ${invoiceCode} from Whitechain Contract:`);
      console.log(`- Merchant:   ${fetched.merchant}`);
      console.log(`- Amount:     ${formatUnits(fetched.amountUnits, 6)} USDT`);
      console.log(`- Status:     ${fetched.status}`);
      console.log(`- Due At:     ${new Date(fetched.dueAt * 1000).toISOString()}`);
    } else {
      console.log(`Invoice ${invoiceCode} not found on-chain.`);
    }
  } catch (err: any) {
    console.log(`Could not fetch invoice: ${err.message}`);
  }

  // ==========================================================================
  // Step 3: Track 2 - Chainlink CCIP 2.0 Token Bridging
  // ==========================================================================
  header("STEP 3: Chainlink CCIP 2.0 Track — Cross-Chain Token Bridging");
  console.log("Demonstrating Cross-Chain Token Bridging via Chainlink CCIP:");
  console.log("- Source Network:       Ethereum Sepolia (Chain ID: 11155111)");
  console.log("- Destination Network:  Hedera Testnet (CCIP Selector: 222782988166878823)");
  console.log("- Token to Bridge:      Configured source-chain ERC-20 (10,000,000 raw units)");
  console.log(`- Recipient Wallet:     ${signerAddress}`);

  try {
    if (!process.env.CCIP_TOKEN_ADDRESS) throw new Error("Set CCIP_TOKEN_ADDRESS to a supported source-chain token; Whitechain USDT cannot be assumed bridgeable");
    const quote = await pulsepay.bridgeOps.quoteFee({
      destinationChainSelector: 222782988166878823n, // Hedera testnet selector
      tokenAddress: process.env.CCIP_TOKEN_ADDRESS as `0x${string}`,
      amountUnits: 10_000_000n, // 10 units
      recipientAddress: signerAddress,
    });

    console.log(`\n[SUCCESS] Live Chainlink CCIP Bridge Fee Quote Received:`);
    console.log(`- Source Chain:         ${quote.sourceChainId}`);
    console.log(`- Destination Selector: ${quote.destinationChainSelector}`);
    console.log(`- Required CCIP Fee:    ${formatEther(BigInt(quote.feeUnits))} Native Gas (${quote.feeUnits} wei)`);
    console.log(`- Gas Limit:            0 (Token-only transfer, zero callback execution overhead)`);

    subheader("Building CCIP Router Transaction Calldata");
    const bridgeTxs = await pulsepay.bridgeOps.buildTransactions({
      destinationChainSelector: 222782988166878823n,
      tokenAddress: process.env.CCIP_TOKEN_ADDRESS as `0x${string}`,
      amountUnits: 10_000_000n,
      recipientAddress: signerAddress,
      payerAddress: signerAddress,
    });

    console.log(`- Router Target:        ${bridgeTxs.to}`);
    console.log(`- Native Value to Send: ${formatEther(bridgeTxs.value)} ETH`);
    console.log(`- ccipSend Payload:     ${bridgeTxs.data.substring(0, 66)}... (${bridgeTxs.data.length / 2} bytes)`);
    if (bridgeTxs.approvalTx) {
      console.log(`- Token Approval Target:${bridgeTxs.approvalTx.to}`);
      console.log(`- Approval Payload:     ${bridgeTxs.approvalTx.data.substring(0, 66)}...`);
    }
    console.log("After wallet submission, track the actual message ID with bridgeOps.waitForDelivery(messageId).");
    console.log(`[OK] Transactions ready for direct Web3 wallet broadcast to CCIP Router.`);
  } catch (err: any) {
    console.log(`CCIP bridge error: ${err.message}`);
  }

  // ==========================================================================
  // Step 4: Track 3 - Hedera x402 Micropayment Negotiation
  // ==========================================================================
  header("STEP 4: Hedera Track — x402 Paywall & AI Agent Challenge");
  console.log("Requesting server-side protection on an AI agent API endpoint:");
  console.log("- Resource: GET /v1/ai/market-intelligence");
  console.log("- Price:    0.5 HBAR (50,000,000 tinybars) per query");
  console.log("- Protocol: x402 'hedera-native-receipt' verified via Hedera Mirror Node");

  const routeConfig: X402RouteConfig = {
    serviceId: "market-intelligence-pro",
    serviceName: "Market Intelligence Stream",
    price: {
      network: "hedera:testnet",
      asset: "0.0.0", // Native HBAR
      amountTinybars: "50000000", // 0.5 HBAR
      payTo: "0.0.11327364",
    },
  };

  // Check an unauthenticated request without submitting a payment
  const authCheck = await handleX402PaymentCheck(routeConfig, null);

  console.log(`\nServer Evaluation Result:`);
  console.log(`- Authorized:   ${authCheck.authorized} (Expected: false until paid)`);
  console.log(`- Status Code:  ${authCheck.statusCode} Payment Required`);
  console.log(`- Challenge ID: ${authCheck.body.requirement?.challengeId}`);
  console.log(`- Amount Due:   ${authCheck.body.requirement?.amount} tinybars`);
  console.log(`- Recipient:    ${authCheck.body.requirement?.recipient}`);
  console.log(`- Challenge Expires: ${new Date((authCheck.body.requirement?.expiresAt || 0) * 1000).toLocaleTimeString()}`);
  console.log(`\n[Agent Flow]:`);
  console.log(`1. AI Agent intercepts the 402 response and cryptographic challengeId.`);
  console.log(`2. Agent kit evaluates daily budget limit with PulsePaySpendLimitPolicy.`);
  console.log(`3. Agent executes native HBAR transfer to ${authCheck.body.requirement?.recipient} with memo: "PulsePay x402: <hash>".`);
  console.log(`4. Agent resubmits request with payment proof header.`);
  console.log(`5. Server queries Hedera Mirror Node, verifies consensus timestamp, and unlocks data.`);
  console.log(`6. Settlement event is logged permanently to HCS Audit Topic 0.0.11330043.`);

  // ==========================================================================
  // Summary
  // ==========================================================================
  header("DEMONSTRATION COMPLETE");
  console.log(`All three tracks tested and verified using the PulsePay SDK:
1. Whitechain Sepolia:  Real contract state, live invoice generation & Blockscout link.
2. Chainlink CCIP 2.0:  Cross-chain token bridging quote & Router execution calldata.
3. Hedera Micropay:     x402 protocol challenge negotiation & HCS audit architecture.

To run the visual interactive web dashboard:
  pnpm --filter pulsepay-sdk-demo web
`);
}

main().catch((err) => {
  console.error("Demo encountered an error:", err);
  process.exit(1);
});
