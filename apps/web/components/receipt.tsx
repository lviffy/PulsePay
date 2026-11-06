"use client";
import Image from "next/image";
import { PulsePayReceipt } from "@pulsepay/sdk-react";
import { formatUnits } from "viem";
import type { PaymentStatus } from "@pulsepay/shared";
import { useRemote } from "@/lib/use-remote";
export function Receipt({id}:{id:string}){
  const remote=useRemote<{invoice:{id:string;merchant:string};payment:{customer:string;amountPaidUnits:string;amountRefundedUnits:string;status:PaymentStatus;txHash:string}}>(`/api/receipt/${encodeURIComponent(id)}`);
  return <main id="main" className="receipt-page"><div><p className="eyebrow" data-decode>PAYMENT / ONCHAIN EVIDENCE</p><h1>A payment.<br/>A paper trail.</h1><p className="lede">The amount, payer and refund status are read from the Whitechain merchant hub. This invoice has its own deterministic receipt pattern.</p><p className="receipt-evidence">Invoice / {id}</p></div><div className="receipt-box"><Image src={`/api/art/${encodeURIComponent(id)}`} alt="" width={1000} height={480} unoptimized className="receipt-art"/>{remote.loading?<p className="loading-line" role="status">Reading payment evidence…</p>:remote.error?<div className="checkout-error" role="alert">{remote.error}<button className="copy-button" onClick={remote.retry}>Retry ↗</button></div>:remote.data&&<><div className="receipt-evidence"><a href={`https://explorer.testnet.whitechain.io/tx/${remote.data.payment.txHash}`} target="_blank" rel="noreferrer">{remote.data.payment.txHash} ↗</a></div><div className="receipt-sdk" data-no-split><PulsePayReceipt invoiceId={id} merchantAddress={remote.data.invoice.merchant} customerAddress={remote.data.payment.customer} amountPaidUsdt={formatUnits(BigInt(remote.data.payment.amountPaidUnits),6)} amountRefundedUsdt={formatUnits(BigInt(remote.data.payment.amountRefundedUnits),6)} status={remote.data.payment.status} paymentTxHash={remote.data.payment.txHash}/></div></>}</div></main>;
}
