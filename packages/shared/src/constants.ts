/**
 * Official network constants for PulsePay tri-track integration
 */

// Whitechain Sepolia Testnet
export const WHITECHAIN_SEPOLIA_CHAIN_ID = 1874;
export const WHITECHAIN_SEPOLIA_RPC = "https://rpc.testnet.whitechain.io";
export const WHITECHAIN_SEPOLIA_EXPLORER = "https://explorer.testnet.whitechain.io";
export const WHITECHAIN_SEPOLIA_BLOCKSCOUT_API = "https://explorer.testnet.whitechain.io/api/v2";

// Official ETHGlobal Whitechain USDT Token Address (Mandatory)
export const WHITECHAIN_USDT_ADDRESS = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7" as const;
export const WHITECHAIN_USDT_DECIMALS = 6;

// Whitechain Bridge & Mapper Addresses (whitechain-labs/bridge-contracts reference)
export const DEFAULT_WHITECHAIN_BRIDGE_ADDRESS = "0x3f68b5aE5Fe75E1160af9D5e296EF1976092780E" as const;
export const DEFAULT_WHITECHAIN_MAPPER_ADDRESS = "0x8CD9AF6f242F79D034C08d59546fF2864C82E51A" as const;

// Ethereum Sepolia Testnet
export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;
export const ETHEREUM_SEPOLIA_RPC = "https://rpc.sepolia.org";

// Chainlink CCIP 2.0 Testnet Chain Selectors (Not EVM Chain IDs)
export const CCIP_CHAIN_SELECTOR_HEDERA_TESTNET = 222782988166878823n;
export const CCIP_CHAIN_SELECTOR_ETHEREUM_SEPOLIA = 16015286601757825753n;
export const CCIP_CHAIN_SELECTOR_ARBITRUM_SEPOLIA = 3478487238524512106n;

// Official CCIP Routers (Testnet)
export const CCIP_ROUTER_ETHEREUM_SEPOLIA = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59" as const;
export const CCIP_ROUTER_ARBITRUM_SEPOLIA = "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165" as const;

// CCIP Explorer
export const CCIP_EXPLORER_BASE_URL = "https://ccip.chain.link/msg";

// Hedera Testnet
export const HEDERA_TESTNET_CHAIN_ID = 296;
export const HEDERA_TESTNET_MIRROR_NODE = "https://testnet.mirrornode.hedera.com";
export const HEDERA_NATIVE_HBAR_ASSET = "0.0.0";
export const TINYBARS_PER_HBAR = 100_000_000n;

// Reserve Defaults
export const DEFAULT_RESERVE_BPS = 2000; // 20%
export const BPS_DIVISOR = 10000;
