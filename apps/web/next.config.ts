import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

loadEnvConfig(resolve(process.cwd(), "../.."));

const config: NextConfig = {
  distDir: process.env.PULSEPAY_WEB_DEV === "1" ? ".next-dev" : ".next",
  experimental: { cpus: 2 },
  transpilePackages: ["@pulsepay/sdk-react", "@pulsepay/sdk-core", "@pulsepay/shared", "@pulsepay/adapter-whitechain", "@pulsepay/adapter-uniswap"],
  serverExternalPackages: ["@pulsepay/sdk-server"],
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  webpack(config) {
    config.module.rules.push({ test: /\.glsl$/, type: "asset/source" });
    return config;
  },
};
export default config;
