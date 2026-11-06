"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import Lenis from "lenis";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip);
export const eases = { reveal: "expo.out", scrub: "power2.inOut", dock: "back.out(1.15)" };
const alphabet = "01/{}[]<>_+*#";
gsap.registerEffect({ name: "blur-in", effect: (targets: gsap.TweenTarget) => gsap.fromTo(targets, { opacity: 0, filter: "blur(12px)", y: 12 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: .38, stagger: .005, ease: eases.reveal }), extendTimeline: true });
gsap.registerEffect({ name: "row-enter", effect: (targets: gsap.TweenTarget) => gsap.from(targets, { opacity: 0, y: 8, duration: .35, stagger: .035, ease: eases.reveal }), extendTimeline: true });
gsap.registerEffect({ name: "decode", effect: (targets: Element[]) => {
  const timeline = gsap.timeline();
  targets.forEach((el, index) => {
    const original = el.textContent || "";
    const state = { progress: 0 };
    timeline.to(state, { progress: 1, duration: .35, onUpdate: () => { el.textContent = state.progress > .8 ? original : alphabet[Math.floor(Math.random() * alphabet.length)]; }, onComplete: () => { el.textContent = original; } }, index * .018);
  });
  return timeline;
}, extendTimeline: true });

type Frame = (seconds: number) => void;
const MotionContext = createContext<{ subscribe: (frame: Frame) => () => void }>({ subscribe: () => () => {} });

export function MotionProvider({ children }: { children: ReactNode }) {
  const frames = useRef(new Set<Frame>());
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    let lenis: Lenis | undefined;
    media.add({ animated: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 900px)", mobile: "(max-width: 899px)" }, context => {
      if (context.conditions?.animated && !pathname.startsWith("/merchant")) {
        lenis = new Lenis({ autoRaf: false, duration: 1.05, anchors: true, prevent: node => node.hasAttribute("data-lenis-prevent") });
        lenis.on("scroll", ScrollTrigger.update);
      }
      return () => { lenis?.destroy(); lenis = undefined; };
    });
    const tick = (time: number) => {
      lenis?.raf(time * 1000);
      if (!document.hidden) frames.current.forEach(frame => frame(time));
    };
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(tick);
    document.fonts.ready.then(() => ScrollTrigger.refresh());
    return () => { media.revert(); gsap.ticker.remove(tick); };
  }, [pathname]);

  useGSAP((context, contextSafe) => {
    if (pathname.startsWith("/merchant") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const splits: SplitText[] = [];
    const roles: HTMLElement[] = [];
    const reveal = contextSafe!((el: HTMLElement) => {
      if (el.tagName === "P" && !el.getAttribute("role")) { el.setAttribute("role", "group"); roles.push(el); }
      const split = SplitText.create(el, { type: "lines,words,chars", autoSplit: true, aria: "auto", onSplit(self) {
        const timeline = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 98%", once: true } });
        timeline.add(gsap.effects["blur-in"](self.chars));
        if (el.dataset.decode !== undefined) timeline.add(gsap.effects.decode(self.chars), 0);
        return timeline;
      } });
      splits.push(split);
    });
    // Split only as text enters the viewport; below-fold headings stay ordinary HTML.
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { observer.unobserve(entry.target); reveal(entry.target as HTMLElement); } });
    }, { rootMargin: "0px 0px 60px 0px" });
    root.current?.querySelectorAll<HTMLElement>("[data-reveal], h1, h2, .eyebrow").forEach(el => {
      if (matchMedia("(max-width: 767px)").matches && el.closest(".hero-copy")) return;
      if (!el.closest("[data-no-split]")) observer.observe(el);
    });
    return () => { observer.disconnect(); splits.forEach(split => split.revert()); roles.forEach(el => el.removeAttribute("role")); };
  }, { scope: root, dependencies: [pathname], revertOnUpdate: true });

  return <MotionContext.Provider value={{ subscribe(frame) { frames.current.add(frame); return () => { frames.current.delete(frame); }; } }}><div ref={root} className="motion-root">{children}</div></MotionContext.Provider>;
}

export function useFrame() { return useContext(MotionContext).subscribe; }
export function useScopedAnimation(scope: RefObject<HTMLElement | null>, animation: () => void | (() => void), dependencies: unknown[] = []) {
  useGSAP(animation, { scope, dependencies, revertOnUpdate: true });
}
export { gsap, ScrollTrigger, SplitText, Flip };
