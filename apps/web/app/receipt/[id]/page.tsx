import { Receipt } from "@/components/receipt";
import { notFound } from "next/navigation";
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const{id}=await params;return{title:`Receipt ${id.slice(0,10)}`,openGraph:{images:[`/api/og/${encodeURIComponent(id)}`]}};}
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;if(!/^0x[a-fA-F0-9]{64}$/.test(id))notFound();return <Receipt id={id}/>;}
