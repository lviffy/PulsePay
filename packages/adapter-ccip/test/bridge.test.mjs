import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CCIPBridgeAdapter,
  encodeTokenOnlyExtraArgs,
  encodeReceiverAddress,
  ZERO_ADDRESS,
} from "../dist/index.js";
import {
  CCIP_CHAIN_SELECTORS,
  CCIP_DEFAULT_ROUTERS,
  CCIP_EXPLORER_BASE_URL,
  EVM_EXTRA_ARGS_V2_TAG,
} from "../dist/constants.js";

test("encodeTokenOnlyExtraArgs encodes gasLimit = 0 and allowOutOfOrderExecution = true", () => {
  const extraArgs = encodeTokenOnlyExtraArgs(0n, true);
  assert.ok(extraArgs.startsWith(EVM_EXTRA_ARGS_V2_TAG));
  assert.equal(extraArgs.length, 10 + 64 + 64); // 4-byte tag (10 chars with 0x) + uint256 (64 chars) + bool (64 chars)
});

test("encodeReceiverAddress encodes standard 20-byte address to 32-byte ABI word", () => {
  const addr = "0x1234567890123456789012345678901234567890";
  const encoded = encodeReceiverAddress(addr);
  assert.equal(encoded.length, 66); // '0x' + 64 hex chars
  assert.ok(encoded.toLowerCase().endsWith(addr.slice(2).toLowerCase()));
});

test("CCIPBridgeAdapter resolves chain selectors accurately", () => {
  const adapter = new CCIPBridgeAdapter();
  assert.equal(adapter.resolveChainSelector(undefined, 11155111), CCIP_CHAIN_SELECTORS[11155111]);
  assert.equal(adapter.resolveChainSelector(undefined, 296), CCIP_CHAIN_SELECTORS[296]);
  assert.equal(adapter.resolveChainSelector(99999n, undefined), 99999n);
});

test("CCIPBridgeAdapter quotes the router fee", async () => {
  const adapter = liveAdapter();
  const quote = await adapter.quoteBridgeFee({
    destinationChainId: 296,
    tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
    amountUnits: 1000000n,
    recipientAddress: "0x1111111111111111111111111111111111111111",
  });

  assert.equal(quote.sourceChainId, 11155111);
  assert.equal(quote.destinationChainSelector, CCIP_CHAIN_SELECTORS[296].toString());
  assert.equal(quote.token, "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7");
  assert.equal(quote.amountUnits, "1000000");
  assert.equal(quote.recipient, "0x1111111111111111111111111111111111111111");
  assert.equal(quote.feeToken, ZERO_ADDRESS);
  assert.ok(BigInt(quote.feeUnits) > 0n);
});

test("CCIPBridgeAdapter builds valid unsigned bridge & approval transactions", async () => {
  const adapter = liveAdapter();
  const token = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
  const recipient = "0x2222222222222222222222222222222222222222";
  const txs = await adapter.buildBridgeTransactions({
    destinationChainId: 296,
    tokenAddress: token,
    amountUnits: 5000000n,
    recipientAddress: recipient,
  });

  assert.equal(txs.to.toLowerCase(), CCIP_DEFAULT_ROUTERS[11155111].toLowerCase());
  assert.ok(txs.data.startsWith("0x"));
  assert.ok(txs.value > 0n); // Native fee value attached

  assert.ok(txs.approvalTx);
  assert.equal(txs.approvalTx.to.toLowerCase(), token.toLowerCase());
  assert.ok(txs.approvalTx.data.startsWith("0x095ea7b3")); // approve(address,uint256) selector
});

test("CCIPBridgeAdapter produces official CCIP Explorer URL", () => {
  const adapter = new CCIPBridgeAdapter();
  const messageId = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const url = adapter.getExplorerUrl(messageId);
  assert.equal(url, `${CCIP_EXPLORER_BASE_URL}/${messageId}`);
});


function liveAdapter(overrides = {}) {
  return new CCIPBridgeAdapter({ publicClient: {
    getChainId: async () => 11155111,
    readContract: async ({ functionName }) => ({
      isChainSupported: true, getOnRamp: "0x3333333333333333333333333333333333333333",
      getPoolBySourceToken: "0x4444444444444444444444444444444444444444",
      isSupportedChain: true, getRemoteToken: "0x0000000000000000000000005555555555555555555555555555555555555555", getFee: 123456n,
    })[functionName],
    ...overrides,
  } });
}
const params = {
  destinationChainId: 296,
  tokenAddress: "0x1111111111111111111111111111111111111111",
  recipientAddress: "0x2222222222222222222222222222222222222222",
  amountUnits: 100n,
};
test("offline and failed RPC quotes never produce fabricated fees", async () => {
  await assert.rejects(new CCIPBridgeAdapter().quoteBridgeFee(params), /Configure a CCIP RPC/);
  await assert.rejects(liveAdapter({ readContract: async () => { throw new Error("RPC unavailable"); } }).quoteBridgeFee(params), /RPC unavailable/);
});
test("wrong RPC chain and unsupported lanes are rejected", async () => {
  await assert.rejects(liveAdapter({ getChainId: async () => 296 }).quoteBridgeFee(params), /chain ID/);
  await assert.rejects(liveAdapter({ readContract: async () => false }).quoteBridgeFee(params), /lane is not supported/);
});
test("unknown source routers and invalid selectors are rejected", () => {
  assert.throws(() => new CCIPBridgeAdapter({ chainId: 1874 }), /routerAddress/);
  const adapter = liveAdapter();
  for (const selector of [0n, -1n, 1n << 64n]) assert.throws(() => adapter.resolveChainSelector(selector), /uint64/);
  assert.throws(() => adapter.resolveChainSelector(1n, 296), /do not match/);
});
test("zero recipients and transfer tokens are rejected", async () => {
  await assert.rejects(liveAdapter().quoteBridgeFee({ ...params, recipientAddress: ZERO_ADDRESS }), /recipientAddress/);
  await assert.rejects(liveAdapter().quoteBridgeFee({ ...params, tokenAddress: ZERO_ADDRESS }), /tokenAddress/);
});
test("ERC20 fees have a separate approval, or combine with the transfer allowance", async () => {
  const { decodeFunctionData } = await import("viem");
  const { ERC20_ABI } = await import("../dist/constants.js");
  const separate = await liveAdapter().buildBridgeTransactions({ ...params, feeToken: params.recipientAddress });
  assert.equal(separate.value, 0n);
  assert.equal(separate.feeApprovalTx.to, params.recipientAddress);
  assert.equal(decodeFunctionData({ abi: ERC20_ABI, data: separate.feeApprovalTx.data }).args[1], 123456n);
  const combined = await liveAdapter().buildBridgeTransactions({ ...params, feeToken: params.tokenAddress });
  assert.equal(combined.feeApprovalTx, undefined);
  assert.equal(decodeFunctionData({ abi: ERC20_ABI, data: combined.approvalTx.data }).args[1], 123556n);
});

test("token pools must be registered, connected and have a destination token", async () => {
  for (const [method, value, expected] of [
    ["getPoolBySourceToken", ZERO_ADDRESS, /No CCIP pool/],
    ["isSupportedChain", false, /pool does not support/],
    ["getRemoteToken", "0x", /no destination token/],
  ]) {
    const client = liveAdapter().publicClient;
    const read = client.readContract;
    client.readContract = async args => args.functionName === method ? value : read(args);
    await assert.rejects(new CCIPBridgeAdapter({ publicClient: client }).quoteBridgeFee(params), expected);
  }
});
