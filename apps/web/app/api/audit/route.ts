import { readAudit, errorMessage } from "@/lib/chain";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return Response.json(await readAudit(new URL(request.url).searchParams.get("before")||undefined));}catch(error){return Response.json({error:errorMessage(error)},{status:503});}}
