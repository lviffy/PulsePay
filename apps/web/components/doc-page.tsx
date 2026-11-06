import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";
import { syntaxTheme } from "@/lib/highlight";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";
import { getDoc, catalog, headingId } from "@/lib/docs";
import { DocsFrame } from "./docs-frame";
import { CopyButton } from "./copy-button";
import { Feedback } from "./feedback";

export async function DocPage({slug}:{slug:string}){
  const doc=await getDoc(slug);if(!doc)notFound();
  const at=catalog.findIndex(item=>item.slug===slug),prev=catalog[at-1],next=catalog[at+1];
  const snippets=new Map<string,string>();
  await Promise.all(Array.from(doc.markdown.matchAll(/```(\w*)\n([\s\S]*?)```/g),async match=>{snippets.set(match[2].trimEnd(),await codeToHtml(match[2].trimEnd(),{lang:match[1]||"text",theme:syntaxTheme}));}));
  return <DocsFrame slug={slug} toc={doc.toc}><div className="breadcrumb">Docs / {doc.group} / {doc.slug.split("/").at(-1)}</div><h1 data-decode>{doc.title}</h1><p className="docs-lede">{doc.lede}</p><div className="track-chips"><span className="track-chip">Track: {doc.track}</span><span className="track-chip">Source verified</span><a className="track-chip" href={`/docs/${slug}.md`}>Agent readable ↗</a></div><div className="before-start"><strong>Before you start</strong>Node 22.13 or newer · pnpm 12.14.0 · Your configured deployment.<br/>{doc.group==="Hedera"?"Native HBAR · asset 0.0.0. No Solidity is deployed on this track.":"Read the actual source and use accounts you control for wallet-authorized writes."}</div><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{h2:({children})=><h2 id={headingId(String(children))}>{children}</h2>,table:({children})=><div className="table-wrap"><table>{children}</table></div>,pre:({children})=>{
    const code=(children as React.ReactElement<{children:string}>)?.props?.children?.toString().trimEnd()||"";
    return <div className="docs-code"><CopyButton text={code}/><div dangerouslySetInnerHTML={{__html:snippets.get(code)||`<pre>${code.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</pre>`}}/></div>;
  }}}>{doc.markdown}</ReactMarkdown></div><nav className="docs-pagination" aria-label="Documentation pagination">{prev?<Link href={`/docs/${prev.slug}`}><small>← Previous</small>{prev.title}</Link>:<span/>}{next&&<Link href={`/docs/${next.slug}`}><small>Next →</small>{next.title}</Link>}</nav><div className="docs-meta"><a href={`https://github.com/lviffy/ETHGLOBAL/edit/main/apps/web/content/docs/${slug}.md`} target="_blank" rel="noreferrer">Edit this page ↗</a><a href={`/docs/${slug}.md`}>View as Markdown ↗</a><a href="https://github.com/lviffy/ETHGLOBAL/issues/new" target="_blank" rel="noreferrer">Report an issue ↗</a></div><Feedback slug={slug}/></DocsFrame>;
}
