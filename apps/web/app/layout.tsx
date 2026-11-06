import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ViewTransitions } from "next-view-transitions";
import { MotionProvider } from "@/components/motion";
import { Dock, Footer } from "@/components/shell";
import "./globals.css";

const space = localFont({ src: "../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2", variable: "--font-space", display: "swap" });
const mono = localFont({ src: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", variable: "--font-mono", display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(process.env.PULSEPAY_WEB_URL || "http://localhost:3100"),
  title: { default: "PulsePay — Pay in any token. Settle in USDT.", template: "%s · PulsePay" },
  description: "Invoices, reserve-backed refunds and subscriptions on Whitechain. Uniswap treasury controls. Native Hedera agent payments with an HCS audit trail.",
  other: { "page-type": "software", "site-kind": "software" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f1efe7" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ViewTransitions><html lang="en" data-type="software" className={`${space.variable} ${mono.variable}`}><body><a href="#main" className="skip-link">Skip to content</a><MotionProvider>{children}<Footer/><Dock/></MotionProvider></body></html></ViewTransitions>;
}
