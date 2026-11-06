"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Link } from "next-view-transitions";
import type { SourceFile } from "@/lib/source";
import { RepoExplorer } from "./repo-explorer";
import { useFrame, useScopedAnimation, gsap, ScrollTrigger } from "./motion";
const Scenes=dynamic(()=>import("./procedural-scenes"),{ssr:false});

const features = [
  ["Universal checkout.","One checkout surface for your customers. Direct USDT settlement is live on Whitechain; other-token quotes come from Uniswap’s exact-output API."],
  ["The amount stays exact.","Price invoices in USDT base units. The contract checks the invoice and the amount before it records a payment."],
  ["Refunds have a reserve.","Keep a configurable share of settlement in reserve. Send a full or partial refund back to the original payer, with an onchain record."],
  ["Billing that keeps time.","Create a plan, let a subscriber authorize it, and charge eligible renewals. Every cycle has a unique renewal ID."],
  ["A guard on your treasury.","A Uniswap v4 hook checks the configured input token, enforces a raw-unit swap limit, and gives the owner a pause switch."],
  ["A 402 is an invitation.","An agent discovers a service, receives a payment challenge and settles native HBAR. A verified receipt unlocks the saved response."],
  ["Policy before payment.","Tool and merchant allowlists, per-request limits and a daily transfer budget are evaluated before the agent spends."],
  ["Every call leaves a trail.","The worker journals its HCS audit message. If consensus submission fails, it retains the record and reconciles before retrying."],
  ["Your accountant gets a file.","Export confirmed activity with the shared CSV formatter: UTC time, asset, raw units, payer, recipient and explorer evidence."],
  ["React. Drop in. Settle.","Use PulsePayProvider, PulsePayCheckout and PulsePayReceipt from the workspace SDK. The widget reads the invoice and waits for settlement evidence."],
];

function TokenFlow({ mini = false }: { mini?: boolean }) {
  const canvas=useRef<HTMLCanvasElement>(null);const subscribe=useFrame();
  useEffect(()=>{
    const node=canvas.current!;const ctx=node.getContext("2d")!;let visible=true;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});observer.observe(node);
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw=(time:number)=>{if(!visible)return;const w=node.width,h=node.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle=mini?"#78786f":"#c1c0b5";ctx.lineWidth=1;
      for(let lane=0;lane<5;lane++){const y=h*(.14+lane*.18);ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(w*.35,y,w*.5,h/2,w*.72,h/2);ctx.lineTo(w,h/2);ctx.stroke();
        for(let i=0;i<12;i++){const p=((reduced?0:time*.045)+i/12+lane*.047)%1;const x=p*w;const t=Math.min(1,p/.72);const smooth=t*t*(3-2*t);const py=y+(h/2-y)*smooth;ctx.fillStyle=p>.72?"#f27b25":mini?"#d8d5c8":"#20201e";ctx.fillRect(x,py,mini?2:3,mini?2:3);}}
    };draw(0);const stop=reduced?()=>{}:subscribe(draw);return()=>{stop();observer.disconnect();};
  },[subscribe,mini]);
  return <canvas ref={canvas} width={mini?160:1000} height={mini?70:300} className={mini?"minimap-flow":"token-flow"} aria-hidden="true"/>;
}

export function Landing({ files, initial }: { files: Pick<SourceFile,"path">[]; initial: SourceFile }) {
  const [ready,setReady]=useState(false);const scope=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches || ((navigator as Navigator & {deviceMemory?:number}).deviceMemory||8)<=2)return;
    if(matchMedia("(max-width: 767px)").matches){
      const panel=document.querySelector("[data-scene=rings]");
      const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting&&entry.intersectionRatio>.4){setReady(true);observer.disconnect();}},{threshold:.45});
      if(panel)observer.observe(panel);return()=>observer.disconnect();
    }
    const id=window.setTimeout(()=>setReady(true),250);return()=>clearTimeout(id);
  },[]);
  useScopedAnimation(scope,()=>{
    const mm=gsap.matchMedia();mm.add("(min-width: 1000px) and (prefers-reduced-motion: no-preference)",()=>{
      gsap.to(".feature-intro",{scrollTrigger:{trigger:".feature-intro",start:"top 12%",endTrigger:".feature-section",end:"bottom 80%",pin:true,pinSpacing:false}});
      const rows=scope.current!.querySelectorAll(".feature-entry");
      rows.forEach(row=>{ScrollTrigger.create({trigger:row,start:"center center",end:"+=65",pin:true,pinSpacing:false});const number=row.querySelector(".feature-number"),body=row.querySelector("p");const timeline=gsap.timeline({scrollTrigger:{trigger:row,start:"top 65%",end:"bottom 40%",toggleActions:"play none none reverse"}});timeline.add(gsap.effects.decode([number]));timeline.add(gsap.effects["blur-in"]([body]),.1);});
      gsap.timeline({scrollTrigger:{trigger:".cost-section",start:"top 70%",end:"bottom 65%",scrub:true}}).from(".cost-table tbody tr",{opacity:.15,stagger:.25,ease:"none"});
      gsap.to(".dither-rise",{yPercent:-35,ease:"none",scrollTrigger:{trigger:".hero",start:"top top",end:"bottom top",scrub:true}});
      gsap.to(".minimap-progress",{scaleY:1,transformOrigin:"top",ease:"none",scrollTrigger:{trigger:scope.current,start:"top top",end:"bottom bottom",scrub:true}});
    });return()=>mm.revert();
  });
  return <main id="main" ref={scope}>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">Unified onchain payment stack · ETHGlobal Mumbai</p><h1 data-hero-title>Pay in any <br/>token. <br/>Settle in <br/>USDT.</h1><p className="hero-lede">Invoices, reserve-backed refunds and subscriptions on Whitechain. Treasury controls through Uniswap v4. Agents that pay over x402 on Hedera, with an audit trail on consensus.</p><div className="actions"><Link prefetch={false} href="/merchant" className="button">Open console ↗</Link><Link prefetch={false} href="/docs" className="button">Read docs</Link><Link prefetch={false} href="/pricing-free" className="button soft">Try checkout</Link></div><a href="#sdk" className="scroll-cue mono">⊙ Scroll to dive in</a></div>
      <div className="hero-art" data-scene="rings"><div className="hero-static" aria-hidden="true"/><div className="hero-disc mono" aria-hidden="true">402</div><div className="dither-rise" aria-hidden="true"/></div>
      <a href="#repo" className="landing-minimap" aria-label="Jump to the repository"><div className="minimap-top mono"><span>PulsePay / map</span><span>↘</span></div><TokenFlow mini/><div className="minimap-track"><i className="minimap-progress"/></div></a>
    </section>
    <section id="sdk" className="sdk-section section-pad"><div className="dither-band" aria-hidden="true"/><p className="eyebrow" data-decode>001 / THE SDK</p><h2>One component to a<br className="mobile-break"/> live checkout.</h2><RepoExplorer files={files} initial={initial} pinned/><p className="section-note mono">Real files from this monorepo. Read, copy, build.</p></section>
    <section className="feature-section section-pad" id="features"><div className="ascii-field" data-scene="field" aria-hidden="true"/><div className="feature-intro"><p className="eyebrow" data-decode>002 / THE PAYMENT PATH</p><h2>Every payment <br/>has a next step. <br/>We built it in.</h2><p>From the first invoice to the last line in your ledger. One workspace, ten connected pieces.</p></div><div className="feature-grid">{features.map(([title,body],i)=><article className="feature-entry" data-offset={i%2?"true":undefined} key={title}><span className="feature-number mono" aria-hidden="true">{String(i+1).padStart(3,"0")} /</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="cost-section section-pad"><div><p className="eyebrow" data-decode>003 / THE COST OF FRICTION</p><h2>Count the steps. <br/>Then remove them.</h2><div className="cost-number mono">[—]</div><p>Steps lost at checkout. Bring your own funnel data; we won’t invent the numbers.</p></div><div className="cost-table-wrap"><table className="cost-table"><thead><tr><th>Checkout step</th><th>Before</th><th>PulsePay</th></tr></thead><tbody>{["Choose a network","Find the right token","Work out the amount","Confirm payment","Get settlement proof"].map((step,i)=><tr key={step}><td><span className="muted">0{i+1}</span> {step}</td><td>[TBD]</td><td>[TBD]</td></tr>)}</tbody></table><p className="mono small">[TBD] = measured figures pending. No performance claim.</p></div></section>
    <section className="checkout-story section-pad"><p className="eyebrow" data-decode>004 / FROM MANY, ONE</p><h2>Different inputs. <br/>A clear settlement.</h2><TokenFlow/><div className="flow-labels mono"><span>Tokens / Quote on Uniswap</span><span>USDT / Settle on Whitechain</span></div><p>Exact-output quotes and direct USDT settlement are available today. Bridging a swap into a Whitechain invoice remains a separate integration.</p><Link prefetch={false} href="/docs/uniswap/universal-checkout" className="text-link mono">Read the settlement path ↗</Link></section>
    <section id="repo" className="repo-section section-pad"><p className="eyebrow" data-decode>005 / NOTHING BEHIND THE CURTAIN</p><h2>The whole path. <br/>In the actual repo.</h2><RepoExplorer files={files} initial={initial}/></section>
    <section className="final-cta section-pad"><p className="eyebrow">YOUR NEXT PAYMENT STARTS HERE</p><h2>Make it settle.</h2><div className="actions"><Link prefetch={false} href="/merchant" className="button light">Open console ↗</Link><Link prefetch={false} href="/docs" className="button outline-light">Read the docs ↗</Link></div><p className="mono">Whitechain · Uniswap v4 · Hedera x402</p></section>
    {ready&&<Scenes/>}
  </main>;
}
