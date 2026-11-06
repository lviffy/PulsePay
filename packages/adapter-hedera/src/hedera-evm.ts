import { defineChain, parseAbi, type Chain } from "viem";

export const hederaTestnet: Chain = defineChain({
  id: 296,
  name: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet.hashio.io/api"] } },
  blockExplorers: { default: { name: "HashScan", url: "https://hashscan.io/testnet" } },
  testnet: true,
});

export const hederaMerchantHubAbi = parseAbi([
  "function settlementToken() view returns (address)",
  "function createInvoice(bytes32 invoiceId,address customer,uint256 amount,uint64 dueAt,bytes32 metadataHash)",
  "function getInvoice(bytes32 invoiceId) view returns ((bytes32 invoiceId,address merchant,address customer,uint256 amount,uint64 dueAt,uint8 status,bytes32 metadataHash))",
  "function payInvoice(bytes32 invoiceId)",
  "event PaymentSettled(bytes32 indexed invoiceId,address indexed merchant,address indexed customer,uint256 amount,uint64 paidAt)",
]);

export const settlementTokenAbi = parseAbi([
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
]);

