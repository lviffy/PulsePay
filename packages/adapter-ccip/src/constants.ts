import { parseAbi } from "viem";
import { CCIP_EXPLORER_BASE_URL } from "@pulsepay/shared";
export { CCIP_EXPLORER_BASE_URL };

export const CCIP_ROUTER_ABI = parseAbi([
  "function getOnRamp(uint64 destChainSelector) external view returns (address)",
  "function getFee(uint64 destinationChainSelector, (bytes receiver, bytes data, (address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) external view returns (uint256 fee)",
  "function ccipSend(uint64 destinationChainSelector, (bytes receiver, bytes data, (address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) external payable returns (bytes32 messageId)",
  "function isChainSupported(uint64 chainSelector) external view returns (bool supported)",
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
]);

export const CCIP_CHAIN_SELECTORS: Record<number, bigint> = {
  11155111: 16015286601757825753n, // Ethereum Sepolia
  296: 222782988166878823n,        // Hedera Testnet
  421614: 3478487238524512106n,    // Arbitrum Sepolia
};

export const CCIP_DEFAULT_ROUTERS: Record<number, `0x${string}`> = {
  11155111: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // Ethereum Sepolia
  421614: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165",   // Arbitrum Sepolia
  296: "0x802C5F84eAD128Ff36fD6a3f8a418e339f467Ce4",      // Hedera Testnet
};


// EVMExtraArgsV2 tag = 0x181dcf10: keccak256("CCIP EVMExtraArgsV2")[0:4]
export const EVM_EXTRA_ARGS_V2_TAG = "0x181dcf10" as const;


export const CCIP_ONRAMP_ABI = parseAbi([
  "function getPoolBySourceToken(uint64 destChainSelector, address sourceToken) external view returns (address)",
]);
export const CCIP_POOL_ABI = parseAbi([
  "function isSupportedChain(uint64 remoteChainSelector) external view returns (bool)",
  "function getRemoteToken(uint64 remoteChainSelector) external view returns (bytes)",
]);
