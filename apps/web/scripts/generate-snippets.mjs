import { codeToHtml } from "shiki";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(__dirname, "../src/lib/sdk-snippets.ts");

const theme = {
  name: "pulsepay",
  type: "dark",
  colors: { "editor.background": "#181816", "editor.foreground": "#eae8df" },
  tokenColors: [
    { scope: ["comment", "punctuation"], settings: { foreground: "#797870" } },
    { scope: ["keyword", "storage", "keyword.control"], settings: { foreground: "#f27b25" } },
    { scope: ["string", "string.quoted"], settings: { foreground: "#b4d396" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "#ede9df" } },
    { scope: ["variable", "variable.other", "entity.name.type"], settings: { foreground: "#dedcd4" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#f09858" } }
  ]
};

const rawSnippets = [
  {
    id: "react",
    tab: "React",
    badge: "TSX",
    category: "FRONTEND CHECKOUT",
    filename: "packages/sdk-react/examples/checkout-page.tsx",
    lang: "tsx",
    pkg: "@pulsepay/sdk-react",
    installCmd: "pnpm add @pulsepay/sdk-react viem",
    summary: "Drop-in React checkout modal with multi-chain invoice polling and receipt view.",
    highlights: [
      "Zero iframe embeds — native React component",
      "Automatic Whitechain Sepolia chain switching",
      "Instant invoice polling & receipt verification",
      "Direct USDT settlement on Chain ID 1874"
    ],
    simulation: {
      type: "react",
      invoiceId: "0x7a3f89b421d09ec7846522c019a3bb9412f5a603947812eac7889123456789ab",
      amount: "25.00",
      asset: "USDT",
      network: "Whitechain Sepolia (1874)",
      merchant: "0x98b827eE3fC0f21557dFeC5a1b5dE86118d2A84F",
      dueIn: "23h 58m"
    },
    code: `import React, { useState } from "react";
import { PulsePayProvider, PulsePayCheckout, PulsePayReceipt } from "@pulsepay/sdk-react";
import type { PulsePayConfig } from "@pulsepay/sdk-core";

// 1. Configure PulsePay client for Whitechain Sepolia & Hedera Testnet
const config: PulsePayConfig = {
  whitechain: {
    rpcUrl: "https://rpc-testnet.whitechain.io",
    merchantHubAddress: "0x7894F749B28Aca8A79c6B18D3b584742f36fB4C5",
    settlementTokenAddress: "0x2e061806ebde9eeb7ce9466ad13fecfeab362b51" // USDT
  },
  hedera: {
    network: "testnet",
    merchantAccount: "0.0.5482910"
  }
};

export function CheckoutModal({ invoiceId }: { invoiceId: \`0x\${string}\` }) {
  const [settledHash, setSettledHash] = useState<string | null>(null);

  return (
    <PulsePayProvider config={config}>
      <div className="pulsepay-checkout-shell">
        {!settledHash ? (
          <PulsePayCheckout
            invoiceId={invoiceId}
            enablePayWithAnyToken={false}
            onSuccess={(txHash) => {
              console.log("Invoice settled on Whitechain:", txHash);
              setSettledHash(txHash);
            }}
            onError={(err) => {
              console.error("Payment failed:", err.message);
            }}
          />
        ) : (
          <PulsePayReceipt
            invoiceId={invoiceId}
            txHash={settledHash}
            explorerUrl={\`https://testnet.whitechain.io/tx/\${settledHash}\`}
          />
        )}
      </div>
    </PulsePayProvider>
  );
}`
  },
  {
    id: "server",
    tab: "Server",
    badge: "Node.js",
    category: "BACKEND MIDDLEWARE",
    filename: "packages/sdk-server/src/x402.ts",
    lang: "typescript",
    pkg: "@pulsepay/sdk-server",
    installCmd: "pnpm add @pulsepay/sdk-server",
    summary: "HTTP 402 Payment Required middleware with Hedera mirror consensus verification.",
    highlights: [
      "Zero-database bearer challenge issuance",
      "Direct Hedera mirror node consensus verification",
      "Replay attack defense via secret challengeId hashing",
      "Framework agnostic (Express, Hono, Next.js, Fastify)"
    ],
    simulation: {
      type: "server",
      endpoint: "POST /api/v1/agent-query",
      price: "0.5 HBAR (~50,000,000 tinybars)",
      network: "Hedera Testnet (0.0.5482910)",
      challenge: "8a1e4fd29b042c16e537d94bc0281a9f",
      consensusTx: "0.0.5482910@1731002345.109283746"
    },
    code: `import { handleX402PaymentCheck, type X402RouteConfig } from "@pulsepay/sdk-server";
import { HederaMirrorClient } from "@pulsepay/adapter-hedera";

// 1. Define payment requirement for autonomous machine endpoints
const x402Config: X402RouteConfig = {
  serviceId: "agent-ai-service-v1",
  serviceName: "PulsePay High-Speed Agent Inference",
  price: {
    network: "hedera:testnet",
    asset: "0.0.0",               // Native HBAR
    amountTinybars: "50000000",   // 0.5 HBAR per inference call
    payTo: "0.0.5482910"          // Merchant Hedera Account ID
  },
  statePath: ".pulsepay/challenges.json",
  maxPendingChallenges: 1000
};

// 2. Protect any Express, Hono, Next.js, or SvelteKit route
export async function POST(request: Request): Promise<Response> {
  const paymentProof = request.headers.get("payment-signature");

  // Validates proof against Hedera mirror node consensus & prevents replays
  const result = await handleX402PaymentCheck(x402Config, paymentProof);

  if (!result.authorized) {
    // Issues 402 Payment Required with challengeId & payment instructions
    return new Response(JSON.stringify(result.body), {
      status: result.statusCode,
      headers: result.headers
    });
  }

  // Payment verified on Hedera! Return the protected AI service payload
  return new Response(
    JSON.stringify({
      status: "success",
      output: "Autonomous inference result from agent cluster",
      consensusTimestamp: result.body.consensusTimestamp
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}`
  },
  {
    id: "agent",
    tab: "Agent",
    badge: "AI Worker",
    category: "AUTONOMOUS AGENT",
    filename: "apps/agent-worker/src/index.ts",
    lang: "typescript",
    pkg: "@pulsepay/adapter-hedera",
    installCmd: "pnpm add @pulsepay/adapter-hedera viem",
    summary: "Autonomous AI agent payment worker with spend limit policies and HCS audit logging.",
    highlights: [
      "PulsePayTokenSpendPolicy: Hard per-call and daily budget limits",
      "PulsePayHcsAuditHook: Immutable consensus record on Hedera HCS",
      "Automatic HTTP 402 challenge capture and settlement dispatch",
      "Zero human-in-the-loop required for machine-to-machine services"
    ],
    simulation: {
      type: "agent",
      topicId: "0.0.5482920",
      budget: "10.00 USDT Daily / 1.00 USDT Max Per Call",
      currentSpend: "0.50 HBAR",
      hcsSequence: "#14,291",
      status: "POLICY PASSED · CONSENSUS CONFIRMED"
    },
    code: `import { 
  PulsePaySpendLimitPolicy, 
  PulsePayTokenSpendPolicy, 
  PulsePayHcsAuditHook, 
  HederaEvmInvoicePayTool,
  hederaTestnet 
} from "@pulsepay/adapter-hedera";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// 1. Initialize agent signer with EVM and Hedera capabilities
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as \`0x\${string}\`);
const publicClient = createPublicClient({ chain: hederaTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: hederaTestnet, transport: http() });

// 2. Enforce hard guardrails: 10 USDT daily budget, 1 USDT per request
const spendPolicy = new PulsePayTokenSpendPolicy({
  chainId: 296,
  tokenAddress: "0x2e061806ebde9eeb7ce9466ad13fecfeab362b51",
  dailyBudgetUnits: 10_000_000n,
  maxPerRequestUnits: 1_000_000n,
  hubAllowlist: ["0x7894F749B28Aca8A79c6B18D3b584742f36fB4C5"]
});

// 3. Immutable audit logging on Hedera Consensus Service (HCS)
const auditHook = new PulsePayHcsAuditHook({
  topicId: process.env.HEDERA_AUDIT_TOPIC_ID || "0.0.5482920"
});

// 4. Register hooks into the autonomous payment tool
const payTool = new HederaEvmInvoicePayTool();
payTool.registerHook(spendPolicy);
payTool.registerHook(auditHook);

export async function executeAgentTask(targetApiUrl: string) {
  // Step 1: Probe endpoint — receives HTTP 402 challenge
  const probe = await fetch(targetApiUrl);
  if (probe.status !== 402) return probe.json();

  const challenge = JSON.parse(probe.headers.get("payment-required")!);
  
  // Step 2: Policy validation & autonomous on-chain settlement
  const settlement = await payTool.execute(challenge, { publicClient, walletClient });

  // Step 3: Dispatch cryptographic receipt proof & retrieve data
  const authenticatedRes = await fetch(targetApiUrl, {
    headers: { "PAYMENT-SIGNATURE": JSON.stringify(settlement) }
  });

  return authenticatedRes.json();
}`
  },
  {
    id: "contracts",
    tab: "Contracts",
    badge: "Solidity",
    category: "SETTLEMENT HUB",
    filename: "contracts/whitechain/src/PulsePayMerchantHub.sol",
    lang: "solidity",
    pkg: "PulsePayMerchantHub.sol",
    installCmd: "forge install OpenZeppelin/openzeppelin-contracts",
    summary: "Non-custodial merchant settlement hub with reserve-backed verifiable refunds.",
    highlights: [
      "Exact USDT transfers without price slippage",
      "Configurable refund reserve escrow (default 1.5%)",
      "Gas-optimized nonReentrant execution on Whitechain",
      "Subscription recurring billing cycles with nonce safety"
    ],
    simulation: {
      type: "contracts",
      hubAddress: "0x7894F749B28Aca8A79c6B18D3b584742f36fB4C5",
      usdtAddress: "0x2e061806ebde9eeb7ce9466ad13fecfeab362b51",
      gasUsed: "64,820 gas",
      feeBps: "50 bps (0.5%)",
      reserveBps: "150 bps (1.5%)"
    },
    code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PulsePayMerchantHub
 * @notice Core merchant settlement contract on Whitechain Sepolia.
 * Handles invoices, exact USDT stablecoin payments, reserve-backed verifiable refunds.
 */
contract PulsePayMerchantHub is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum InvoiceStatus { NONE, OPEN, PAID, EXPIRED, CANCELLED }

    struct Invoice {
        bytes32 invoiceId;
        address merchant;
        address customer;
        uint256 amount;
        uint64 dueAt;
        InvoiceStatus status;
        bytes32 metadataHash;
    }

    /// @notice Settle invoice with exact USDT, splitting net to merchant and reserve cut
    function payInvoice(bytes32 invoiceId) external nonReentrant {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.OPEN, "Invoice not payable");
        require(block.timestamp <= inv.dueAt, "Invoice expired");

        uint256 fee = (inv.amount * feeBasisPoints) / 10000;
        uint256 reserveCut = (inv.amount * reserveRatioBps) / 10000;
        uint256 merchantNet = inv.amount - fee - reserveCut;

        inv.status = InvoiceStatus.PAID;
        merchantReserveBalance[inv.merchant] += reserveCut;

        settlementToken.safeTransferFrom(msg.sender, inv.merchant, merchantNet);
        settlementToken.safeTransferFrom(msg.sender, address(this), reserveCut + fee);

        emit InvoicePaid(invoiceId, msg.sender, inv.amount, merchantNet, reserveCut);
    }
}`
  },
  {
    id: "skill",
    tab: "Skill",
    badge: "MCP",
    category: "AI AGENT SKILL",
    filename: "skills/pulsepay/SKILL.md",
    lang: "markdown",
    pkg: "skills/pulsepay",
    installCmd: "npx skills add https://github.com/lviffy/PulsePay --skill pulsepay",
    summary: "Standard Agent Skills specification for Cursor, Claude Code, Windsurf, Copilot, and Antigravity.",
    highlights: [
      "Natural language prompts for invoicing, 402 payments, and CCIP bridging",
      "One-command installation into any modern AI code agent",
      "Cross-chain testnet tool bindings (Whitechain, Hedera, Sepolia)",
      "Hedera HCS consensus verification and mirror transaction lookup"
    ],
    simulation: {
      type: "skill",
      supportedAgents: "Claude Code · Cursor · Windsurf · Antigravity · Copilot",
      toolCount: "6 Automated Tools (Invoices, x402, CCIP, Reserves, HCS, CSV)",
      version: "v1.0.0"
    },
    code: `---
name: pulsepay
description: >
  Integrate PulsePay payment rails, merchant invoicing, refund reserves, Hedera
  x402 autonomous machine payments, and Chainlink CCIP 2.0 token bridging.
version: 1.0.0
---

# PulsePay AI Agent Skill

Universal merchant billing, cross-chain token bridging, and autonomous payments 
across Whitechain, Chainlink CCIP 2.0, and Hedera.

## Quick Installation

\`\`\`bash
# Universal (Auto-detects Cursor, Claude Code, Windsurf, Copilot, Antigravity)
npx skills add https://github.com/lviffy/PulsePay --skill pulsepay
\`\`\`

## Supported Agent Directives

1. **Merchant Invoicing on Whitechain**:
   "Generate an on-chain invoice for 25 USDT on Whitechain Sepolia due tomorrow"

2. **Autonomous Machine Payments (HTTP 402)**:
   "Pay HTTP 402 payment challenge using Hedera native HBAR within 1 HBAR limit"

3. **Chainlink CCIP Token Bridging**:
   "Bridge 50 USDT from Ethereum Sepolia to Hedera Testnet via CCIP lane"

4. **Reserve-Backed Refunds & HCS Audit**:
   "Verify merchant refund reserve ratio and query consensus timestamp on Hedera HCS"`
  }
];

async function generate() {
  console.log("Generating highlighted SDK snippets...");
  const snippets = [];
  for (const item of rawSnippets) {
    const html = await codeToHtml(item.code, { lang: item.lang, theme });
    snippets.push({
      ...item,
      html
    });
  }

  const fileContent = `// Automatically generated by scripts/generate-snippets.mjs
// DO NOT EDIT DIRECTLY. Run "node scripts/generate-snippets.mjs" to regenerate.

export interface SdkSnippet {
  id: string;
  tab: string;
  badge: string;
  category: string;
  filename: string;
  lang: string;
  pkg: string;
  installCmd: string;
  summary: string;
  highlights: string[];
  simulation: Record<string, any>;
  code: string;
  html: string;
}

export const sdkSnippets: SdkSnippet[] = ${JSON.stringify(snippets, null, 2)};

export const defaultSnippet = sdkSnippets[0];
`;

  writeFileSync(outFile, fileContent, "utf8");
  console.log(`Generated ${snippets.length} snippets in ${outFile}`);
}

generate().catch(console.error);

