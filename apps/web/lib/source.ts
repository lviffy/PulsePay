import "server-only";
import { cache } from "react";
import { readFile, readdir } from "node:fs/promises";
import { resolve, extname, relative } from "node:path";
import { codeToHtml } from "shiki";
import { syntaxTheme } from "./highlight";

export type SourceFile = { path: string; code: string; html: string };
export const repoRoot = resolve(process.cwd(), "../..");
const ignored = new Set(["node_modules", "dist", "lib", "out", "cache", "broadcast", ".git", ".next"]);
export const getSourceFiles = cache(async (): Promise<SourceFile[]> => {
  async function walk(directory: string): Promise<string[]> {
    const entries = await readdir(resolve(repoRoot, directory), { withFileTypes: true });
    const files = await Promise.all(entries.filter(entry => !ignored.has(entry.name)).map(async entry => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? walk(path) : /\.(ts|tsx|sol|md)$/.test(path) ? [path] : [];
    }));
    return files.flat();
  }
  const paths = ["README.md", "PulsePay_ETHGlobal_Mumbai_PRD.md", ...(await walk("packages")), ...(await walk("contracts/whitechain/src")), ...(await walk("contracts/uniswap-v4/src")), "apps/agent-worker/src/index.ts"];

  return Promise.all(paths.map(async path => {
    const code = await readFile(resolve(repoRoot, path), "utf8");
    const lang = ({ ".ts": "typescript", ".tsx": "tsx", ".sol": "solidity", ".md": "markdown" } as Record<string, string>)[extname(path)];
    return { path: relative(repoRoot, resolve(repoRoot, path)), code, html: await codeToHtml(code, { lang, theme: syntaxTheme }) };
  }));
});
