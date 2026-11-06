import {
  createPublicClient,
  http,
  PublicClient,
  WalletClient,
  parseUnits,
  encodeFunctionData,
  decodeEventLog,
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

  // --- Read Methods ---

  /** The caller invokes this from a wallet-confirmed checkout action. Never simulates settlement. */
  async payInvoice(invoiceId: `0x${string}`): Promise<`0x${string}`> {
    if (!/^0x[a-fA-F0-9]{64}$/.test(invoiceId)) throw new Error("Invoice ID must be a bytes32 hex value");
    const wallet = this.walletClient;
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
    return receipt.transactionHash;
  }

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

    return {
      invoiceId: data.invoiceId,
      merchant: data.merchant,
      customer: data.customer,
      amountPaidUnits: data.amountPaid,
      amountRefundedUnits: data.amountRefunded,
      paidAt: Number(data.paidAt),
      status: status as any,
      txHash: "0x" as `0x${string}`,
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

  // --- Write Helpers (Returns transaction data for wallet submission) ---

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

