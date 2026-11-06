import { createHmac, createHash, timingSafeEqual, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export function equalSecret(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function usdtUnits(value: unknown): bigint {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+(?:\.\d{1,6})?$/.test(String(value))) throw new Error("Amount must be a positive decimal with at most six fractional digits");
  const [whole, fraction = ""] = String(value).split(".");
  const units = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (units <= 0n || units > 1000000000000n) throw new Error("Amount must be greater than zero and at most 1,000,000 USDT");
  return units;
}
export function amountNumber(units: bigint): number { return Number(units) / 1e6; }
export function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${name}`);
  return value.trim();
}

export class RequestLimits {
  private readonly windows = new Map<string, { expires: number; count: number }>();
  allow(key: string, limit: number, durationMs = 60000): boolean {
    const now = Date.now();
    for (const [id, entry] of this.windows) if (entry.expires <= now) this.windows.delete(id);
    let entry = this.windows.get(key);
    if (!entry) {
      if (this.windows.size >= 10000) return false;
      entry = { expires: now + durationMs, count: 0 }; this.windows.set(key, entry);
    }
    return ++entry.count <= limit;
  }
}

export function merchantAuth(secret: string, origin: string) {
  const sign = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  return {
    cookie() {
      const value = `${Math.floor(Date.now()/1000) + 3600}.${randomBytes(16).toString("hex")}`;
      return `pulsepay_session=${value}.${sign(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${new URL(origin).protocol === "https:" ? "; Secure" : ""}`;
    },
    authorized(req: IncomingMessage) {
      const apiKey = req.headers["x-api-key"];
      if (typeof apiKey === "string" && equalSecret(apiKey, secret)) return true;
      const token = req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("pulsepay_session="))?.slice("pulsepay_session=".length);
      if (!token) return false;
      const [expiry, nonce, signature, extra] = token.split(".");
      return !extra && /^\d+$/.test(expiry) && Number(expiry) > Date.now()/1000 && /^[a-f0-9]{32}$/.test(nonce || "") && equalSecret(signature || "", sign(`${expiry}.${nonce}`));
    },
    headers(req: IncomingMessage, res: ServerResponse) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
      res.setHeader("Vary", "Origin");
      if (req.headers.origin === origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, PAYMENT-SIGNATURE, x-api-key");
        res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
      }
    },
  };
}
