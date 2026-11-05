import { defineChain, type Chain } from "viem";

/**
 * Whitechain Sepolia testnet definition per whitechain-dev playbook
 */
export const whitechainSepolia: Chain = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.whitechain.io"],
      webSocket: ["wss://rpc.testnet.whitechain.io/ws"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.testnet.whitechain.io",
      apiUrl: "https://explorer.testnet.whitechain.io/api/v2",
    },
  },
  testnet: true,
});

