"use client";
import { useEffect, useRef, useState } from "react";
import type { SourceFile } from "@/lib/source";
import { CopyButton } from "./copy-button";
import { Palette } from "./palette";
import { useRemote } from "@/lib/use-remote";
import { gsap, ScrollTrigger, useScopedAnimation } from "./motion";

const tabs = ["React", "Server", "Agent", "Contracts"];
const defaults = ["packages/sdk-react/examples/checkout-page.tsx", "packages/sdk-server/src/x402.ts", "apps/agent-worker/src/index.ts", "contracts/whitechain/src/PulsePayMerchantHub.sol"];
type TreeNode = { name: string; path: string; children: TreeNode[]; file?: Pick<SourceFile,"path"> };
function tree(files: Pick<SourceFile,"path">[]) {
  const root: TreeNode = { name: "root", path: "", children: [] };
  for (const file of files) {
    let node = root;
    file.path.split("/").forEach((name, i, parts) => {
      let next = node.children.find(child => child.name === name);
      if (!next) { next = { name, path: parts.slice(0, i + 1).join("/"), children: [] }; node.children.push(next); }
      if (i === parts.length - 1) next.file = file;
      node = next;
    });
  }
  return root.children;
}
function TreeItem({ node, selected, select }: { node: TreeNode; selected: string; select: (path: string) => void }) {
  const [expanded,setExpanded]=useState(selected.startsWith(`${node.path}/`)||node.path==="packages");
  useEffect(()=>{if(selected.startsWith(`${node.path}/`))setExpanded(true);},[selected,node.path]);
  if (node.file) return <li role="none"><button role="treeitem" aria-selected={selected === node.path} className={selected === node.path ? "selected" : ""} onClick={() => select(node.path)} title={node.path}><span className="file-icon">⌑</span>{node.name}</button></li>;
  return <li role="none"><details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary role="treeitem" aria-expanded={expanded}>{node.name}</summary><ul role="group">{expanded&&node.children.map(child => <TreeItem key={child.path} node={child} selected={selected} select={select}/>)}</ul></details></li>;
}

export function RepoExplorer({ files, initial, pinned = false }: { files: Pick<SourceFile,"path">[]; initial: SourceFile; pinned?: boolean }) {
  const [selected, setSelected] = useState(defaults[0]);
  const [terminal, setTerminal] = useState(true);
  const [search, setSearch] = useState(false);
  const scope = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const remote = useRemote<SourceFile>(selected===initial.path?null:`/source/${selected}`);
  const file = selected===initial.path?initial:remote.data;
  const nodes = tree(files);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !["k", "j"].includes(e.key.toLowerCase())) return;
      const bounds = scope.current?.getBoundingClientRect();
      if (!bounds || bounds.bottom < 0 || bounds.top > innerHeight) return;
      e.preventDefault();
      if (e.key.toLowerCase() === "k") setSearch(s => !s); else if (e.metaKey && !pinned) setSearch(s=>!s); else setTerminal(t => !t);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useScopedAnimation(scope, () => {
    if (!pinned) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1000px) and (prefers-reduced-motion: no-preference)", () => {
      ScrollTrigger.create({ trigger: scope.current, start: "top 12%", end: "+=850", pin: true, onUpdate: self => setSelected(defaults[Math.min(3, Math.floor(self.progress * 4))]) });
    });
    return () => mm.revert();
  }, [pinned]);
  useScopedAnimation(content, () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lines = content.current?.querySelectorAll(".line");
    if (lines?.length) { const visible=Array.from(lines).slice(0,35); gsap.effects["row-enter"](visible); const tokens=visible.flatMap(line=>Array.from(line.querySelectorAll("span"))).slice(0,100); tokens.forEach((token,i)=>{ const original=token.textContent||"";const state={progress:0};gsap.to(state,{progress:1,duration:.18,delay:i*.001,onUpdate:()=>{token.textContent=state.progress>.65?original:original.replace(/[a-zA-Z0-9]/g,()=>"01_{}"[Math.floor(Math.random()*5)]);},onComplete:()=>{token.textContent=original;}}); }); }
    content.current?.scrollTo(0, 0);
    ScrollTrigger.refresh();
  }, [selected, file?.path]);
  return <div className="ide" ref={scope}>
    <div className="ide-toolbar"><div className="ide-tabs" role="tablist" aria-label="SDK source track">{tabs.map((tab, i) => <button key={tab} role="tab" aria-selected={selected === defaults[i]} aria-controls="source-viewer" onClick={() => setSelected(defaults[i])}>{tab}</button>)}</div><span className="mono ide-caption">This is the actual SDK.</span><div className="ide-keys"><button onClick={() => setTerminal(!terminal)} aria-label="Ctrl J: toggle terminal">CTRL J</button><button onClick={() => setSearch(true)} aria-label="Ctrl K: search repository">CTRL K</button></div></div>
    <div className="ide-workspace"><aside className="file-tree" data-lenis-prevent aria-label="Repository files" onKeyDown={e => {
      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("summary, button")).filter(el => el.getClientRects().length);
      const at = items.indexOf(document.activeElement as HTMLElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) { e.preventDefault(); items[e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))]?.focus(); }
      const active = document.activeElement;
      if (active?.tagName === "SUMMARY" && ["ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); (active.parentElement as HTMLDetailsElement).open = e.key === "ArrowRight"; }
    }}><ul role="tree">{nodes.map(node => <TreeItem key={node.path} node={node} selected={selected} select={setSelected}/>)}</ul></aside>
    <div id="source-viewer" className="source-viewer" role="tabpanel"><div className="file-heading"><span>{selected}</span>{file&&<CopyButton text={file.code}/>} {remote.error&&<button className="copy-button" onClick={remote.retry}>Retry</button>}</div><div className="code-content" ref={content} tabIndex={0} data-lenis-prevent dangerouslySetInnerHTML={{ __html: file?.html || (remote.error?"<p>Source read failed. Select the file again to retry.</p>":"<p>Loading real source…</p>") }}/></div><div className="code-minimap" aria-hidden="true">{(file?.code||"").split("\n").slice(0, 85).map((line, i) => <i key={i} style={{ width: `${Math.min(100, line.length * 1.4)}%`, opacity: .15 + (i % 5) * .09 }}/>)}</div></div>
    {terminal && <div className="terminal-strip"><span className="terminal-prompt">~/pulsepay</span> $ pnpm --filter @pulsepay/sdk-react build <span className="terminal-note">SOURCE / READ ONLY</span></div>}
    <Palette open={search} onClose={() => setSearch(false)} items={files.map(file => ({ label: file.path, value: file.path }))} onSelect={setSelected}/>
  </div>;
}
