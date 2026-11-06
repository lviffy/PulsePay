import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import catalog from "@/content/docs-index.json";
export { catalog };
export type Doc = typeof catalog[number];
export function headingId(text:string){return text.toLowerCase().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-");}
export const getDoc=cache(async(slug:string)=>{
  const entry=catalog.find(doc=>doc.slug===slug);if(!entry)return null;
  const markdown=await readFile(resolve(process.cwd(),"content/docs",`${entry.slug}.md`),"utf8");
  const toc=Array.from(markdown.matchAll(/^## (.+)$/gm),match=>({label:match[1],id:headingId(match[1])}));
  return {...entry,markdown,toc};
});
