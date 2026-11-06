import { PulsePayProvider, PulsePayCheckout } from "@pulsepay/sdk-react";
import type { PulsePayConfig } from "@pulsepay/sdk-core";

export function CheckoutPage({ config, invoiceId, onSettled }: {
  config: PulsePayConfig;
  invoiceId: `0x${string}`;
  onSettled: (transactionHash: string) => void;
}) {
  return (
    <PulsePayProvider config={config}>
      <PulsePayCheckout
        invoiceId={invoiceId}
        enablePayWithAnyToken={false}
        onSuccess={onSettled}
      />
    </PulsePayProvider>
  );
}
