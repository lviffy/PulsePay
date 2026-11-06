import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { encodeAbiParameters, encodeEventTopics } from 'viem';
import { AgentMode, X402PayTool, IssueRefundTool, HederaEvmInvoicePayTool, PulsePaySpendLimitPolicy, PulsePayTokenSpendPolicy, PulsePayHcsAuditHook, PulsePayHederaPlugin, HederaMirrorClient, hederaMerchantHubAbi, verifyHederaInvoicePayment } from '../dist/index.js';
const require = createRequire(import.meta.url);
const kit = await import(require.resolve('@hashgraph/hedera-agent-kit').replace('/cjs/index.js', '/esm/index.mjs'));
const sender='0.0.11327364', merchant='0.0.11329845', id=`${sender}-1793911165-521929932`;
const params={serviceId:'test',merchantAccountId:merchant,amountTinybars:'1'};
const temp=()=>mkdtempSync(join(tmpdir(),'pulsepay-test-'));
const context=()=>({operatorAccountId:sender,storageDirectory:temp(),submitTransaction:async()=>({transactionId:`${sender}@1793911165.521929932`,consensusStatus:'SUCCESS'})});
const record=(amount=2)=>({transaction_id:id,result:'SUCCESS',consensus_timestamp:'1793911194.292352576',memo_base64:Buffer.from('PulsePay x402: test').toString('base64'),charged_tx_fee:1,transfers:[{account:sender,amount:-amount-1},{account:merchant,amount}]});
const refundParams={serviceId:'test',agentAccountId:sender,originalTransactionId:id,amountTinybars:'1'};
const refundContext=()=>({...context(),operatorAccountId:merchant,mirror:{transaction:async()=>record()}});

test('official Agent Kit registration and execution use real BaseTool subclasses',async()=>{
 const plugin=new PulsePayHederaPlugin();const registry=new kit.PluginRegistry();registry.register(plugin);
 const tools=registry.getTools({});assert.equal(tools.length,3);assert(tools.every(t=>t instanceof kit.BaseTool));
 const ctx=context();const result=await tools[0].execute(undefined,ctx,params);assert.equal(result.status,'SETTLED');assert.equal(result.amountHbar,'0.00000001');
});
test('Hedera EVM invoice tool validates onchain terms, approves exact amount and pays',async()=>{
 const payer='0x1111111111111111111111111111111111111111',hub='0x2222222222222222222222222222222222222222',token='0x3333333333333333333333333333333333333333',evmMerchant='0x4444444444444444444444444444444444444444';
 const invoiceId=`0x${'12'.repeat(32)}`,submitted=[];
 const evmParams={chainId:296,hubAddress:hub,tokenAddress:token,merchantAddress:evmMerchant,payerAddress:payer,invoiceId,amountUnits:'1000000',challengeId:'ab'.repeat(16)};
 const publicClient={getChainId:async()=>296,readContract:async request=>request.functionName==='settlementToken'?token:request.functionName==='getInvoice'?[invoiceId,evmMerchant,payer,1000000n,BigInt(Math.floor(Date.now()/1000)+300),1,`0x${'00'.repeat(32)}`]:0n,
  simulateContract:async request=>({request}),waitForTransactionReceipt:async()=>({status:'success'})};
 const walletClient={getAddresses:async()=>[payer],writeContract:async request=>{submitted.push(request.functionName);return `0x${String(submitted.length).padStart(64,'0')}`;}};
 const tool=new HederaEvmInvoicePayTool();tool.registerHook(new PulsePayTokenSpendPolicy({chainId:296,tokenAddress:token,dailyBudgetUnits:2000000n,maxPerRequestUnits:1000000n,hubAllowlist:[hub],merchantAllowlist:[evmMerchant]}));
 const result=await tool.execute(evmParams,{evmPublicClient:publicClient,evmWalletClient:walletClient});
 assert.equal(result.status,'SETTLED');assert.deepEqual(submitted,['approve','payInvoice']);
});
test('token spend policy blocks altered contract terms before an EVM transaction',async()=>{
 const payer='0x1111111111111111111111111111111111111111',hub='0x2222222222222222222222222222222222222222',token='0x3333333333333333333333333333333333333333',evmMerchant='0x4444444444444444444444444444444444444444';
 const base={chainId:296,hubAddress:hub,tokenAddress:token,merchantAddress:evmMerchant,payerAddress:payer,invoiceId:`0x${'12'.repeat(32)}`,amountUnits:'2',challengeId:'ab'.repeat(16)};
 let reads=0;const tool=new HederaEvmInvoicePayTool();tool.registerHook(new PulsePayTokenSpendPolicy({chainId:296,tokenAddress:token,dailyBudgetUnits:1n,maxPerRequestUnits:1n,hubAllowlist:[hub]}));
 await assert.rejects(tool.execute(base,{evmPublicClient:{getChainId:async()=>{reads++;return 296}}}),/per-request/);assert.equal(reads,0);
});
test('missing configuration fails instead of fabricating settlement',async()=>{
 await assert.rejects(new X402PayTool().execute(params),/operator/);
 await assert.rejects(new X402PayTool().execute(params,{operatorAccountId:sender}),/client or wallet/);
});
test('positive int64 amounts only; exact formatting and byte-sized memo bounds',async()=>{
 for(const amountTinybars of ['0','-1',-1,0,1.1,Number.MAX_SAFE_INTEGER+1,'9223372036854775808','',null]) await assert.rejects(new X402PayTool().execute({...params,amountTinybars},context()));
 await assert.rejects(new X402PayTool().execute({...params,merchantAccountId:sender},context()),/different/);
 await assert.rejects(new X402PayTool().execute({...params,serviceId:'🪙'.repeat(40)},context()));
});
test('request cap, recipient allowlist and daily budget block before signing',async()=>{
 let signed=0;const ctx={...context(),submitTransaction:async()=>{signed++;return {transactionId:id,consensusStatus:'SUCCESS'}}};
 const tool=new X402PayTool();tool.registerHook(new PulsePaySpendLimitPolicy({dailyBudgetTinybars:1n,maxPerRequestTinybars:1n,merchantAllowlist:[merchant]}));
 await assert.rejects(tool.execute({...params,amountTinybars:'2'},ctx),/per-request/);
 await assert.rejects(tool.execute({...params,merchantAccountId:'0.0.12345'},ctx),/allowlist/);
 assert.equal(signed,0);await tool.execute(params,ctx);await assert.rejects(tool.execute(params,ctx),/daily budget/);assert.equal(signed,1);
});
test('pre-submission failures release reservations; ambiguous submissions retain them',async()=>{
 const tool=new X402PayTool(),policy=new PulsePaySpendLimitPolicy({dailyBudgetTinybars:2n,maxPerRequestTinybars:2n});tool.registerHook(policy);
 await assert.rejects(tool.execute(params,{operatorAccountId:sender}),/client or wallet/);assert.equal(policy.getRemainingDailyBudgetTinybars(),2n);
 await assert.rejects(tool.execute(params,{...context(),submitTransaction:async()=>{throw Error('network lost')}}),/network lost/);assert.equal(policy.getRemainingDailyBudgetTinybars(),1n);
});
test('concurrent payments cannot overrun a shared daily limit',async()=>{
 const tool=new X402PayTool();tool.registerHook(new PulsePaySpendLimitPolicy({dailyBudgetTinybars:1n,maxPerRequestTinybars:1n}));
 const result=await Promise.allSettled([tool.execute(params,context()),tool.execute(params,context())]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
});
test('budget survives a policy restart and resets on a full calendar date',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-01-06T00:00:00Z')});
 const statePath=join(temp(),'budget.json');const config={dailyBudgetTinybars:2n,maxPerRequestTinybars:2n,statePath};
 const tool=new X402PayTool();tool.registerHook(new PulsePaySpendLimitPolicy(config));await tool.execute(params,context());assert.equal(new PulsePaySpendLimitPolicy(config).getRemainingDailyBudgetTinybars(),1n);
 t.mock.timers.setTime(new Date('2026-02-06T00:00:00Z').getTime());assert.equal(new PulsePaySpendLimitPolicy(config).getRemainingDailyBudgetTinybars(),2n);
});
test('RETURN_BYTES reserves budget without claiming settlement or writing audit logs',async()=>{
 const ctx={operatorAccountId:sender,mode:AgentMode.RETURN_BYTES,storageDirectory:temp()};const tool=new X402PayTool();const policy=new PulsePaySpendLimitPolicy({dailyBudgetTinybars:1n,maxPerRequestTinybars:1n});tool.registerHook(policy);tool.registerHook(new PulsePayHcsAuditHook());
 const result=await tool.execute(params,ctx);assert.equal(result.status,'PREPARED');assert(result.bytes);assert.equal(result.audit,undefined);assert.equal(policy.getRemainingDailyBudgetTinybars(),0n);
});
test('refunds verify original payer, merchant, positive amount and cumulative bounds',async()=>{
 const ctx=refundContext(),tool=new IssueRefundTool();
 await assert.rejects(tool.execute({...refundParams,agentAccountId:'0.0.999'},ctx),/original payer/);
 await assert.rejects(tool.execute({...refundParams,amountTinybars:'3'},ctx),/remaining/);
 const first=await tool.execute(refundParams,ctx);assert.equal(first.status,'REFUNDED');
 await tool.execute(refundParams,ctx);await assert.rejects(tool.execute(refundParams,ctx),/remaining/);
 const restarted=new IssueRefundTool();await assert.rejects(restarted.execute(refundParams,ctx),/remaining/);
});
test('refund policy applies the recipient allowlist to agentAccountId',async()=>{
 const tool=new IssueRefundTool();tool.registerHook(new PulsePaySpendLimitPolicy({dailyBudgetTinybars:10n,maxPerRequestTinybars:10n,merchantAllowlist:[merchant],allowedTools:['issue_refund_tool']}));
 await assert.rejects(tool.execute(refundParams,refundContext()),/allowlist/);
});
test('ambiguous refund blocks duplicate execution after restart',async()=>{
 const ctx={...refundContext(),submitTransaction:async()=>{throw Error('lost receipt')}};
 await assert.rejects(new IssueRefundTool().execute(refundParams,ctx),/lost receipt/);
 await assert.rejects(new IssueRefundTool().execute(refundParams,ctx),/reconciliation/);
});
test('HCS failure is visible, persisted and retryable without resending payment',async()=>{
 const ctx=context();const tool=new X402PayTool();const audit=new PulsePayHcsAuditHook();tool.registerHook(audit);
 const result=await tool.execute(params,ctx);assert.equal(result.status,'SETTLED');assert.equal(result.audit.status,'PENDING');
 const pending=JSON.parse(readFileSync(join(ctx.storageDirectory,'audit-pending.json'),'utf8'));assert.equal(Object.keys(pending).length,1);assert.equal(Object.values(pending)[0].payload.result.transactionId,result.transactionId);
 const retry=new PulsePayHcsAuditHook({topicId:'0.0.123'});let writes=0;
 const retried=await retry.retryPending({...ctx,submitTransaction:async()=>{writes++;return {transactionId:id,consensusStatus:'SUCCESS'}}});
 assert.equal(retried[0].status,'CONFIRMED');assert.equal(writes,1);assert.deepEqual(JSON.parse(readFileSync(join(ctx.storageDirectory,'audit-pending.json'),'utf8')),{});
});
test('mirror lookups require a matching successful transaction record',async()=>{
 const mirror=new HederaMirrorClient('testnet',async()=>new Response(JSON.stringify({transactions:[record()]})));
 assert.equal((await mirror.transaction(id)).result,'SUCCESS');
 const bad=new HederaMirrorClient('testnet',async()=>new Response(JSON.stringify({transactions:[{...record(),result:'FAIL_INVALID'}]})));
 await assert.rejects(bad.transaction(id),/settled/);
});
test('Mirror contract proof decodes and binds every PaymentSettled field',async()=>{
 const payer='0x1111111111111111111111111111111111111111',hub='0x2222222222222222222222222222222222222222',evmMerchant='0x4444444444444444444444444444444444444444';
 const invoiceId=`0x${'12'.repeat(32)}`,transactionHash=`0x${'ab'.repeat(32)}`,paidAt=1793911194n;
 const topics=encodeEventTopics({abi:hederaMerchantHubAbi,eventName:'PaymentSettled',args:{invoiceId,merchant:evmMerchant,customer:payer}});
 const data=encodeAbiParameters([{type:'uint256'},{type:'uint64'}],[1000000n,paidAt]);
 const result={status:'SUCCESS',from:payer,to:hub,transaction_hash:transactionHash,logs:[{address:hub,topics,data}]};
 const mirror=new HederaMirrorClient('testnet',async()=>new Response(JSON.stringify(result)));
 const verified=await verifyHederaInvoicePayment({mirror,transactionIdOrHash:transactionHash,hubAddress:hub,invoiceId,merchantAddress:evmMerchant,payerAddress:payer,amountUnits:1000000n});
 assert.deepEqual(verified,{transactionHash,paidAt});
 await assert.rejects(verifyHederaInvoicePayment({mirror,transactionIdOrHash:transactionHash,hubAddress:hub,invoiceId,merchantAddress:evmMerchant,payerAddress:payer,amountUnits:999999n}),/does not match/);
});
test('prepared wallet payments retain budget across restarts and confirm only once',async()=>{
 const statePath=join(temp(),'wallet-budget.json'),config={dailyBudgetTinybars:1n,maxPerRequestTinybars:1n,statePath};
 const tool=new X402PayTool();tool.registerHook(new PulsePaySpendLimitPolicy(config));
 const result=await tool.execute(params,{operatorAccountId:sender,mode:AgentMode.RETURN_BYTES});
 const restarted=new PulsePaySpendLimitPolicy(config);assert.equal(restarted.getRemainingDailyBudgetTinybars(),0n);
 restarted.recordConfirmedSpend(result.transactionId,1n);restarted.recordConfirmedSpend(result.transactionId,1n);assert.equal(restarted.getRemainingDailyBudgetTinybars(),0n);
});
test('wallet refund reservation blocks duplicates and confirms only a matching receipt',async()=>{
 const ctx={...refundContext(),mode:AgentMode.RETURN_BYTES};const tool=new IssueRefundTool();
 const prepared=await tool.execute(refundParams,ctx);
 await assert.rejects(tool.execute(refundParams,ctx),/reconciliation/);
 const refundId=prepared.transactionId.replace('@','-').replace(/(\d+\.\d+\.\d+-\d+)\./,'$1-');
 const matching={...record(),transaction_id:refundId,memo_base64:Buffer.from(`PulsePay Refund: ${id}`).toString('base64'),transfers:[{account:merchant,amount:-2},{account:sender,amount:1}]};
 ctx.mirror.transaction=async txid=>txid===id?record():matching;
 assert.equal((await tool.confirmRefund(id,prepared.transactionId,ctx)).status,'REFUNDED');
 await tool.confirmRefund(id,prepared.transactionId,ctx);
 const ledger=JSON.parse(readFileSync(join(ctx.storageDirectory,'refunds.json'),'utf8'));
 assert.equal(ledger[id].refunded,'1');
});
test('definitive failed consensus releases payment and refund reservations',async()=>{
 const ctx={...context(),submitTransaction:async()=>({transactionId:id,consensusStatus:'INSUFFICIENT_TX_FEE'})};
 const tool=new X402PayTool(),policy=new PulsePaySpendLimitPolicy({dailyBudgetTinybars:1n,maxPerRequestTinybars:1n});tool.registerHook(policy);
 await assert.rejects(tool.execute(params,ctx),/INSUFFICIENT_TX_FEE/);assert.equal(policy.getRemainingDailyBudgetTinybars(),1n);
 const rc={...refundContext(),submitTransaction:ctx.submitTransaction};
 await assert.rejects(new IssueRefundTool().execute(refundParams,rc),/INSUFFICIENT_TX_FEE/);
 rc.submitTransaction=context().submitTransaction;assert.equal((await new IssueRefundTool().execute(refundParams,rc)).status,'REFUNDED');
});
test('client and refund mirror cannot silently use a different network',async()=>{
 await assert.rejects(new X402PayTool().execute(params,{...context(),client:{ledgerId:{toString:()=> 'mainnet'}}}),/network/);
 const ctx=refundContext();ctx.mirror.network='mainnet';await assert.rejects(new IssueRefundTool().execute(refundParams,ctx),/network/);
});
test('topic preparation journals its transaction and refuses unconfirmed duplicate creation',async()=>{
 const {createAuditTopic}=await import('../dist/index.js');
 const ctx={operatorAccountId:sender,accountPublicKey:'0332a9cc91ac21a073d74c352a74e8441079b9812797bc9ebc82cf17a2c15642a0',storageDirectory:temp(),mode:AgentMode.RETURN_BYTES,maxTransactionFeeTinybars:50000000n,
 mirror:{transaction:async()=>{throw Error('not indexed')}}};
 const first=await createAuditTopic(ctx);assert.equal(first.status,'PREPARED');
 await assert.rejects(createAuditTopic(ctx),/Reconcile/);
});
test('ledger reconciliation reuses a successfully created topic after a lost acknowledgment',async()=>{
 const {createAuditTopic,reconcileAuditTopic}=await import('../dist/index.js');
 const key='0332a9cc91ac21a073d74c352a74e8441079b9812797bc9ebc82cf17a2c15642a0';
 let calls=0;const ctx={operatorAccountId:sender,accountPublicKey:key,storageDirectory:temp(),mirror:{
 transaction:async()=>({...record(),name:'CONSENSUSCREATETOPIC',entity_id:'0.0.123'}),
 topic:async()=>({memo:'PulsePay Audit Log',admin_key:{key},submit_key:{key}})},submitTransaction:async()=>{calls++;throw Error('must not submit')}};
 await reconcileAuditTopic(id,ctx);const existing=await createAuditTopic(ctx);assert.equal(existing.status,'EXISTING');assert.equal(existing.topicId,'0.0.123');assert.equal(calls,0);
});
test('lost audit acknowledgment is reconciled without a second paid submission',async()=>{
 const ctx=context();let submissions=0;
 ctx.submitTransaction=async()=>{submissions++;throw Error('lost wallet acknowledgment')};
 // The transfer uses a separate successful transport; only the audit writer loses its acknowledgment.
 const audit=new PulsePayHcsAuditHook({topicId:'0.0.123',submitTransaction:ctx.submitTransaction});
 const payment={status:'SETTLED',transactionId:id,amountTinybars:'1'};
 await audit.postToolExecutionHook({context:ctx,toolResult:payment},'x402_pay_tool');assert.equal(payment.audit.status,'PENDING');assert.equal(submissions,1);
 const pending=JSON.parse(readFileSync(join(ctx.storageDirectory,'audit-pending.json'),'utf8'));
 const entry=Object.values(pending)[0];assert(entry.transactionId);
 const recovered=await audit.retryPending({...ctx,mirror:{transaction:async()=>({...record(),transaction_id:entry.transactionId,name:'CONSENSUSSUBMITMESSAGE'}),verifyTopicMessage:async()=>true}});
 assert.equal(recovered[0].status,'CONFIRMED');assert.equal(submissions,1);
});
test('file-backed state rejects a second owner and releases on orderly shutdown',async()=>{
 const {acquireStateOwner}=await import('../dist/index.js');const directory=temp();
 const release=acquireStateOwner(directory,'worker');assert.throws(()=>acquireStateOwner(directory,'worker'),/already owned/);
 release();acquireStateOwner(directory,'worker')();
});
test('payment journal is written before submission and journal failure prevents spending',async()=>{
 let prepared=false,submitted=0;
 const ctx={...context(),onPaymentPrepared:id=>{assert.match(id,/^0\.0\.11327364@/);prepared=true;},submitTransaction:async()=>{assert.equal(prepared,true);submitted++;return {transactionId:id,consensusStatus:'SUCCESS'};}};
 await new X402PayTool().execute(params,ctx);assert.equal(submitted,1);
 await assert.rejects(new X402PayTool().execute(params,{...ctx,onPaymentPrepared:()=>{throw Error('disk full');}}),/disk full/);assert.equal(submitted,1);
});
