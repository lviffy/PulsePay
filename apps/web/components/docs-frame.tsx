"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useTransitionRouter } from "next-view-transitions";
import catalog from "@/content/docs-index.json";
import { Mark } from "./shell";
import { Palette } from "./palette";

export function DocsFrame({slug,toc,children}:{slug:string;toc:{id:string;label:string}[];children:ReactNode}){
  const[drawer,setDrawer]=useState(false),[search,setSearch]=useState(false),[active,setActive]=useState(toc[0]?.id);
  const router=useTransitionRouter();
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearch(s=>!s);}if(e.key==="Escape")setDrawer(false);};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
  useEffect(()=>{const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)setActive(entry.target.id);},{rootMargin:"-5% 0px -70% 0px"});document.querySelectorAll(".markdown-content h2").forEach(el=>observer.observe(el));return()=>observer.disconnect();},[slug]);
  return <main id="main"><button className="docs-drawer-toggle" aria-expanded={drawer} aria-controls="docs-navigation" onClick={()=>setDrawer(!drawer)}>PulsePay docs<span>{drawer?"Close −":"Browse +"}</span></button><div className="docs-layout"><aside id="docs-navigation" className={`docs-sidebar ${drawer?"open":""}`} data-lenis-prevent><Link href="/" className="brand"><Mark/>PulsePay docs</Link><button className="docs-search" onClick={()=>{setSearch(true);setDrawer(false);}}>Search<span>CTRL K</span></button><nav className="docs-tree" aria-label="Documentation">{[...new Set(catalog.map(doc=>doc.group))].map(group=><details key={group} open><summary>{group}</summary>{catalog.filter(doc=>doc.group===group).map(doc=><Link href={`/docs/${doc.slug}`} key={doc.slug} aria-current={doc.slug===slug?"page":undefined} onClick={()=>setDrawer(false)}>{doc.slug.split("/").at(-1)}.md</Link>)}</details>)}</nav></aside><article className="docs-article">{children}</article><aside className="docs-toc" aria-label="On this page"><p>On this page</p>{toc.map(item=><a key={item.id} href={`#${item.id}`} className={active===item.id?"active":""}>{item.label.replace(" / "," ")}</a>)}<div className="agent-chip">Agent-readable<a href="/llms.txt">/llms.txt ↗</a><a href={`/docs/${slug}.md`}>Markdown twin ↗</a></div></aside></div><Palette open={search} onClose={()=>setSearch(false)} items={catalog.map(doc=>({label:`${doc.group} / ${doc.title}`,value:`/docs/${doc.slug}`}))} onSelect={value=>router.push(value)} title="Search the docs"/></main>;
}
