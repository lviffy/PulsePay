import { getAddress, isAddress, type Address, type Hash } from "viem";
import { z } from "zod";
import { BaseTool, HederaContext } from "../types.js";
import { hederaMerchantHubAbi, settlementTokenAbi } from "../hedera-evm.js";

export const HEDERA_EVM_INVOICE_PAY_TOOL = "hedera_evm_invoice_pay_tool";
const addressSchema = z.string().refine(isAddress, "Invalid EVM address").transform(value => getAddress(value));
const amountSchema = z.union([z.string().regex(/^\d+$/), z.bigint()]).transform(value => BigInt(value)).refine(value => value > 0n, "Amount must be positive");
const schema = z.object({
  chainId: z.literal(296),
  hubAddress: addressSchema,
  tokenAddress: addressSchema,
  merchantAddress: addressSchema,
  payerAddress: addressSchema,
  invoiceId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  amountUnits: amountSchema,
  challengeId: z.string().regex(/^[a-f0-9]{32}$/),
});
export type HederaEvmInvoicePayParams = z.infer<typeof schema>;

export class HederaEvmInvoicePayTool extends BaseTool {
  readonly method = HEDERA_EVM_INVOICE_PAY_TOOL;
  readonly name = "Hedera EVM Invoice Pay Tool";
  readonly description = "Validate, approve and pay a PulsePay settlement-token invoice on Hedera EVM.";
  readonly parameters = schema;
  override toolType = "transaction" as const;

  async normalizeParams(params: unknown): Promise<HederaEvmInvoicePayParams> { return schema.parse(params); }

  async coreAction(params: HederaEvmInvoicePayParams, context: HederaContext) {
    const client = context.evmPublicClient;
    if (!client) throw new Error("A Hedera EVM public client is required");
    if (await client.getChainId() !== params.chainId) throw new Error("Hedera EVM RPC chain does not match the challenge");
    const hubAddress = params.hubAddress as Address;
    const token = await client.readContract({ address: hubAddress, abi: hederaMerchantHubAbi, functionName: "settlementToken" }) as Address;
    if (token.toLowerCase() !== params.tokenAddress.toLowerCase()) throw new Error("Hub settlement token does not match the challenge");
    const invoice = await client.readContract({ address: hubAddress, abi: hederaMerchantHubAbi, functionName: "getInvoice", args: [params.invoiceId] }) as readonly [Hash, Address, Address, bigint, bigint, number, Hash];
    const [, merchant, customer, amount, dueAt, status] = invoice;
    if (status !== 1) throw new Error("Invoice is not open");
    if (merchant.toLowerCase() !== params.merchantAddress.toLowerCase()) throw new Error("Invoice merchant does not match the challenge");
    if (customer !== "0x0000000000000000000000000000000000000000" && customer.toLowerCase() !== params.payerAddress.toLowerCase()) throw new Error("Invoice is assigned to another payer");
    if (amount !== params.amountUnits) throw new Error("Invoice amount does not match the challenge");
    if (dueAt < BigInt(Math.floor(Date.now() / 1000))) throw new Error("Invoice has expired");
    const allowance = await client.readContract({ address: params.tokenAddress as Address, abi: settlementTokenAbi, functionName: "allowance", args: [params.payerAddress as Address, hubAddress] }) as bigint;
    return { params, needsApproval: allowance < params.amountUnits };
  }

  async secondaryAction(action: Awaited<ReturnType<HederaEvmInvoicePayTool["coreAction"]>>, _client: unknown, context: HederaContext) {
    const publicClient = context.evmPublicClient;
    const walletClient = context.evmWalletClient;
    if (!publicClient || !walletClient) throw new Error("A Hedera EVM public and wallet client are required");
    const [account] = await walletClient.getAddresses();
    if (!account || account.toLowerCase() !== action.params.payerAddress.toLowerCase()) throw new Error("Connected EVM signer is not the challenged payer");
    if (action.needsApproval) {
      const approval = await publicClient.simulateContract({ account, address: action.params.tokenAddress, abi: settlementTokenAbi, functionName: "approve", args: [action.params.hubAddress, action.params.amountUnits] });
      context.submissionStarted = true;
      const approvalHash = await walletClient.writeContract(approval.request) as string;
      context.onEvmTransactionSubmitted?.(approvalHash, "approval");
      const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      if (approvalReceipt.status !== "success") throw new Error("Settlement-token approval reverted");
      context.submissionStarted = false;
    }
    const payment = await publicClient.simulateContract({ account, address: action.params.hubAddress, abi: hederaMerchantHubAbi, functionName: "payInvoice", args: [action.params.invoiceId] });
    context.submissionStarted = true;
    const transactionHash = await walletClient.writeContract(payment.request) as string;
    context.onEvmTransactionSubmitted?.(transactionHash, "payment");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (receipt.status !== "success") throw new Error("Invoice payment reverted");
    return {
      status: "SETTLED",
      scheme: "hedera-evm-invoice-receipt",
      chainId: action.params.chainId,
      transactionHash,
      invoiceId: action.params.invoiceId,
      merchantAddress: action.params.merchantAddress,
      tokenAddress: action.params.tokenAddress,
      amountUnits: action.params.amountUnits.toString(),
      hashScanUrl: `https://hashscan.io/testnet/transaction/${transactionHash}`,
    };
  }
}

