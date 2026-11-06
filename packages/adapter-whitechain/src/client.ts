import {
  createPublicClient,
  http,
  PublicClient,
  WalletClient,
  parseUnits,
  encodeFunctionData,
  decodeEventLog,
  parseEventLogs,
  keccak256,
  stringToHex,
  type TransactionReceipt,
} from "viem";
import { whitechainSepolia } from "./chain.js";
import { pulsePayMerchantHubAbi, erc20Abi } from "./abi.js";
import {
  WHITECHAIN_USDT_ADDRESS,
  WHITECHAIN_USDT_DECIMALS,
  Invoice,
  PaymentRecord,
  Subscription,
  SubscriptionPlan,
} from "@pulsepay/shared";

export interface WhitechainClientConfig {
  contractAddress: `0x${string}`;
  usdtAddress?: `0x${string}`;
  rpcUrl?: string;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
}

export interface CreateInvoiceArgs {
  invoiceId?: `0x${string}`;
  customer?: `0x${string}`;
  amountUnits: bigint;
  dueAtSeconds?: number;
  metadataHash?: `0x${string}`;
}

export interface CreatePlanArgs {
  planId?: `0x${string}`;
  amountPerCycleUnits: bigint;
  intervalSeconds: number;
  maxCycles: number;
}

function generateRandomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export class WhitechainAdapter {
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;
  public readonly contractAddress: `0x${string}`;
  public readonly usdtAddress: `0x${string}`;

  constructor(config: WhitechainClientConfig) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(config.contractAddress) || /^0x0{40}$/i.test(config.contractAddress)) throw new Error("Configure a nonzero Whitechain merchant hub address");
    this.contractAddress = config.contractAddress;
    this.usdtAddress = config.usdtAddress || WHITECHAIN_USDT_ADDRESS;
    this.walletClient = config.walletClient;

    this.publicClient =
      config.publicClient ||
      createPublicClient({
        chain: whitechainSepolia,
        transport: http(config.rpcUrl || whitechainSepolia.rpcUrls.default.http[0]),
      });
  }

  private async getAccount(walletClient?: WalletClient) {
    const client = walletClient || this.walletClient;
    if (!client) {
      throw new Error("WalletClient is required for transaction execution");
    }
    if (client.account) {
      return { client, account: client.account, address: client.account.address };
    }
    const [address] = await client.getAddresses();
    if (!address) {
      throw new Error("No account address available on WalletClient");
    }
    return { client, account: address, address };
  }

  // --- Read Methods ---

  async getInvoice(invoiceId: `0x${string}`): Promise<Invoice | null> {
    const data = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "getInvoice",
      args: [invoiceId],
    });

    const statusMap = ["NONE", "OPEN", "PAID", "EXPIRED", "CANCELLED"] as const;
    const status = statusMap[data.status] || "NONE";
    if (status === "NONE") return null;

    return {
      id: data.invoiceId,
      merchant: data.merchant,
      customer: data.customer === "0x0000000000000000000000000000000000000000" ? undefined : data.customer,
      amountUnits: data.amount,
      dueAt: Number(data.dueAt),
      status: status as any,
      metadataHash: data.metadataHash,
      createdAt: Number(data.dueAt) - 86400,
    };
  }

  async getPayment(invoiceId: `0x${string}`): Promise<PaymentRecord | null> {
    const data = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "getPayment",
      args: [invoiceId],
    });

    const statusMap = ["NONE", "PAID", "PARTIALLY_REFUNDED", "FULLY_REFUNDED"] as const;
    const status = statusMap[data.status] || "NONE";
    if (status === "NONE") return null;

    let txHash: `0x${string}` = "0x";
    try {
      const logs = await this.publicClient.getLogs({
        address: this.contractAddress,
        event: {
          type: "event",
          name: "PaymentSettled",
          inputs: [
            { type: "bytes32", name: "invoiceId", indexed: true },
            { type: "address", name: "merchant", indexed: true },
            { type: "address", name: "customer", indexed: true },
            { type: "uint256", name: "amount", indexed: false },
            { type: "uint64", name: "paidAt", indexed: false },
          ],
        },
        args: {
          invoiceId,
        },
        fromBlock: 0n,
      });
      if (logs.length > 0 && logs[0].transactionHash) {
        txHash = logs[0].transactionHash;
      }
    } catch {
      // Keep "0x" fallback if query fails
    }

    return {
      invoiceId: data.invoiceId,
      merchant: data.merchant,
      customer: data.customer,
      amountPaidUnits: data.amountPaid,
      amountRefundedUnits: data.amountRefunded,
      paidAt: Number(data.paidAt),
      status: status as any,
      txHash,
      chain: "whitechain",
    };
  }

  async getSubscription(subscriptionId: `0x${string}`): Promise<Subscription | null> {
    const data = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "getSubscription",
      args: [subscriptionId],
    });

    if (data.subscriber === "0x0000000000000000000000000000000000000000") return null;

    return {
      id: data.subscriptionId,
      planId: data.planId,
      merchant: data.merchant,
      subscriber: data.subscriber,
      amountPerCycleUnits: data.amountPerCycle,
      intervalSeconds: Number(data.intervalSeconds),
      nextChargeAt: Number(data.nextChargeAt),
      maxCycles: data.maxCycles,
      cyclesCharged: data.cyclesCharged,
      active: data.active,
    };
  }

  async getPlan(planId: `0x${string}`): Promise<SubscriptionPlan | null> {
    const data = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "getPlan",
      args: [planId],
    });

    if (data.merchant === "0x0000000000000000000000000000000000000000") return null;

    return {
      id: data.planId,
      merchant: data.merchant,
      amountPerCycleUnits: data.amountPerCycle,
      intervalSeconds: Number(data.intervalSeconds),
      maxCycles: data.maxCycles,
      active: data.active,
    };
  }

  async getMerchantBalances(merchant: `0x${string}`): Promise<{ reserve: bigint; available: bigint }> {
    const [reserve, available] = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "getMerchantBalances",
      args: [merchant],
    });
    return { reserve, available };
  }

  async getUsdtBalance(account: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.usdtAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    });
  }

  async getUsdtAllowance(owner: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.usdtAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, this.contractAddress],
    });
  }

  // --- Real On-Chain Transaction Execution Methods ---

  /**
   * Pay an invoice onchain using USDT.
   * Checks allowance first, executes USDT approval if needed, calls payInvoice, and awaits confirmation.
   */
  /** The caller invokes this from a wallet-confirmed checkout action. Never simulates settlement. */
  async payInvoice(invoiceId: `0x${string}`, walletClient?: WalletClient): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
    if (!/^0x[a-fA-F0-9]{64}$/.test(invoiceId)) throw new Error("Invoice ID must be a bytes32 hex value");
    const wallet = walletClient || this.walletClient;
    if (!wallet) throw new Error("Connect a wallet before paying");
    if (await wallet.getChainId() !== whitechainSepolia.id || await this.publicClient.getChainId() !== whitechainSepolia.id) throw new Error("Wallet and RPC must both use Whitechain Sepolia (1874)");
    const account = wallet.account || (await wallet.getAddresses())[0];
    if (!account) throw new Error("Connect and authorize a wallet account before paying");
    const payer = typeof account === "string" ? account : account.address;
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice || invoice.status !== "OPEN" || invoice.dueAt < Date.now()/1000) throw new Error("Invoice is missing, expired or already paid");
    if (invoice.customer && invoice.customer.toLowerCase() !== payer.toLowerCase()) throw new Error("Invoice belongs to another customer");
    const token = await this.publicClient.readContract({ address: this.contractAddress, abi: pulsePayMerchantHubAbi, functionName: "USDT" });
    if (token.toLowerCase() !== this.usdtAddress.toLowerCase()) throw new Error("Merchant hub settlement token does not match configuration");
    if (await this.getUsdtAllowance(payer) < invoice.amountUnits) {
      const hash = await wallet.sendTransaction({ account, chain: whitechainSepolia, ...this.encodeApproveUsdt(invoice.amountUnits) });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("USDT approval reverted");
    }
    const hash = await wallet.sendTransaction({ account, chain: whitechainSepolia, ...this.encodePayInvoice(invoiceId) });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Payment reverted: ${hash}`);
    const settled = receipt.logs.some(log => {
      if (log.address.toLowerCase() !== this.contractAddress.toLowerCase()) return false;
      try {
        const event = decodeEventLog({ abi: pulsePayMerchantHubAbi, data: log.data, topics: log.topics });
        return event.eventName === "PaymentSettled" && event.args.invoiceId === invoiceId
          && event.args.customer.toLowerCase() === payer.toLowerCase() && event.args.amount === invoice.amountUnits;
      } catch { return false; }
    });
    if (!settled) throw new Error(`Payment receipt has no matching settlement event: ${hash}`);
    return { txHash: receipt.transactionHash, receipt };
  }

  /**
   * Create an invoice onchain.
   * Awaits confirmation and parses receipt logs for the assigned invoiceId.
   */
  async createInvoice(
    args: CreateInvoiceArgs,
    walletClient?: WalletClient
  ): Promise<{ invoiceId: `0x${string}`; txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account } = await this.getAccount(walletClient);

    const invoiceId = args.invoiceId || generateRandomBytes32();
    const customer = args.customer || "0x0000000000000000000000000000000000000000";
    const dueAt = BigInt(args.dueAtSeconds || Math.floor(Date.now() / 1000) + 7 * 86400);
    const metadataHash =
      args.metadataHash ||
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "createInvoice",
      args: [invoiceId, customer, args.amountUnits, dueAt, metadataHash],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    let finalInvoiceId = invoiceId;
    try {
      const logs = parseEventLogs({
        abi: pulsePayMerchantHubAbi,
        eventName: "InvoiceCreated",
        logs: receipt.logs,
      });
      if (logs.length > 0 && logs[0].args.invoiceId) {
        finalInvoiceId = logs[0].args.invoiceId;
      }
    } catch {
      // fallback to generated ID
    }

    return { invoiceId: finalInvoiceId, txHash, receipt };
  }

  /**
   * Cancel an open invoice onchain.
   */
  async cancelInvoice(
    invoiceId: `0x${string}`,
    walletClient?: WalletClient
  ): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account } = await this.getAccount(walletClient);

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "cancelInvoice",
      args: [invoiceId],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  /**
   * Issue a verifiable partial or full refund against a settled invoice.
   */
  async issueRefund(
    invoiceId: `0x${string}`,
    amountUnits: bigint,
    reasonOrHash?: string | `0x${string}`,
    walletClient?: WalletClient
  ): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account } = await this.getAccount(walletClient);

    let reasonHash: `0x${string}`;
    if (!reasonOrHash) {
      reasonHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    } else if (typeof reasonOrHash === "string" && reasonOrHash.startsWith("0x") && reasonOrHash.length === 66) {
      reasonHash = reasonOrHash as `0x${string}`;
    } else {
      reasonHash = keccak256(stringToHex(reasonOrHash));
    }

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "issueRefund",
      args: [invoiceId, amountUnits, reasonHash],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  /**
   * Withdraw from merchant available settlement balance to a designated recipient.
   */
  async withdrawAvailable(
    amountUnits: bigint,
    to?: `0x${string}`,
    walletClient?: WalletClient
  ): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account, address } = await this.getAccount(walletClient);
    const recipient = to || address;

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "withdrawAvailable",
      args: [amountUnits, recipient],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  /**
   * Create a recurring subscription billing plan onchain.
   */
  async createPlan(
    args: CreatePlanArgs,
    walletClient?: WalletClient
  ): Promise<{ planId: `0x${string}`; txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account } = await this.getAccount(walletClient);

    const planId = args.planId || generateRandomBytes32();

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "createPlan",
      args: [planId, args.amountPerCycleUnits, BigInt(args.intervalSeconds), args.maxCycles],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    let finalPlanId = planId;
    try {
      const logs = parseEventLogs({
        abi: pulsePayMerchantHubAbi,
        eventName: "PlanCreated",
        logs: receipt.logs,
      });
      if (logs.length > 0 && logs[0].args.planId) {
        finalPlanId = logs[0].args.planId;
      }
    } catch {
      // fallback
    }

    return { planId: finalPlanId, txHash, receipt };
  }

  /**
   * Authorize and activate a recurring subscription, paying cycle 1.
   */
  async createSubscription(
    subscriptionId: `0x${string}`,
    planId: `0x${string}`,
    walletClient?: WalletClient
  ): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account, address } = await this.getAccount(walletClient);

    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found on contract`);
    }

    // Check USDT allowance for 1st cycle
    const allowance = await this.getUsdtAllowance(address);
    if (allowance < plan.amountPerCycleUnits) {
      const approveHash = await client.writeContract({
        address: this.usdtAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [this.contractAddress, plan.amountPerCycleUnits * 12n],
        account,
        chain: client.chain || whitechainSepolia,
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "createSubscription",
      args: [subscriptionId, planId],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  /**
   * Execute an automated due renewal for an active subscription.
   */
  async chargeRenewal(
    subscriptionId: `0x${string}`,
    renewalId?: `0x${string}`,
    walletClient?: WalletClient
  ): Promise<{ renewalId: `0x${string}`; txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account } = await this.getAccount(walletClient);

    const finalRenewalId = renewalId || generateRandomBytes32();

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "chargeRenewal",
      args: [subscriptionId, finalRenewalId],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { renewalId: finalRenewalId, txHash, receipt };
  }

  /**
   * Cancel an active subscription.
   */
  async cancelSubscription(
    subscriptionId: `0x${string}`,
    walletClient?: WalletClient
  ): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account } = await this.getAccount(walletClient);

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "cancelSubscription",
      args: [subscriptionId],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  /**
   * Fund merchant refund reserve with additional USDT liquidity.
   */
  async fundRefundReserve(
    amountUnits: bigint,
    walletClient?: WalletClient
  ): Promise<{ txHash: `0x${string}`; receipt: TransactionReceipt }> {
    const { client, account, address } = await this.getAccount(walletClient);

    const allowance = await this.getUsdtAllowance(address);
    if (allowance < amountUnits) {
      const approveHash = await client.writeContract({
        address: this.usdtAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [this.contractAddress, amountUnits],
        account,
        chain: client.chain || whitechainSepolia,
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    const txHash = await client.writeContract({
      address: this.contractAddress,
      abi: pulsePayMerchantHubAbi,
      functionName: "fundRefundReserve",
      args: [amountUnits],
      account,
      chain: client.chain || whitechainSepolia,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, receipt };
  }

  // --- Write Helpers (Returns transaction data for offline / manual wallet submission) ---

  encodeApproveUsdt(amountUnits: bigint = parseUnits("1000000", WHITECHAIN_USDT_DECIMALS)) {
    return {
      to: this.usdtAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [this.contractAddress, amountUnits],
      }),
    };
  }

  encodeCreateInvoice(
    invoiceId: `0x${string}`,
    customer: `0x${string}` = "0x0000000000000000000000000000000000000000",
    amountUnits: bigint,
    dueAtSeconds: number,
    metadataHash: `0x${string}` = "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "createInvoice",
        args: [invoiceId, customer, amountUnits, BigInt(dueAtSeconds), metadataHash],
      }),
    };
  }

  encodeCancelInvoice(invoiceId: `0x${string}`) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "cancelInvoice",
        args: [invoiceId],
      }),
    };
  }

  encodePayInvoice(invoiceId: `0x${string}`) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "payInvoice",
        args: [invoiceId],
      }),
    };
  }

  encodeIssueRefund(
    invoiceId: `0x${string}`,
    refundAmountUnits: bigint,
    reasonHash: `0x${string}` = "0x0000000000000000000000000000000000000000000000000000000000000000"
  ) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "issueRefund",
        args: [invoiceId, refundAmountUnits, reasonHash],
      }),
    };
  }

  encodeCreatePlan(
    planId: `0x${string}`,
    amountPerCycleUnits: bigint,
    intervalSeconds: number,
    maxCycles: number
  ) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "createPlan",
        args: [planId, amountPerCycleUnits, BigInt(intervalSeconds), maxCycles],
      }),
    };
  }

  encodeCreateSubscription(subscriptionId: `0x${string}`, planId: `0x${string}`) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "createSubscription",
        args: [subscriptionId, planId],
      }),
    };
  }

  encodeChargeRenewal(subscriptionId: `0x${string}`, renewalId: `0x${string}`) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "chargeRenewal",
        args: [subscriptionId, renewalId],
      }),
    };
  }

  encodeCancelSubscription(subscriptionId: `0x${string}`) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "cancelSubscription",
        args: [subscriptionId],
      }),
    };
  }

  encodeWithdrawAvailable(amountUnits: bigint, to: `0x${string}`) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "withdrawAvailable",
        args: [amountUnits, to],
      }),
    };
  }

  encodeFundRefundReserve(amountUnits: bigint) {
    return {
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: pulsePayMerchantHubAbi,
        functionName: "fundRefundReserve",
        args: [amountUnits],
      }),
    };
  }
}
