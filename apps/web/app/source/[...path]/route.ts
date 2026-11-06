import { getSourceFiles } from "@/lib/source";
export const dynamic="force-static";
export async function generateStaticParams(){return (await getSourceFiles()).map(file=>({path:file.path.split("/")}));}
export async function GET(_request:Request,{params}:{params:Promise<{path:string[]}>}){const{path}=await params;const file=(await getSourceFiles()).find(file=>file.path===path.join("/"));return file?Response.json(file):Response.json({error:"Source file not found."},{status:404});}
