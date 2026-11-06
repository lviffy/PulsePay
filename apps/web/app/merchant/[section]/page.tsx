import { notFound } from "next/navigation";
import { MerchantDashboard } from "@/components/merchant-dashboard";
export function generateStaticParams(){return ["invoices","payments","refunds","subscriptions","treasury","agents","exports","settings"].map(section=>({section}));}
export default async function Merchant({params}:{params:Promise<{section:string}>}){const{section}=await params;if(!["invoices","payments","refunds","subscriptions","treasury","agents","exports","settings"].includes(section))notFound();return <MerchantDashboard section={section}/>;}
