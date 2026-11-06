import { CCIPBridgeAdapter } from '../packages/adapter-ccip/dist/index.js';

// Read-only diagnostics; positional arguments never include wallet credentials.
const [source, rpcUrl, destination, tokenAddress, recipientAddress, amount] = process.argv.slice(2);
if (!source || !rpcUrl || !destination) {
  console.error('Usage: node scripts/ccip-check.mjs <sourceChainId> <rpcUrl> <destinationChainId> [sourceToken recipient rawAmount]');
  process.exitCode = 1;
} else {
  try {
    const adapter = new CCIPBridgeAdapter({ chainId: Number(source), rpcUrl });
    const selector = adapter.resolveChainSelector(undefined, Number(destination));
    console.log(JSON.stringify({ lane: await adapter.checkLane(selector) }));
    if (tokenAddress || recipientAddress || amount) {
      if (!tokenAddress || !recipientAddress || !amount) throw new Error('Provide token, recipient and raw amount together');
      console.log(JSON.stringify({ quote: await adapter.quoteBridgeFee({
        destinationChainId: Number(destination), tokenAddress, recipientAddress, amountUnits: BigInt(amount),
      }) }));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
