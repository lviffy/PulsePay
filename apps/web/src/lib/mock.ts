/**
 * PulsePay Mock Data & Types
 * 
 * Rules:
 * - Amounts are integers in base units internally (BigInt or number representation)
 * - Format for display only via formatAmount()
 * - Statuses: PAID, OPEN, EXPIRED, PARTIAL REFUND, REFUNDED, ACTIVE, PENDING, SETTLED, REJECTED, AUDIT PENDING
 * - Ledger rows: chain, type, amount, status, tx link (null where missing)
 */

export type ChainId = 'whitechain' | 'hedera' | 'uniswap';

export type PaymentStatus =
  | 'PAID'
  | 'OPEN'
  | 'EXPIRED'
  | 'PARTIAL REFUND'
  | 'REFUNDED'
  | 'ACTIVE'
  | 'PENDING'
  | 'SETTLED'
  | 'REJECTED'
  | 'AUDIT PENDING';

export type CheckoutState =
  | 'WALLET_NOT_CONNECTED'
  | 'WRONG_NETWORK'
  | 'INSUFFICIENT_BALANCE'
  | 'APPROVAL_REQUIRED'
  | 'PENDING_CONFIRMATION'
  | 'REVERTED_REJECTED'
  | 'READY'
  | 'CONFIRMED';

export interface TokenOption {
  symbol: string;
  name: string;
  iconLetter: string;
  decimals: number;
  balanceBase: bigint;
  requiredBase: bigint;
  shortfallBase?: bigint;
  isShort: boolean;
}

export interface Invoice {
  id: string;
  customer: string;
  amountBase: bigint;
  token: string;
  decimals: number;
  via: string;
  status: PaymentStatus;
  createdAt: string;
  refundedBase?: bigint;
}

export interface Subscriber {
  id: string;
  address: string;
  nextCharge: string;
  cyclesCompleted: number;
  cyclesTotal: number;
  status: PaymentStatus;
  planId: string;
}

export interface AgentService {
  id: string;
  name: string;
  priceBase: bigint;
  token: string;
  decimals: number;
  network: string;
  manifestUrl: string;
}

export interface AgentActivity {
  id: string;
  time: string;
  agentAccount: string;
  amountBase: bigint;
  token: string;
  decimals: number;
  status: PaymentStatus;
  proofLabel: string;
  proofUrl: string | null;
}

export interface LedgerEntry {
  id: string;
  chain: 'Whitechain' | 'Hedera' | 'Uniswap';
  chainId: ChainId;
  type: string;
  amountFormatted: string;
  status: PaymentStatus;
  txLink: string | null;
  timestamp: string;
}

export interface SpendControls {
  enabled: boolean;
  dailyBudgetBase: bigint;
  maxPerRequestBase: bigint;
  perMerchantPerDayBase: bigint;
  humanApprovalAboveBase: bigint;
  merchantsAllowlist: string[];
  budgetUsedTodayBase: bigint;
  emergencyStopped: boolean;
  auditTopic: string;
}

export interface TreasuryPolicy {
  emergencyPaused: boolean;
  maxSwapSizeBase: bigint;
  sampleAllowedBase: bigint;
  sampleRejectedBase: bigint;
}

// Utility: format base unit integers to display strings
export function formatBaseUnits(amountBase: bigint, decimals: number = 6, showSymbol = ''): string {
  const isNegative = amountBase < 0n;
  const abs = isNegative ? -amountBase : amountBase;
  const divisor = 10n ** BigInt(decimals);
  const integerPart = abs / divisor;
  const fractionPart = abs % divisor;

  const fractionStr = fractionPart.toString().padStart(decimals, '0');
  // Trim trailing zeroes but keep up to 4 or 2 decimals
  const displayDecimals = decimals > 6 ? 4 : 2;
  const trimmedFraction = fractionStr.slice(0, displayDecimals);

  const formattedNum = `${isNegative ? '-' : ''}${integerPart.toLocaleString('en-US')}${
    displayDecimals > 0 ? '.' + trimmedFraction : ''
  }`;

  return showSymbol ? `${formattedNum} ${showSymbol}` : formattedNum;
}

// Initial Mock Datasets
export const initialInvoices: Invoice[] = [
  {
    id: 'inv_123',
    customer: '0x3f...a91',
    amountBase: 20_000_000n, // 20.00 USDT
    token: 'USDT',
    decimals: 6,
    via: 'WETH swap',
    status: 'PAID',
    createdAt: '2026-11-05T14:22:00Z'
  },
  {
    id: 'inv_122',
    customer: '0x91...c20',
    amountBase: 50_000_000n, // 50.00 USDT
    token: 'USDT',
    decimals: 6,
    via: 'USDT',
    status: 'PARTIAL REFUND',
    refundedBase: 5_000_000n, // 5.00 USDT refunded
    createdAt: '2026-11-05T12:05:00Z'
  },
  {
    id: 'inv_121',
    customer: '0xab...77e',
    amountBase: 20_000_000n, // 20.00 USDT
    token: 'USDT',
    decimals: 6,
    via: 'USDT',
    status: 'PAID',
    createdAt: '2026-11-05T09:30:00Z'
  },
  {
    id: 'inv_120',
    customer: '—',
    amountBase: 120_000_000n, // 120.00 USDT
    token: 'USDT',
    decimals: 6,
    via: '—',
    status: 'OPEN',
    createdAt: '2026-11-04T18:15:00Z'
  },
  {
    id: 'inv_119',
    customer: '—',
    amountBase: 20_000_000n, // 20.00 USDT
    token: 'USDT',
    decimals: 6,
    via: '—',
    status: 'EXPIRED',
    createdAt: '2026-11-03T11:00:00Z'
  }
];

export const initialSubscribers: Subscriber[] = [
  {
    id: 'sub_1',
    address: '0x3f...a91',
    nextCharge: '05 Dec',
    cyclesCompleted: 2,
    cyclesTotal: 12,
    status: 'ACTIVE',
    planId: 'plan_pro'
  },
  {
    id: 'sub_2',
    address: '0x91...c20',
    nextCharge: '11 Dec',
    cyclesCompleted: 5,
    cyclesTotal: 12,
    status: 'ACTIVE',
    planId: 'plan_pro'
  },
  {
    id: 'sub_3',
    address: '0xab...77e',
    nextCharge: 'retry 08 Nov',
    cyclesCompleted: 3,
    cyclesTotal: 12,
    status: 'PENDING',
    planId: 'plan_pro'
  },
  {
    id: 'sub_4',
    address: '0x5c...d04',
    nextCharge: 'cancelled',
    cyclesCompleted: 1,
    cyclesTotal: 12,
    status: 'REFUNDED',
    planId: 'plan_pro'
  },
  {
    id: 'sub_5',
    address: '0xe2...18b',
    nextCharge: '20 Dec',
    cyclesCompleted: 7,
    cyclesTotal: 12,
    status: 'ACTIVE',
    planId: 'plan_pro'
  },
  {
    id: 'sub_6',
    address: '0x77...f3a',
    nextCharge: '22 Dec',
    cyclesCompleted: 1,
    cyclesTotal: 12,
    status: 'ACTIVE',
    planId: 'plan_pro'
  }
];

export const initialAgentServices: AgentService[] = [
  {
    id: 'srv_1',
    name: 'market-data-basic',
    priceBase: 20_000n, // 0.02 USDC
    token: 'USDC',
    decimals: 6,
    network: 'hedera:testnet',
    manifestUrl: 'https://pulsepay.io/.well-known/x402.json'
  },
  {
    id: 'srv_2',
    name: 'ocr-lite',
    priceBase: 50_000n, // 0.05 USDC
    token: 'USDC',
    decimals: 6,
    network: 'hedera:testnet',
    manifestUrl: 'https://pulsepay.io/.well-known/x402.json'
  },
  {
    id: 'srv_3',
    name: 'search-pro',
    priceBase: 10_000n, // 0.01 USDC
    token: 'USDC',
    decimals: 6,
    network: 'hedera:testnet',
    manifestUrl: 'https://pulsepay.io/.well-known/x402.json'
  }
];

export const initialAgentActivities: AgentActivity[] = [
  {
    id: 'act_1',
    time: '10:42',
    agentAccount: '0.0.482...',
    amountBase: 20_000n,
    token: 'USDC',
    decimals: 6,
    status: 'SETTLED',
    proofLabel: 'HashScan ↗',
    proofUrl: 'https://hashscan.io/testnet/transaction/0.0.482001@1730000000'
  },
  {
    id: 'act_2',
    time: '10:44',
    agentAccount: '0.0.482...',
    amountBase: 9_000_000n, // 9.00 USDC
    token: 'USDC',
    decimals: 6,
    status: 'REJECTED',
    proofLabel: 'over cap',
    proofUrl: null
  }
];

export const initialSpendControls: SpendControls = {
  enabled: true,
  dailyBudgetBase: 5_000_000n, // 5.00 USDC
  maxPerRequestBase: 100_000n, // 0.10 USDC
  perMerchantPerDayBase: 2_000_000n, // 2.00 USDC
  humanApprovalAboveBase: 500_000n, // 0.50 USDC
  merchantsAllowlist: ['acme-data', 'ocr-lite', 'search-pro'],
  budgetUsedTodayBase: 2_400_000n, // 2.4 USDC
  emergencyStopped: false,
  auditTopic: '0.0.123456'
};

export const initialLedger: LedgerEntry[] = [
  {
    id: 'led_1',
    chain: 'Whitechain',
    chainId: 'whitechain',
    type: 'Payment',
    amountFormatted: '20.00 USDT',
    status: 'SETTLED',
    txLink: 'https://whitechain.io/tx/0x917f8a12b3c',
    timestamp: '2026-11-05 10:45'
  },
  {
    id: 'led_2',
    chain: 'Whitechain',
    chainId: 'whitechain',
    type: 'Refund',
    amountFormatted: '5.00 USDT',
    status: 'SETTLED',
    txLink: 'https://whitechain.io/tx/0x452a8e72c01',
    timestamp: '2026-11-05 10:40'
  },
  {
    id: 'led_3',
    chain: 'Hedera',
    chainId: 'hedera',
    type: 'Agent spend',
    amountFormatted: '0.02 USDC',
    status: 'SETTLED',
    txLink: 'https://hashscan.io/testnet/tx/0.0.482001',
    timestamp: '2026-11-05 10:42'
  },
  {
    id: 'led_4',
    chain: 'Hedera',
    chainId: 'hedera',
    type: 'Audit entry',
    amountFormatted: 'seq 41',
    status: 'AUDIT PENDING',
    txLink: 'https://hashscan.io/testnet/topic/0.0.123456',
    timestamp: '2026-11-05 10:39'
  },
  {
    id: 'led_5',
    chain: 'Uniswap',
    chainId: 'uniswap',
    type: 'Swap',
    amountFormatted: '50 USDC',
    status: 'SETTLED',
    txLink: 'https://unichain.blockscout.com/tx/0x88921a4',
    timestamp: '2026-11-05 09:15'
  },
  {
    id: 'led_6',
    chain: 'Uniswap',
    chainId: 'uniswap',
    type: 'Swap',
    amountFormatted: '9,000 USDC',
    status: 'REJECTED',
    txLink: null,
    timestamp: '2026-11-05 08:30'
  }
];

export const initialTokens: TokenOption[] = [
  {
    symbol: 'USDT',
    name: 'Tether USD',
    iconLetter: 'U',
    decimals: 6,
    balanceBase: 12_000_000n, // 12.00 USDT
    requiredBase: 20_000_000n, // 20.00 USDT
    shortfallBase: 8_000_000n, // short by 8.00
    isShort: true
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    iconLetter: 'W',
    decimals: 18,
    balanceBase: 52_000_000_000_000_000n, // 0.052 WETH
    requiredBase: 7_800_000_000_000_000n, // 0.0078 WETH
    isShort: false
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    iconLetter: 'U',
    decimals: 6,
    balanceBase: 40_000_000n, // 40.00 USDC
    requiredBase: 20_040_000n, // 20.04 USDC
    isShort: false
  }
];
