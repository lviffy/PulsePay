"use client";

import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap, eases } from "./motion";

export function Mark({ className = "" }: { className?: string }) {
  const points = Array.from({ length: 25 }, (_, i) => {
    const x = 2 + i * 1.25;
    const envelope = Math.exp(-Math.pow((i - 12) / 5, 2));
    return `${x},${17 + (Math.sin(i * 1.48) * 12 + (Math.sin(i * 127.1) * .5) * 4) * envelope}`;
  }).join(" ");
  return <svg className={`mark ${className}`} viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="33" height="33" rx="4" stroke="currentColor"/><polyline points={points} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

const links = [{ href: "/#sdk", label: "SDK" }, { href: "/docs", label: "Docs" }, { href: "/merchant", label: "Merchant" }, { href: "/merchant/agents", label: "Agents" }];
export function Dock() {
  const pathname = usePathname();
  const merchant = pathname.startsWith("/merchant");
  const [open, setOpen] = useState(false);
  const dock = useRef<HTMLElement>(null);
  useEffect(() => {
    setOpen(false);
    gsap.set(dock.current, { y: 0 });
    if (!merchant) return;
    let last = window.scrollY;
    const scroll = () => { const down = window.scrollY > last && window.scrollY > 50; gsap.to(dock.current, { y: down ? 150 : 0, duration: .35, ease: eases.dock }); last = window.scrollY; };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [pathname, merchant]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  return <nav className={`dock ${merchant ? "dock-merchant" : ""}`} ref={dock} aria-label="Main navigation">
    <div className="dock-marquee" aria-label="Whitechain, Uniswap v4, Hedera x402"><span><i className="status-dot"/> ONCHAIN BY DESIGN · WHITECHAIN · UNISWAP V4 · HEDERA X402 · ONCHAIN BY DESIGN · WHITECHAIN · UNISWAP V4 · HEDERA X402 · </span></div>
    <div className="dock-main"><Link prefetch={false} href="/" className="dock-logo" aria-label="PulsePay home"><Mark /></Link><div className="dock-links">{links.map(({ href, label }) => <Link prefetch={false} key={label} className={(label === "SDK" && pathname === "/" || label === "Docs" && pathname.startsWith("/docs") || label === "Merchant" && merchant && !pathname.startsWith("/merchant/agents") || label === "Agents" && pathname.startsWith("/merchant/agents")) ? "active" : ""} href={href}>{label}</Link>)}</div><Link prefetch={false} className="button dock-cta light" href="/merchant">Open console <span>↗</span></Link><button className="menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation">{open ? "Close −" : "Menu +"}</button></div>
    {open && <div id="mobile-navigation" className="mobile-navigation">{links.map(link => <Link prefetch={false} key={link.label} href={link.href} onClick={() => setOpen(false)}>{link.label}<span>↗</span></Link>)}</div>}
  </nav>;
}

export function Footer() {
  const pathname = usePathname();
  return <footer className={`site-footer ${pathname.startsWith("/merchant") ? "footer-dark" : ""}`}><Link prefetch={false} href="/" className="brand"><Mark/> PulsePay</Link><span className="mono">Payments, with a paper trail.</span><div><Link prefetch={false} href="/docs">Documentation ↗</Link><a href="/llms.txt">llms.txt ↗</a><a href="/openapi.json">API ↗</a></div><small>© {new Date().getFullYear()} PulsePay · Built at ETHGlobal Mumbai</small></footer>;
}
