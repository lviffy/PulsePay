import { DocPage } from "@/components/doc-page";
import { catalog } from "@/lib/docs";
export function generateStaticParams(){return catalog.map(doc=>({slug:doc.slug.split("/")}));}
export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}){const{slug}=await params;const doc=catalog.find(doc=>doc.slug===slug.join("/"));return {title:doc?.title||"Documentation",description:doc?.lede};}
export default async function Docs({params}:{params:Promise<{slug:string[]}>}){const{slug}=await params;return <DocPage slug={slug.join("/")}/>;}
