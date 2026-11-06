import { readMerchant, errorMessage, stringify, publicConfig } from "@/lib/chain";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const url=new URL(request.url);const data=await readMerchant(url.searchParams.get("merchant")||publicConfig().merchant,url.searchParams.get("before")||undefined);return new Response(stringify(data),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});}catch(error){return Response.json({error:errorMessage(error)},{status:503});}}
