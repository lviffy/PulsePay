import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";

/** Reject concurrent owners rather than allowing file-backed accounting to race. */
export function acquireStateOwner(directory: string, role: "server" | "worker"): () => void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${role}-owner.lock`);
  try { mkdirSync(path, { mode: 0o700 }); }
  catch (error: any) {
    if (error.code !== "EEXIST") throw error;
    let owner = "unknown owner";
    try { owner = readFileSync(join(path, "owner.json"), "utf8"); } catch { /* An incomplete lock also fails closed. */ }
    throw new Error(`State is already owned: ${path} (${owner}). After a crash, verify the prior process stopped before removing its lock. Multiple replicas require a transactional store.`);
  }
  writeFileSync(join(path, "owner.json"), JSON.stringify({ pid: process.pid, hostname: hostname() }), { mode: 0o600 });
  let released = false;
  const release = () => { if (!released) { released = true; rmSync(path, { recursive: true }); } };
  process.once("exit", release);
  return () => { release(); process.removeListener("exit", release); };
}
