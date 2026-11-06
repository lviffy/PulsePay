import {
  createPublicClient,
  http,
  PublicClient,
  WalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  concat,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import {
  CCIP_ROUTER_ABI,
  CCIP_ONRAMP_ABI,
  CCIP_POOL_ABI,
  ERC20_ABI,
  CCIP_CHAIN_SELECTORS,
  CCIP_DEFAULT_ROUTERS,
  CCIP_EXPLORER_BASE_URL,
  EVM_EXTRA_ARGS_V2_TAG,
} from "./constants.js";
import type { BridgeQuote, BridgeTransactionPayload } from "@pulsepay/shared";

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export interface CCIPBridgeConfig {
  routerAddress?: Address;
  chainId?: number;
  rpcUrl?: string;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}

export interface QuoteBridgeParams {
  destinationChainSelector?: bigint;
  destinationChainId?: number;
  tokenAddress: Address;
  amountUnits: bigint;
  recipientAddress: Address;
  feeToken?: Address; // Defaults to ZERO_ADDRESS for native fees
}

export interface BuildBridgeParams extends QuoteBridgeParams {
  payerAddress?: Address;
}

/**
 * Encodes extraArgs for CCIP EVM token-only transfers.
 * Uses EVMExtraArgsV2 tag (0x181dcf10) with gasLimit = 0 and allowOutOfOrderExecution = true.
 */
export function encodeTokenOnlyExtraArgs(
  gasLimit: bigint = 0n,
  allowOutOfOrderExecution: boolean = true
): Hex {
  const encoded = encodeAbiParameters(
    parseAbiParameters("uint256 gasLimit, bool allowOutOfOrderExecution"),
    [gasLimit, allowOutOfOrderExecution]
  );
  return concat([EVM_EXTRA_ARGS_V2_TAG, encoded]);
}

/**
 * Encodes a receiver EOA address to CCIP receiver bytes: abi.encode(address)
 */
export function encodeReceiverAddress(recipient: Address): Hex {
  return encodeAbiParameters(parseAbiParameters("address"), [recipient]);
}

export class CCIPBridgeAdapter {
  public readonly chainId: number;
  public readonly routerAddress: Address;
  public readonly publicClient?: PublicClient;
  public readonly walletClient?: WalletClient;

  constructor(config?: CCIPBridgeConfig) {
    this.chainId = config?.chainId ?? 11155111; // Default to Sepolia
    this.routerAddress =
      config?.routerAddress ??
      CCIP_DEFAULT_ROUTERS[this.chainId];
    if (!this.routerAddress || !isAddress(this.routerAddress) || this.routerAddress === ZERO_ADDRESS) {
      throw new Error("A valid routerAddress is required for this source chain");
    }

    if (config?.publicClient) {
      this.publicClient = config.publicClient;
    } else if (config?.rpcUrl) {
      this.publicClient = createPublicClient({
        transport: http(config.rpcUrl),
      });
    }
    this.walletClient = config?.walletClient;
  }

  /**
   * Resolves the 64-bit CCIP chain selector from either explicit selector or EVM chain ID.
   */
  public resolveChainSelector(selector?: bigint, chainId?: number): bigint {
    if (selector !== undefined) {
      if (typeof selector !== "bigint" || selector <= 0n || selector > 18446744073709551615n) throw new Error("destinationChainSelector must be a positive uint64 bigint");
      if (chainId !== undefined && CCIP_CHAIN_SELECTORS[chainId] !== selector) throw new Error("Destination chain ID and selector do not match");
      return selector;
    }
    if (chainId && CCIP_CHAIN_SELECTORS[chainId]) {
      return CCIP_CHAIN_SELECTORS[chainId];
    }
    throw new Error(
      `Unable to resolve CCIP chain selector for chain ID ${chainId}. Provide an explicit destinationChainSelector.`
    );
  }

  /**
   * Constructs the EVM2AnyMessage struct for CCIP token-only bridging.
   */
  public buildEVM2AnyTokenMessage(params: {
    recipient: Address;
    token: Address;
    amount: bigint;
    feeToken?: Address;
  }) {
    return {
      receiver: encodeReceiverAddress(params.recipient),
      data: "0x" as Hex, // Token-only transfer (no contract execution)
      tokenAmounts: [
        {
          token: params.token,
          amount: params.amount,
        },
      ],
      feeToken: params.feeToken ?? ZERO_ADDRESS,
      extraArgs: encodeTokenOnlyExtraArgs(0n, true), // gasLimit = 0
    };
  }

  /**
   * Quotes the cross-chain bridging fee from the CCIP Router.
   */
  public async quoteBridgeFee(params: QuoteBridgeParams): Promise<BridgeQuote> {
    if (!isAddress(params.tokenAddress) || params.tokenAddress === ZERO_ADDRESS) {
      throw new Error(`Invalid tokenAddress: ${params.tokenAddress}`);
    }
    if (!isAddress(params.recipientAddress) || params.recipientAddress === ZERO_ADDRESS) {
      throw new Error(`Invalid recipientAddress: ${params.recipientAddress}`);
    }
    if (typeof params.amountUnits !== "bigint" || params.amountUnits <= 0n || params.amountUnits >= (1n << 256n)) {
      throw new Error("amountUnits must be greater than 0");
    }

    const destinationSelector = this.resolveChainSelector(
      params.destinationChainSelector,
      params.destinationChainId
    );
    const feeToken = params.feeToken ?? ZERO_ADDRESS;
    const message = this.buildEVM2AnyTokenMessage({
      recipient: params.recipientAddress,
      token: params.tokenAddress,
      amount: params.amountUnits,
      feeToken,
    });

    if (!isAddress(feeToken)) throw new Error("Invalid feeToken");
    const route = await this.checkLane(destinationSelector);
    const pool = await this.publicClient!.readContract({
      address: route.onRamp, abi: CCIP_ONRAMP_ABI, functionName: "getPoolBySourceToken",
      args: [destinationSelector, params.tokenAddress],
    }) as Address;
    if (!isAddress(pool) || pool === ZERO_ADDRESS) throw new Error("No CCIP pool registered for this source token");
    const poolSupported = await this.publicClient!.readContract({
      address: pool, abi: CCIP_POOL_ABI, functionName: "isSupportedChain", args: [destinationSelector],
    });
    if (!poolSupported) throw new Error("Token pool does not support the destination chain");
    const remoteToken = await this.publicClient!.readContract({
      address: pool, abi: CCIP_POOL_ABI, functionName: "getRemoteToken", args: [destinationSelector],
    }) as Hex;
    if (!/^0x[0-9a-fA-F]+$/.test(remoteToken) || BigInt(remoteToken) === 0n) throw new Error("Token pool has no destination token mapping");
    const feeUnits = await this.publicClient!.readContract({
      address: this.routerAddress, abi: CCIP_ROUTER_ABI,
      functionName: "getFee", args: [destinationSelector, message],
    }) as bigint;

    return {
      sourceChainId: this.chainId,
      destinationChainSelector: destinationSelector.toString(),
      token: params.tokenAddress,
      amountUnits: params.amountUnits.toString(),
      recipient: params.recipientAddress,
      feeToken,
      feeUnits: feeUnits.toString(),
      // Wallets must estimate source transaction gas after approvals confirm.
      estimatedGas: undefined,
      sourcePool: pool,
      destinationToken: remoteToken,
    };
  }

  /** Live lane availability; does not imply token support or successful delivery. */
  public async checkLane(destinationSelector: bigint) {
    this.resolveChainSelector(destinationSelector);
    if (!this.publicClient) throw new Error("Configure a CCIP RPC URL or publicClient to obtain a live fee");
    if (await this.publicClient.getChainId() !== this.chainId) throw new Error("CCIP RPC chain ID does not match source chain");
    if (destinationSelector === CCIP_CHAIN_SELECTORS[this.chainId]) throw new Error("Source and destination chains must differ");
    const supported = await this.publicClient.readContract({ address: this.routerAddress, abi: CCIP_ROUTER_ABI,
      functionName: "isChainSupported", args: [destinationSelector] });
    if (!supported) throw new Error("CCIP destination lane is not supported by this router");
    const onRamp = await this.publicClient.readContract({ address: this.routerAddress, abi: CCIP_ROUTER_ABI,
      functionName: "getOnRamp", args: [destinationSelector] }) as Address;
    if (!isAddress(onRamp) || onRamp === ZERO_ADDRESS) throw new Error("CCIP lane has no active on-ramp");
    return { sourceChainId: this.chainId, destinationChainSelector: destinationSelector.toString(), onRamp, routerAddress: this.routerAddress };
  }

  /**
   * Builds the unsigned transactions for approving tokens and executing ccipSend.
   */
  public async buildBridgeTransactions(
    params: BuildBridgeParams
  ): Promise<BridgeTransactionPayload> {
    const quote = await this.quoteBridgeFee(params);
    const destinationSelector = BigInt(quote.destinationChainSelector);
    const message = this.buildEVM2AnyTokenMessage({
      recipient: params.recipientAddress,
      token: params.tokenAddress,
      amount: params.amountUnits,
      feeToken: params.feeToken ?? ZERO_ADDRESS,
    });

    const isNativeFee = (params.feeToken ?? ZERO_ADDRESS) === ZERO_ADDRESS;
    const feeValue = isNativeFee ? BigInt(quote.feeUnits) : 0n;

    // 1. ccipSend transaction data
    const ccipSendData = encodeFunctionData({
      abi: CCIP_ROUTER_ABI,
      functionName: "ccipSend",
      args: [destinationSelector, message],
    });

    const sameFeeToken = message.feeToken.toLowerCase() === params.tokenAddress.toLowerCase();
    const approvalAmount = params.amountUnits + (sameFeeToken ? BigInt(quote.feeUnits) : 0n);
    // Approve transfer amount plus fees when the same ERC-20 pays both.
    // 2. ERC-20 approval transaction data
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [this.routerAddress, approvalAmount],
    });

    return {
      to: this.routerAddress,
      data: ccipSendData,
      value: feeValue,
      ...(!isNativeFee && !sameFeeToken ? { feeApprovalTx: {
        to: message.feeToken,
        data: encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [this.routerAddress, BigInt(quote.feeUnits)] }),
        value: 0n as const,
      } } : {}),
      approvalTx: {
        to: params.tokenAddress,
        data: approvalData,
        value: 0n,
      },
    };
  }

  /**
   * Generates a link to track the cross-chain message on CCIP Explorer.
   */
  public getExplorerUrl(messageId: string): string {
    const normalized = messageId.startsWith("0x") ? messageId : `0x${messageId}`;
    return `${CCIP_EXPLORER_BASE_URL}/${normalized}`;
  }
}

