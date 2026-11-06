"use client";
import { useState } from "react";
export function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [state, setState] = useState("Copy");
  return <button className={`copy-button ${className}`} onClick={async () => { try { await navigator.clipboard.writeText(text); setState("Copied ✓"); } catch { setState("Select text to copy"); } }} aria-live="polite">{state}</button>;
}
