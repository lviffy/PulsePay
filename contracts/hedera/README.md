# PulsePay on Hedera EVM

`PulsePayHederaMerchantHub` settles one configured ERC-20 or HIP-218 HTS token and uses the Hedera Schedule Service system contract at `0x16b` for autonomous subscription renewals.

Build and test:

```bash
pnpm contracts:hedera:build
pnpm contracts:hedera:test
```

Deploy to chain 296 after setting an ECDSA deployer key and a verified testnet token address:

```bash
export HEDERA_EVM_SETTLEMENT_TOKEN_ADDRESS=0x...
export HEDERA_EVM_ASSOCIATE_HTS=true
forge script script/DeployMerchantHub.s.sol:DeployMerchantHub \
  --rpc-url hedera_testnet --private-key "$HEDERA_EVM_DEPLOYER_KEY" --broadcast
```

The contract must hold HBAR to pay for scheduled executions. Fund it with `fundExecution()` or attach HBAR when creating or re-arming a subscription. Token amounts and HBAR execution funds use separate accounting.

For each subscription, the subscriber fixes the token, amount, interval, maximum cycles, cumulative spend cap and expiry. Cancellation increments a generation counter before schedule deletion, preventing a stale scheduled callback from charging even when deletion fails.

The deployment script performs HTS association by default. Set `HEDERA_EVM_ASSOCIATE_HTS=false` only for a conventional Solidity ERC-20 or a test token that does not require association.

