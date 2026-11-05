import {
  createPublicClient,
  http,
  PublicClient,
  WalletClient,
  encodeFunctionData,
  parseAbi,
  getAddress,
} from "viem";
import {
  UNICHAIN_SEPOLIA_CHAIN_ID,
  UNICHAIN_SEPOLIA_RPC,
  UNICHAIN_SEPOLIA_POOL_MANAGER,
} from "@pulsepay/shared";

export const treasuryGuardHookAbi = parseAbi([
  "function maxSwapAmount() view returns (uint256)",
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
  "function setPaused(bool _paused)",
  "function setMaxSwapAmount(uint256 _newLimit)",
  "event TreasurySwapsPausedUpdated(bool isPaused)",
  "event MaxSwapAmountUpdated(uint256 oldLimit, uint256 newLimit)",
  "event TreasurySwapExecuted(bytes32 indexed poolId, address indexed sender, bool zeroForOne, int128 amount0, int128 amount1, uint256 timestamp)",
]);

export const uniswapV4PoolManagerAbi = parseAbi([
  "function unlock(bytes data) external returns (bytes)",
  "function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external returns (int128 delta0, int128 delta1)",
  "function sync(address currency) external returns (uint256 balance)",
  "function take(address currency, address to, uint256 amount) external",
  "function settle() external payable returns (uint256 paid)",
]);

export interface UniswapV4TreasuryConfig {
  hookAddress: `0x${string}`;
  poolManagerAddress?: `0x${string}`;
  rpcUrl?: string;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}

export interface ClaimFeesParams {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  recipient: `0x${string}`;
  fee?: number;
  tickSpacing?: number;
  tickLower?: number;
  tickUpper?: number;
}

export class UniswapV4TreasuryAdapter {
  public readonly hookAddress: `0x${string}`;
  public readonly poolManagerAddress: `0x${string}`;
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;

  constructor(config: UniswapV4TreasuryConfig) {
    this.hookAddress = getAddress(config.hookAddress);
    this.poolManagerAddress = getAddress(config.poolManagerAddress || UNICHAIN_SEPOLIA_POOL_MANAGER);
    this.walletClient = config.walletClient;

    this.publicClient =
      config.publicClient ||
      createPublicClient({
        transport: http(config.rpcUrl || UNICHAIN_SEPOLIA_RPC),
      });
  }

  /**
   * Read the live on-chain policy configuration of the TreasuryGuardHook contract.
   */
  async getHookPolicy(): Promise<{ maxSwapAmount: bigint; paused: boolean; owner: `0x${string}` }> {
    const [maxSwapAmount, paused, owner] = await Promise.all([
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
    ]);

    return { maxSwapAmount, paused, owner };
  }

  /**
   * Encode calldata to update circuit breaker pause status on TreasuryGuardHook.
   */
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

  /**
   * Encode calldata to update max swap policy limit on TreasuryGuardHook.
   */
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

  /**
   * Execute real on-chain setPaused transaction and await receipt.
   */
  async setPaused(
    paused: boolean,
    walletClient?: WalletClient,
    account?: `0x${string}`
  ): Promise<{ txHash: `0x${string}`; receipt: any }> {
    const client = walletClient || this.walletClient;
    if (!client) {
      throw new Error("WalletClient is required to execute setPaused on-chain");
    }

    const targetAccount = account || client.account;
    if (!targetAccount) {
      throw new Error("An account is required on the WalletClient or passed as an argument");
    }

    const txHash = await client.writeContract({
      address: this.hookAddress,
      abi: treasuryGuardHookAbi,
      functionName: "setPaused",
      args: [paused],
      account: targetAccount,
      chain: client.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  /**
   * Execute real on-chain setMaxSwapAmount transaction and await receipt.
   */
  async setMaxSwapAmount(
    newLimitUnits: bigint,
    walletClient?: WalletClient,
    account?: `0x${string}`
  ): Promise<{ txHash: `0x${string}`; receipt: any }> {
    const client = walletClient || this.walletClient;
    if (!client) {
      throw new Error("WalletClient is required to execute setMaxSwapAmount on-chain");
    }

    const targetAccount = account || client.account;
    if (!targetAccount) {
      throw new Error("An account is required on the WalletClient or passed as an argument");
    }

    const txHash = await client.writeContract({
      address: this.hookAddress,
      abi: treasuryGuardHookAbi,
      functionName: "setMaxSwapAmount",
      args: [newLimitUnits],
      account: targetAccount,
      chain: client.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  /**
   * Encode authentic Uniswap v4 liquidity fee collection calldata.
   */
  encodeClaimFees(params: ClaimFeesParams) {
    const fee = params.fee ?? 3000;
    const tickSpacing = params.tickSpacing ?? 60;
    const tickLower = params.tickLower ?? -600;
    const tickUpper = params.tickUpper ?? 600;

    const data = encodeFunctionData({
      abi: uniswapV4PoolManagerAbi,
      functionName: "modifyLiquidity",
      args: [
        {
          currency0: getAddress(params.currency0),
          currency1: getAddress(params.currency1),
          fee,
          tickSpacing,
          hooks: getAddress(this.hookAddress),
        },
        {
          tickLower,
          tickUpper,
          liquidityDelta: 0n, // Zero liquidity delta collects outstanding accrued fees
          salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
        },
        "0x",
      ],
    });

    return {
      to: this.poolManagerAddress,
      data,
      recipient: getAddress(params.recipient),
      currency0: getAddress(params.currency0),
      currency1: getAddress(params.currency1),
    };
  }

  /**
   * Execute authentic on-chain fee claim via Uniswap v4 PoolManager.
   */
  async claimFees(
    params: ClaimFeesParams,
    walletClient?: WalletClient,
    account?: `0x${string}`
  ): Promise<{ txHash: `0x${string}`; receipt: any }> {
    const client = walletClient || this.walletClient;
    if (!client) {
      throw new Error("WalletClient is required to execute claimFees on-chain");
    }

    const targetAccount = account || client.account;
    if (!targetAccount) {
      throw new Error("An account is required on the WalletClient or passed as an argument");
    }

    const claimTx = this.encodeClaimFees(params);

    const txHash = await client.sendTransaction({
      to: claimTx.to,
      data: claimTx.data,
      account: targetAccount,
      chain: client.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }
}
