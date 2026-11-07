#!/usr/bin/env node

/**
 * Read-only deployment diagnostic for the proposed Whitechain bridge.
 *
 * Whitechain is not configured as a direct CCIP source in this repository.
 * This script deliberately refuses to build deposit transactions until the
 * bridge, mapper, destination settlement contract, and relayer are deployed.
 */

import {
  createPublicClient,
  http,
  WHITECHAIN_USDT_ADDRESS,
  DEFAULT_WHITECHAIN_BRIDGE_ADDRESS,
  DEFAULT_WHITECHAIN_MAPPER_ADDRESS,
} from "../packages/adapter-ccip/dist/index.js";

const rpcUrl = process.env.WHITECHAIN_RPC_URL || "https://rpc.testnet.whitechain.io";

async function main() {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await client.getChainId();
  if (chainId !== 1874) {
    throw new Error(`Whitechain RPC returned chain ID ${chainId}; expected 1874`);
  }

  const [tokenCode, bridgeCode, mapperCode] = await Promise.all([
    client.getBytecode({ address: WHITECHAIN_USDT_ADDRESS }),
    client.getBytecode({ address: DEFAULT_WHITECHAIN_BRIDGE_ADDRESS }),
    client.getBytecode({ address: DEFAULT_WHITECHAIN_MAPPER_ADDRESS }),
  ]);

  const deployment = {
    chainId,
    token: { address: WHITECHAIN_USDT_ADDRESS, deployed: Boolean(tokenCode) },
    bridge: { address: DEFAULT_WHITECHAIN_BRIDGE_ADDRESS, deployed: Boolean(bridgeCode) },
    mapper: { address: DEFAULT_WHITECHAIN_MAPPER_ADDRESS, deployed: Boolean(mapperCode) },
  };
  console.log(JSON.stringify(deployment, null, 2));

  if (!tokenCode || !bridgeCode || !mapperCode) {
    throw new Error("Whitechain bridge is not configured: one or more required contracts are not deployed");
  }

  throw new Error(
    "Whitechain bridge remains disabled until a destination settlement contract and relayer are implemented and tested"
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
