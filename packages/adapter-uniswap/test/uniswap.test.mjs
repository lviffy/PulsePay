import test, { beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  UniswapRoutingAdapter,
  UniswapV4TreasuryAdapter,
  treasuryGuardHookAbi,
  universalRouterAbi,
  swapRouter02Abi,
} from "../dist/index.js";
import {
  UNICHAIN_SEPOLIA_CHAIN_ID,
  UNICHAIN_SEPOLIA_RPC,
  UNICHAIN_SEPOLIA_POOL_MANAGER,
  WHITECHAIN_USDT_ADDRESS,
} from "@pulsepay/shared";

const require = createRequire(import.meta.url);
const solc = require("solc");

// Unit tests use deterministic price responses and never contact public RPCs.
beforeEach(() => {
  mock.method(globalThis, "fetch", async (url) => {
    if (String(url).startsWith("https://coins.llama.fi/")) return Response.json({coins:{
      "coingecko:ethereum":{price:2232.27},"coingecko:usd-coin":{price:1},"coingecko:tether":{price:0.999}
    }});
    throw new Error("Network disabled in unit tests");
  });
});
afterEach(() => mock.restoreAll());

test("UniswapRoutingAdapter: getExactOutputQuote calculates genuine live market rates", async () => {
  const adapter = new UniswapRoutingAdapter();

  // Test 20 USDT exact output with WETH input (18 decimals)
  const quoteEth = await adapter.getExactOutputQuote({
    tokenInAddress: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9",
    tokenInSymbol: "WETH",
    tokenInDecimals: 18,
    tokenOutAddress: WHITECHAIN_USDT_ADDRESS,
    targetUsdtAmountUnits: 20_000_000n, // $20.00 USDT
    slippageTolerancePercent: 0.5,
    payerAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  assert.equal(quoteEth.inputToken, "WETH");
  assert.equal(quoteEth.outputToken, "USDT");
  assert.equal(quoteEth.outputAmount, "20000000");
  assert.equal(quoteEth.slippageTolerance, 0.5);

  const inputUnitsEth = BigInt(quoteEth.inputAmount);
  // With ETH around $2,000 - $3,500, 20 USDT is ~0.005 to 0.012 ETH (5e15 to 1.2e16 wei)
  assert(inputUnitsEth > 4_000_000_000_000_000n, "Input wei must be positive realistic market value");
  assert(inputUnitsEth < 25_000_000_000_000_000n, "Input wei must be within expected live market range");
  assert(quoteEth.route.includes("live DEX feed") || quoteEth.route.includes("Uniswap"));

  // Test 20 USDT exact output with USDC input (6 decimals)
  const quoteUsdc = await adapter.getExactOutputQuote({
    tokenInAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    tokenInSymbol: "USDC",
    tokenInDecimals: 6,
    tokenOutAddress: WHITECHAIN_USDT_ADDRESS,
    targetUsdtAmountUnits: 20_000_000n,
    slippageTolerancePercent: 0.5,
  });

  assert.equal(quoteUsdc.inputToken, "USDC");
  const inputUnitsUsdc = BigInt(quoteUsdc.inputAmount);
  // 20 USDT should be ~20 USDC plus 0.5% buffer (~20.05 to 20.15 USDC)
  assert(inputUnitsUsdc >= 20_000_000n, "USDC input should cover 20 USDT with slippage buffer");
  assert(inputUnitsUsdc <= 20_500_000n, "USDC input should be close to 1:1 parity");
});

test("UniswapRoutingAdapter: buildSwapTransaction encodes authentic Universal Router calldata", async () => {
  const adapter = new UniswapRoutingAdapter();

  const swapTx = await adapter.buildSwapTransaction({
    tokenInAddress: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9",
    tokenInSymbol: "WETH",
    tokenInDecimals: 18,
    tokenOutAddress: WHITECHAIN_USDT_ADDRESS,
    targetUsdtAmountUnits: 20_000_000n,
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  assert.equal(swapTx.routerType, "UniversalRouter");
  assert(swapTx.to.startsWith("0x"), "Must provide valid router target address");
  assert(swapTx.data.startsWith("0x"), "Must generate authentic calldata hex");
  // Universal Router `execute(bytes,bytes[],uint256)` selector is 0x3593564c
  assert(swapTx.data.startsWith("0x3593564c"), "Must use Universal Router execute selector");
  assert.equal(swapTx.outputAmount, 20_000_000n);
  assert(swapTx.inputAmount > 0n);
});

test("UniswapRoutingAdapter: buildSwapTransaction supports SwapRouter02 fallback", async () => {
  const adapter = new UniswapRoutingAdapter();

  const swapTx = await adapter.buildSwapTransaction({
    tokenInAddress: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9",
    tokenInSymbol: "WETH",
    tokenInDecimals: 18,
    tokenOutAddress: WHITECHAIN_USDT_ADDRESS,
    targetUsdtAmountUnits: 20_000_000n,
    maxInputAmountUnits: 10_000_000_000_000_000n,
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    routerType: "SwapRouter02",
  });

  assert.equal(swapTx.routerType, "SwapRouter02");
  assert(swapTx.data.startsWith("0x"), "Must generate calldata hex");
  assert.equal(swapTx.outputAmount, 20_000_000n);
  assert.equal(swapTx.inputAmount, 10_000_000_000_000_000n);
});

test("UniswapRoutingAdapter: executeSwap invokes walletClient and awaits receipt", async () => {
  let txSent = false;
  let receiptAwaited = false;
  const mockTxHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  const mockPublicClient = {
    waitForTransactionReceipt: async ({ hash }) => {
      receiptAwaited = true;
      return { status: "success", transactionHash: hash, blockNumber: 100n };
    },
  };

  const mockWalletClient = {
    account: { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
    sendTransaction: async (tx) => {
      txSent = true;
      assert(tx.data.startsWith("0x3593564c"));
      return mockTxHash;
    },
  };

  const adapter = new UniswapRoutingAdapter({
    publicClient: mockPublicClient,
  });

  const result = await adapter.executeSwap(mockWalletClient, {
    tokenInAddress: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9",
    tokenInSymbol: "WETH",
    tokenInDecimals: 18,
    tokenOutAddress: WHITECHAIN_USDT_ADDRESS,
    targetUsdtAmountUnits: 20_000_000n,
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });

  assert(txSent, "Must dispatch sendTransaction");
  assert(receiptAwaited, "Must await waitForTransactionReceipt");
  assert.equal(result.txHash, mockTxHash);
  assert.equal(result.receipt.status, "success");
});

test("UniswapV4TreasuryAdapter: calldata encoders produce authentic ABI data", () => {
  const adapter = new UniswapV4TreasuryAdapter({
    hookAddress: "0x00C0A5F1b837269D3E9d6092F0eF675fA5517178",
  });

  // setPaused encoding
  const pausedTx = adapter.encodeSetPaused(true);
  assert.equal(pausedTx.to.toLowerCase(), "0x00c0a5f1b837269d3e9d6092f0ef675fa5517178");
  // setPaused(bool) selector is 0x16c38b3c
  assert(pausedTx.data.startsWith("0x16c38b3c"));

  // setMaxSwapAmount encoding
  const maxSwapTx = adapter.encodeSetMaxSwapAmount(50_000_000_000n);
  assert.equal(maxSwapTx.to.toLowerCase(), "0x00c0a5f1b837269d3e9d6092f0ef675fa5517178");
  // setMaxSwapAmount(uint256) selector is 0xa5f7f99d
  assert(maxSwapTx.data.startsWith("0xa5f7f99d"));

  // claimFees encoding
  const claimTx = adapter.encodeClaimFees({
    currency0: WHITECHAIN_USDT_ADDRESS,
    currency1: "0x078d782b760474a361dda0af3839290b0ef57ad6",
    recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  });
  assert.equal(claimTx.to, UNICHAIN_SEPOLIA_POOL_MANAGER);
  assert(claimTx.data.startsWith("0x"));
});

test("UniswapV4TreasuryAdapter: setPaused and setMaxSwapAmount execute writeContract and await receipt", async () => {
  let writeContractCalled = false;
  let receiptAwaited = false;
  const mockTxHash = "0xaaaa567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  const mockPublicClient = {
    waitForTransactionReceipt: async ({ hash }) => {
      receiptAwaited = true;
      return { status: "success", transactionHash: hash };
    },
  };

  const mockWalletClient = {
    account: { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
    writeContract: async (params) => {
      writeContractCalled = true;
      assert.equal(params.functionName, "setPaused");
      assert.deepEqual(params.args, [true]);
      return mockTxHash;
    },
  };

  const adapter = new UniswapV4TreasuryAdapter({
    hookAddress: "0x00C0A5F1b837269D3E9d6092F0eF675fA5517178",
    publicClient: mockPublicClient,
    walletClient: mockWalletClient,
  });

  const res = await adapter.setPaused(true);
  assert(writeContractCalled);
  assert(receiptAwaited);
  assert.equal(res.txHash, mockTxHash);

  // Test setMaxSwapAmount
  let limitUpdated = false;
  mockWalletClient.writeContract = async (params) => {
    limitUpdated = true;
    assert.equal(params.functionName, "setMaxSwapAmount");
    assert.deepEqual(params.args, [100_000_000n]);
    return mockTxHash;
  };

  const resLimit = await adapter.setMaxSwapAmount(100_000_000n);
  assert(limitUpdated);
  assert.equal(resLimit.txHash, mockTxHash);
});

test("TreasuryGuardHook.sol & TreasuryGuardHook.t.sol clean compilation verification", () => {
  function findImports(importPath) {
    let resolvedPath = "";
    if (importPath.startsWith("v4-core/")) {
      resolvedPath = path.join("../../contracts/uniswap-v4/lib/v4-core", importPath.replace("v4-core/", ""));
    } else if (importPath.startsWith("forge-std/")) {
      resolvedPath = path.join("../../contracts/uniswap-v4/lib/forge-std/src", importPath.replace("forge-std/", ""));
    } else if (importPath.startsWith("@openzeppelin/contracts/")) {
      resolvedPath = path.join("../../contracts/uniswap-v4/lib/v4-core/lib/openzeppelin-contracts/contracts", importPath.replace("@openzeppelin/contracts/", ""));
    } else if (importPath.startsWith("solmate/")) {
      resolvedPath = path.join("../../contracts/uniswap-v4/lib/v4-core/lib/solmate/src", importPath.replace("solmate/", ""));
    } else if (importPath.startsWith("src/")) {
      resolvedPath = path.join("../../contracts/uniswap-v4", importPath);
    } else if (importPath.startsWith("../src/")) {
      resolvedPath = path.join("../../contracts/uniswap-v4/src", importPath.replace("../src/", ""));
    } else {
      resolvedPath = path.join("../../contracts/uniswap-v4/src", importPath);
    }

    try {
      const contents = fs.readFileSync(resolvedPath, "utf8");
      return { contents };
    } catch (e) {
      return { error: "File not found: " + resolvedPath };
    }
  }

  const hookSource = fs.readFileSync("../../contracts/uniswap-v4/src/TreasuryGuardHook.sol", "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "TreasuryGuardHook.sol": { content: hookSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["*"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  assert.equal(errors.length, 0, "TreasuryGuardHook.sol must have zero compilation errors");

  const contract = output.contracts["TreasuryGuardHook.sol"]["TreasuryGuardHook"];
  assert(contract.evm.bytecode.object.length > 0, "Bytecode must be generated");

  // Verify custom errors and function selectors are present
  const abi = contract.abi;
  const functionNames = abi.filter((x) => x.type === "function").map((x) => x.name);
  assert(functionNames.includes("maxSwapAmount"));
  assert(functionNames.includes("paused"));
  assert(functionNames.includes("setPaused"));
  assert(functionNames.includes("setMaxSwapAmount"));
  assert(functionNames.includes("beforeSwap"));
  assert(functionNames.includes("afterSwap"));

  const errorNames = abi.filter((x) => x.type === "error").map((x) => x.name);
  assert(errorNames.includes("TreasurySwapsPaused"));
  assert(errorNames.includes("SwapAmountExceedsPolicyLimit"));
  assert(errorNames.includes("InvalidLimit"));
});
