"use client";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "next-view-transitions";
import { PulsePayProvider, PulsePayCheckout } from "@pulsepay/sdk-react";
import { isAddress } from "viem";
import { useRemote } from "@/lib/use-remote";
import type { Config } from "./merchant-dashboard";
export function CheckoutDemo(){
  const params=useSearchParams();const[input,setInput]=useState(params.get("invoice")||"");const[id,setId]=useState(params.get("invoice")||"");const[tx,setTx]=useState("");
  const config=useRemote<Config>("/api/config");const providerConfig=useMemo(()=>config.data&&isAddress(config.data.hub)?{whitechain:{contractAddress:config.data.hub,rpcUrl:config.data.rpc,usdtAddress:config.data.usdt as `0x${string}`}}:null,[config.data]);
  useEffect(()=>{setInput(params.get("invoice")||"");setId(params.get("invoice")||"");},[params]);
  return <main id="main" className="checkout-page"><div><p className="eyebrow">LIVE SDK / DIRECT USDT</p><h1>Try the real<br/>checkout.</h1><p className="lede">Bring an existing Whitechain invoice. The SDK reads its amount and only reports success after a matching settlement event.</p><p className="mono small" style={{maxWidth:430,lineHeight:1.9}}>The integration demo has no platform fee. Paying an invoice moves real testnet USDT and requires network gas. Other-token quote-to-settlement is a separate integration.</p><Link href="/docs/sdk/react" className="text-link mono">Read the React integration ↗</Link></div><div className="checkout-box"><form onSubmit={e=>{e.preventDefault();setTx("");setId(input);}}><label htmlFor="invoice-id">Invoice ID / bytes32</label><input id="invoice-id" value={input} onChange={e=>setInput(e.target.value)} placeholder="0x…" autoComplete="off"/><button className="button" type="submit">Load invoice ↗</button></form>{config.loading?<p className="loading-line" role="status">Reading configuration…</p>:config.error?<div className="checkout-error" role="alert">{config.error}<button className="copy-button" onClick={config.retry}>Retry</button></div>:!providerConfig?<div className="checkout-error" role="alert">Set WHITECHAIN_MERCHANT_HUB_ADDRESS in the root .env to use a deployed merchant hub.<br/><Link href="/merchant/settings">View configuration ↗</Link></div>:id?<div style={{marginTop:30}}><PulsePayProvider config={providerConfig}><PulsePayCheckout invoiceId={id} enablePayWithAnyToken={false} onSuccess={setTx}/></PulsePayProvider>{tx&&<Link href={`/receipt/${id}`} className="button soft" style={{marginTop:15}}>Open receipt ↗</Link>}</div>:<p className="checkout-error">Create an invoice in the merchant console, then paste its bytes32 ID here. No sample invoice or amount is supplied.</p>}</div></main>;
}
