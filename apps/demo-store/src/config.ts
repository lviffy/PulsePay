import { resolve, isAbsolute } from "node:path";

const port = Number(process.env.PORT || "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
const origin = new URL(process.env.PULSEPAY_APP_URL || `http://localhost:${port}`).origin;
if (!["https:", "http:"].includes(new URL(origin).protocol)) throw new Error("Invalid PULSEPAY_APP_URL");
if (process.env.NODE_ENV === "production" && new URL(origin).protocol !== "https:") throw new Error("Production PULSEPAY_APP_URL must use HTTPS");
if (process.env.WHITECHAIN_CHAIN_ID && process.env.WHITECHAIN_CHAIN_ID !== "1874") throw new Error("Whitechain adapter requires chain 1874");
const secret = process.env.PULSEPAY_API_SECRET || "";
if (secret.length < 32 || secret.includes("change_in_production")) throw new Error("Set PULSEPAY_API_SECRET to a random secret of at least 32 characters");
const merchantAccountId = process.env.HEDERA_MERCHANT_ACCOUNT_ID || "";
if (!/^\d+\.\d+\.\d+$/.test(merchantAccountId)) throw new Error("Set HEDERA_MERCHANT_ACCOUNT_ID to an account you control");
const network = process.env.HEDERA_NETWORK || "testnet";
if (network !== "testnet" && network !== "mainnet") throw new Error("Unsupported HEDERA_NETWORK");
const stateDirectory = process.env.PULSEPAY_STATE_DIRECTORY;
if (process.env.NODE_ENV === "production" && (!stateDirectory || !isAbsolute(stateDirectory))) throw new Error("Production requires an absolute PULSEPAY_STATE_DIRECTORY on persistent storage");
export const config = { port, origin, secret, merchantAccountId, network, stateDirectory: resolve(stateDirectory || ".pulsepay") };
