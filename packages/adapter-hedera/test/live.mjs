// Wallet preparation and read-only verification only; this script never signs or submits.
import {Client,Transaction,TopicCreateTransaction,PublicKey,TransactionId,AccountId,Hbar} from '@hiero-ledger/sdk';
import {writeFileSync,readFileSync} from 'node:fs';
import {PulsePayHcsAuditHook,HederaMirrorClient,IssueRefundTool,AgentMode,createAuditTopic,reconcileAuditTopic} from '../dist/index.js';
const [command,...args]=process.argv.slice(2);
const account=process.env.HEDERA_OPERATOR_ID || '0.0.11327364';
const key=PublicKey.fromString('0332a9cc91ac21a073d74c352a74e8441079b9812797bc9ebc82cf17a2c15642a0');
if(command==='estimate-topic'){
 const client=Client.forTestnet();
 try {
  const tx=new TopicCreateTransaction().setTopicMemo('PulsePay Audit Log').setAdminKey(key).setSubmitKey(key).setAutoRenewPeriod(2592000)
   .setTransactionId(TransactionId.generate(account)).setNodeAccountIds([AccountId.fromString('0.0.3')]).setMaxTransactionFee(new Hbar(0.25)).freeze();
  const estimate=await tx.estimateFee().execute(client,10000);
  const exchange=await (await fetch('https://testnet.mirrornode.hedera.com/api/v1/network/exchangerate')).json();
  const rate=exchange.current_rate;
  const feeTinybars=(BigInt(estimate.total.toString())*BigInt(rate.hbar_equivalent)+BigInt(rate.cent_equivalent)-1n)/BigInt(rate.cent_equivalent);
  console.log(JSON.stringify({tinycents:estimate.total.toString(),estimatedTinybars:feeTinybars.toString(),estimate,exchange:rate},(_,v)=>typeof v==='bigint'?String(v):v));
 } finally{client.close();}
}else if(command==='estimate-prepared'){
 const prepared=JSON.parse(readFileSync(args[0],'utf8'));
 const client=Client.forTestnet();
 try{
  const tx=Transaction.fromBytes(Buffer.from(prepared.bytes,'base64'));
  const estimate=await tx.estimateFee().execute(client,10000);
  const exchange=await(await fetch('https://testnet.mirrornode.hedera.com/api/v1/network/exchangerate')).json();
  const rate=exchange.current_rate;
  const tinybars=(BigInt(estimate.total.toString())*BigInt(rate.hbar_equivalent)+BigInt(rate.cent_equivalent)-1n)/BigInt(rate.cent_equivalent);
  console.log(JSON.stringify({transactionId:tx.transactionId.toString(),estimatedTinybars:tinybars.toString(),maxFeeTinybars:tx.maxTransactionFee.toTinybars().toString()}));
 }finally{client.close();}
}else if(command==='prepare-topic'){
 console.log(JSON.stringify(await createAuditTopic({operatorAccountId:account,accountPublicKey:key.toStringRaw(),mode:AgentMode.RETURN_BYTES,maxTransactionFeeTinybars:50000000n})));
}else if(command==='reconcile-topic'){
 console.log(JSON.stringify(await reconcileAuditTopic(args[0],{operatorAccountId:account,accountPublicKey:key.toStringRaw()})));
}else if(command==='prepare-audit'){
 const hook=new PulsePayHcsAuditHook({topicId:args[0]});
 let bytes, transactionId;
 const result=await hook.retryPending({operatorAccountId:account,maxTransactionFeeTinybars:2000000n,submitTransaction:async(tx)=>{
  if(!tx.transactionId)tx.setTransactionId(TransactionId.generate(account));
  transactionId=tx.transactionId.toString();
  tx.setNodeAccountIds([AccountId.fromString('0.0.3')]).freeze();
  bytes=Buffer.from(tx.toBytes()).toString('base64');
  throw Error('Prepared for wallet; no submission has occurred');
 }});
 if(!bytes)throw Error('No pending audit record to prepare');
 console.log(JSON.stringify({bytes,transactionId,result}));
}else if(command==='confirm-audit'){
 const expected=await new HederaMirrorClient().transaction(args[1]);
 const pending=JSON.parse(readFileSync('.pulsepay/audit-pending.json','utf8'));
 if(!Object.values(pending).length)throw Error('No pending audit');
 const response=await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${args[0]}/messages?timestamp=${expected.consensus_timestamp}`);
 const messages=(await response.json()).messages;
 const results=await new PulsePayHcsAuditHook({topicId:args[0]}).retryPending({operatorAccountId:account,submitTransaction:async(tx)=>{
  const expectedMessage=Buffer.from(tx.getMessage()).toString('base64');
  if(!messages.some(m=>m.message===expectedMessage))throw Error('On-chain audit payload does not match pending record');
  return {transactionId:expected.transaction_id,consensusStatus:expected.result};
 }});
 console.log(JSON.stringify(results));
}else if(command==='confirm-refund'){
 console.log(JSON.stringify(await new IssueRefundTool().confirmRefund(args[0],args[1],{operatorAccountId:account})));
}else if(command==='prepare-refund'){
 const tool=new IssueRefundTool();
 console.log(JSON.stringify(await tool.execute({serviceId:'market-data-pro',agentAccountId:'0.0.11327364',originalTransactionId:args[0],amountTinybars:'1'},
 {operatorAccountId:account,mode:AgentMode.RETURN_BYTES,maxTransactionFeeTinybars:1000000n})));
}else if(command==='verify-http'){
 const base=args[0]||'http://127.0.0.1:3188';
 for(const path of ['/','/merchant','/api/export.csv','/.well-known/x402.json']){
  const r=await fetch(base+path);if(r.status!==200)throw Error(path+' '+r.status);console.log('PASS '+path);
 }
 const url=base+'/v1/services/market-data-pro/query';
 if((await fetch(url,{method:'POST',headers:{'PAYMENT-SIGNATURE':'not-a-payment'}})).status!==400)throw Error('Forged payment header was accepted');
 console.log('PASS forged proof rejected');
 const pending=JSON.parse(readFileSync('.pulsepay/buyer-pending.json','utf8'));
 const replay=await fetch(url,{method:'POST',headers:{'PAYMENT-SIGNATURE':JSON.stringify({challengeId:pending.requirement.challengeId,transactionId:pending.transactionId})}});
 if(replay.status!==409)throw Error('Replay did not return 409: '+replay.status);console.log('PASS live payment replay rejected');
 const payments=await (await fetch(base+'/api/hedera/payments')).json();
 if(!payments.some(p=>p.transactionId===pending.transactionId.replace('@','-').replace(/(\d+\.\d+\.\d+-\d+)\./,'$1-')))throw Error('Live settlement not in ledger');
 const receipt=await fetch(base+'/receipt/hedera/'+payments[0].transactionId);if(receipt.status!==200)throw Error('Receipt unavailable');
 console.log('PASS verified ledger and public receipt');
}else throw Error('Unknown live-test command');
