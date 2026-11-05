import React, { createContext, useContext, useMemo } from "react";
import { PulsePayClient, PulsePayConfig, createPulsePay } from "@pulsepay/sdk-core";

interface PulsePayContextValue {
  client: PulsePayClient;
  config: PulsePayConfig;
}

const PulsePayContext = createContext<PulsePayContextValue | null>(null);

export function PulsePayProvider({
  config,
  children,
}: {
  config: PulsePayConfig;
  children: React.ReactNode;
}) {
  const client = useMemo(() => createPulsePay(config), [config]);

  return (
    <PulsePayContext.Provider value={{ client, config }}>
      {children}
    </PulsePayContext.Provider>
  );
}

export function usePulsePay(): PulsePayContextValue {
  const ctx = useContext(PulsePayContext);
  if (!ctx) {
    throw new Error("usePulsePay must be used within a <PulsePayProvider>");
  }
  return ctx;
}

