import {
  createPublicClient,
  http,
  PublicClient,
  WalletClient,
  encodeFunctionData,
  parseAbi,
} from "viem";
import {
  UNICHAIN_SEPOLIA_RPC,
  UNICHAIN_SEPOLIA_POOL_MANAGER,
} from "@pulsepay/shared";

export const treasuryGuardHookAbi = parseAbi([
  "function maxSwapAmount() view returns (uint256)",
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
  "function limitCurrency() view returns (address)",
  "function setPaused(bool _paused)",
  "function setMaxSwapAmount(uint256 _newLimit)",
  "event TreasurySwapsPausedUpdated(bool isPaused)",
  "event MaxSwapAmountUpdated(uint256 oldLimit, uint256 newLimit)",
  "event TreasurySwapExecuted(bytes32 indexed poolId, address indexed sender, bool zeroForOne, int128 amount0, int128 amount1, uint256 timestamp)",
]);

export interface UniswapV4TreasuryConfig {
  hookAddress: `0x${string}`;
  poolManagerAddress?: `0x${string}`;
  rpcUrl?: string;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}

export class UniswapV4TreasuryAdapter {
  public readonly hookAddress: `0x${string}`;
  public readonly poolManagerAddress: `0x${string}`;
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;

  constructor(config: UniswapV4TreasuryConfig) {
    this.hookAddress = config.hookAddress;
    this.poolManagerAddress = config.poolManagerAddress || UNICHAIN_SEPOLIA_POOL_MANAGER;
    this.walletClient = config.walletClient;

    this.publicClient =
      config.publicClient ||
      createPublicClient({
        transport: http(config.rpcUrl || UNICHAIN_SEPOLIA_RPC),
      });
  }

  async getHookPolicy(): Promise<{ maxSwapAmount: bigint; paused: boolean; owner: `0x${string}`; limitCurrency: `0x${string}` }> {
    const [maxSwapAmount, paused, owner, limitCurrency] = await Promise.all([
      this.publicClient.readContract({
        address: this.hookAddress,
        abi: treasuryGuardHookAbi,
        functionName: "maxSwapAmount",
      }),
      this.publicClient.readContract({
        address: this.hookAddress,
        abi: treasuryGuardHookAbi,
        functionName: "paused",
      }),
      this.publicClient.readContract({
        address: this.hookAddress,
        abi: treasuryGuardHookAbi,
        functionName: "owner",
      }),
      this.publicClient.readContract({ address: this.hookAddress, abi: treasuryGuardHookAbi, functionName: "limitCurrency" }),
    ]);

    return { maxSwapAmount, paused, owner, limitCurrency };
  }

  encodeSetPaused(paused: boolean) {
    return {
      to: this.hookAddress,
      data: encodeFunctionData({
        abi: treasuryGuardHookAbi,
        functionName: "setPaused",
        args: [paused],
      }),
    };
  }

  encodeSetMaxSwapAmount(newLimitUnits: bigint) {
    return {
      to: this.hookAddress,
      data: encodeFunctionData({
        abi: treasuryGuardHookAbi,
        functionName: "setMaxSwapAmount",
        args: [newLimitUnits],
      }),
    };
  }
}

