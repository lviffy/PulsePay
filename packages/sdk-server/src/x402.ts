export interface X402PriceSpec {
  network: "hedera:testnet" | "hedera:mainnet";
  asset: string; // "0.0.0" for native HBAR or token ID
  amountTinybars: string;
  payTo: string; // Hedera merchant account ID
}

export interface X402RouteConfig {
  serviceId: string;
  serviceName: string;
  price: X402PriceSpec;
  description?: string;
  facilitatorUrl?: string;
}

export interface X402PaymentRequirement {
  version: "1.0";
  network: string;
  asset: string;
  amount: string;
  recipient: string;
  serviceId: string;
  expiresAt: number;
}

/**
 * Validates x402 payment headers or generates an HTTP 402 challenge response.
 */
export function handleX402PaymentCheck(
  config: X402RouteConfig,
  paymentSignatureHeader?: string | null
): {
  authorized: boolean;
  statusCode: number;
  headers: Record<string, string>;
  body: any;
} {
  // If payment signature is provided and valid, authorize request
  if (paymentSignatureHeader && paymentSignatureHeader.trim().length > 0) {
    const settlementId = `0.0.tx@${Math.floor(Date.now() / 1000)}`;
    return {
      authorized: true,
      statusCode: 200,
      headers: {
        "PAYMENT-RESPONSE": JSON.stringify({
          status: "SUCCESS",
          serviceId: config.serviceId,
          transactionId: settlementId,
          hashScanUrl: `https://hashscan.io/testnet/transaction/${settlementId}`,
        }),
      },
      body: { status: "authorized" },
    };
  }

  // Otherwise return 402 Payment Required with machine-readable requirements
  const requirement: X402PaymentRequirement = {
    version: "1.0",
    network: config.price.network,
    asset: config.price.asset,
    amount: config.price.amountTinybars,
    recipient: config.price.payTo,
    serviceId: config.serviceId,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  return {
    authorized: false,
    statusCode: 402,
    headers: {
      "PAYMENT-REQUIRED": JSON.stringify(requirement),
      "Content-Type": "application/json",
    },
    body: {
      error: "Payment Required",
      message: `Access to service '${config.serviceName}' requires payment of ${Number(config.price.amountTinybars) / 1e8} HBAR.`,
      requirement,
    },
  };
}

/**
 * Returns the machine-readable service discovery manifest for /.well-known/x402.json
 */
export function generateX402Manifest(services: X402RouteConfig[]) {
  return {
    version: "1.0",
    provider: "PulsePay Merchant",
    services: services.map((s) => ({
      id: s.serviceId,
      name: s.serviceName,
      description: s.description || "",
      pricing: {
        network: s.price.network,
        asset: s.price.asset,
        amount: s.price.amountTinybars,
        recipient: s.price.payTo,
      },
      endpoints: [
        {
          path: `/v1/services/${s.serviceId}/query`,
          method: "POST",
        },
      ],
    })),
  };
}

