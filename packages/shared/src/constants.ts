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

// Uniswap v4 Testnet (Unichain Sepolia)
export const UNICHAIN_SEPOLIA_CHAIN_ID = 1301;
export const UNICHAIN_SEPOLIA_RPC = "https://sepolia.unichain.org";
export const UNICHAIN_SEPOLIA_POOL_MANAGER = "0x00B036bf97F650eEa2f656606A6C4F07449c25f5" as const;

// Hedera Testnet
export const HEDERA_TESTNET_CHAIN_ID = 296;
export const HEDERA_TESTNET_MIRROR_NODE = "https://testnet.mirrornode.hedera.com";
export const HEDERA_NATIVE_HBAR_ASSET = "0.0.0";
export const TINYBARS_PER_HBAR = 100_000_000n;

// Reserve Defaults
export const DEFAULT_RESERVE_BPS = 2000; // 20%
export const BPS_DIVISOR = 10000;

