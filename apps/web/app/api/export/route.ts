import { readActivities, errorMessage, publicConfig } from "@/lib/chain";
import { formatAccountantCsv } from "@pulsepay/shared";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const url=new URL(request.url);const rows=await readActivities(url.searchParams.get("merchant")||publicConfig().merchant,url.searchParams.get("before")||undefined);return new Response(formatAccountantCsv(rows),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="pulsepay-whitechain-${new Date().toISOString().slice(0,10)}.csv"`,"Cache-Control":"no-store"}});}catch(error){return Response.json({error:errorMessage(error)},{status:503});}}
