import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeEventTopics,encodeAbiParameters} from 'viem';
import {WhitechainAdapter,pulsePayMerchantHubAbi} from '../dist/index.js';
const hub='0x1111111111111111111111111111111111111111',payer='0x2222222222222222222222222222222222222222',merchant='0x3333333333333333333333333333333333333333';
const token='0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7',id='0x'+'11'.repeat(32),hash='0x'+'22'.repeat(32);
function setup({allowance=0n,chain=1874,receiptStatus='success',event=true}={}){
 let sends=0;
 const logs=event?[{address:hub,topics:encodeEventTopics({abi:pulsePayMerchantHubAbi,eventName:'PaymentSettled',args:{invoiceId:id,merchant,customer:payer}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint64'}],[20000000n,1n])}]:[];
 const publicClient={getChainId:async()=>1874,readContract:async({functionName})=>{
  if(functionName==='USDT')return token;if(functionName==='allowance')return allowance;
  if(functionName==='getInvoice')return {invoiceId:id,merchant,customer:payer,amount:20000000n,dueAt:BigInt(Math.floor(Date.now()/1000)+60),status:1,metadataHash:id};
  throw Error(functionName);
 },waitForTransactionReceipt:async()=>({status:receiptStatus,transactionHash:hash,logs})};
 const walletClient={getChainId:async()=>chain,getAddresses:async()=>[payer],sendTransaction:async()=>{sends++;return hash;}};
 return {adapter:new WhitechainAdapter({contractAddress:hub,publicClient,walletClient}),count:()=>sends};
}
test('checkout submits exact approval and payment then verifies settlement event',async()=>{const c=setup();assert.equal((await c.adapter.payInvoice(id)).txHash,hash);assert.equal(c.count(),2);});
test('sufficient allowance skips an unnecessary approval',async()=>{const c=setup({allowance:20000000n});await c.adapter.payInvoice(id);assert.equal(c.count(),1);});
test('network mismatch, reverted approval and missing settlement event cannot report success',async()=>{
 const wrong=setup({chain:1});await assert.rejects(wrong.adapter.payInvoice(id),/1874/);assert.equal(wrong.count(),0);
 const reverted=setup({receiptStatus:'reverted'});await assert.rejects(reverted.adapter.payInvoice(id),/approval reverted/);assert.equal(reverted.count(),1);
 const missing=setup({allowance:20000000n,event:false});await assert.rejects(missing.adapter.payInvoice(id),/no matching settlement/);
 await assert.rejects(new WhitechainAdapter({contractAddress:hub}).payInvoice(id),/Connect a wallet/);
});

test('payment evidence uses a bounded event range around the settlement timestamp', async () => {
 for (const paidBlock of [0n, 100n, 6500000n, 12999999n, 13000000n]) {
  let queried = false;
  const publicClient = {
   readContract: async () => ({invoiceId:id,merchant,customer:payer,amountPaid:20n,amountRefunded:0n,paidAt:1000n+paidBlock*2n,status:1}),
   getBlockNumber: async () => 13000000n,
   getBlock: async ({blockNumber}) => ({timestamp:1000n+blockNumber*2n}),
   getLogs: async ({fromBlock,toBlock,args,address,event}) => {
    queried = true;
    assert.ok(toBlock-fromBlock <= 1999n);
    assert.ok(fromBlock <= paidBlock && toBlock >= paidBlock);
    assert.equal(args.invoiceId,id);
    assert.equal(address,hub);
    assert.equal(event.name,'PaymentSettled');
    return [{transactionHash:hash}];
   }
  };
  const adapter = new WhitechainAdapter({contractAddress:hub,publicClient});
  const payment = await adapter.getPayment(id);
  assert.ok(queried);
  assert.equal(payment.txHash,hash);
  assert.equal(payment.amountPaidUnits,20n);
 }
});

test('settled payment remains readable if event history is unavailable', async () => {
 const record = {invoiceId:id,merchant,customer:payer,amountPaid:20n,amountRefunded:5n,paidAt:1000n,status:2};
 for (const fail of [true,false]) {
  const adapter = new WhitechainAdapter({contractAddress:hub,publicClient:{
   readContract:async()=>record,
   getBlockNumber:async()=>10n,
   getLogs:async()=>{if(fail)throw Error('RPC unavailable');return [];}
  }});
  const payment = await adapter.getPayment(id);
  assert.equal(payment.status,'PARTIALLY_REFUNDED');
  assert.equal(payment.amountRefundedUnits,5n);
  assert.equal(payment.txHash,'0x');
 }
});
