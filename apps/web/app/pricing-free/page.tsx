import { Suspense } from "react";
import { CheckoutDemo } from "@/components/checkout-demo";
export const metadata={title:"Live checkout demo"};
export default function Page(){return <Suspense fallback={<main id="main" className="not-found"><p>Loading checkout…</p></main>}><CheckoutDemo/></Suspense>;}
