import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {handleX402PaymentCheck,getVerifiedHederaPayments} from '../dist/index.js';
const payer='0.0.11327364',recipient='0.0.11329845',id=`${payer}-1793911165-521929932`;
function setup(){
 const statePath=join(mkdtempSync(join(tmpdir(),'pulsepay-http-')),'state.json');
 const config={serviceId:'test',serviceName:'Test API',statePath,price:{network:'hedera:testnet',asset:'0.0.0',amountTinybars:'1',payTo:recipient}};
 return config;
}
async function challenge(config){const r=await handleX402PaymentCheck(config);assert.equal(r.statusCode,402);return r.body.requirement;}
function record(c,overrides={}){return {transaction_id:id,result:'SUCCESS',consensus_timestamp:String(Math.floor(Date.now()/1000)),memo_base64:Buffer.from('PulsePay x402: '+createHash('sha256').update(c.challengeId).digest('hex').slice(0,32)).toString('base64'),transfers:[{account:payer,amount:-101},{account:recipient,amount:1}],...overrides};}
const proof=c=>JSON.stringify({challengeId:c.challengeId,transactionId:id});
test('unpaid challenge and invalid header fail closed',async()=>{
 const c=setup();await challenge(c);for(const header of ['not-a-payment','{}','{"challengeId":"fake"}']) assert.equal((await handleX402PaymentCheck(c,header)).authorized,false);
});
test('verified receipt retry returns the saved result without another purchase',async()=>{
 const c=setup(),r=await challenge(c);c.mirror={network:'testnet',transaction:async()=>record(r)};
 let executions=0;c.createResponse=()=>({sequence:++executions});
 const first=await handleX402PaymentCheck(c,proof(r));
 const retry=await handleX402PaymentCheck({...c},proof(r));
 assert.equal(first.statusCode,200);assert.equal(retry.statusCode,200);assert.deepEqual(retry.body,first.body);assert.equal(executions,1);assert.equal(getVerifiedHederaPayments(c.statePath).length,1);assert.equal('challengeId' in getVerifiedHederaPayments(c.statePath)[0],false);
});
test('wrong amount, recipient, memo, service and network are rejected',async()=>{
 for(const change of [{transfers:[{account:payer,amount:-2},{account:recipient,amount:2}]},{transfers:[{account:payer,amount:-2},{account:'0.0.999',amount:1}]},{memo_base64:Buffer.from('unbound').toString('base64')},{consensus_timestamp:'1'}]){
 const c=setup(),r=await challenge(c);c.mirror={network:'testnet',transaction:async()=>record(r,change)};assert.equal((await handleX402PaymentCheck(c,proof(r))).statusCode,400);
 }
 const c=setup(),r=await challenge(c);c.mirror={network:'mainnet',transaction:async()=>record(r)};assert.equal((await handleX402PaymentCheck(c,proof(r))).statusCode,400);
 assert.equal((await handleX402PaymentCheck({...c,serviceId:'different'},proof(r))).statusCode,400);
 await assert.rejects(handleX402PaymentCheck({...c,price:{...c.price,asset:'0.0.123'}}),/native HBAR/);
});
test('expired challenges are rejected without lookup',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date()});const c=setup(),r=await challenge(c);t.mock.timers.tick(301000);assert.equal((await handleX402PaymentCheck(c,proof(r))).statusCode,402);
});
test('concurrent retries return one persisted execution',async()=>{
 const c=setup(),r=await challenge(c);c.mirror={network:'testnet',transaction:async()=>{await new Promise(r=>setTimeout(r,5));return record(r)}};
 let executions=0;c.createResponse=()=>({sequence:++executions});
 const results=await Promise.all([handleX402PaymentCheck(c,proof(r)),handleX402PaymentCheck(c,proof(r))]);assert.deepEqual(results.map(r=>r.statusCode),[200,200]);assert.deepEqual(results[0].body,results[1].body);assert.equal(executions,1);
});
test('mirror outage preserves proof for retry instead of charging again',async()=>{
 const c=setup(),r=await challenge(c);c.mirror={network:'testnet',transaction:async()=>{throw Error('offline')}};assert.equal((await handleX402PaymentCheck(c,proof(r))).statusCode,503);
 c.mirror.transaction=async()=>record(r);assert.equal((await handleX402PaymentCheck(c,proof(r))).statusCode,200);
});
test('challenge creation prunes expired entries and enforces storage bounds',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date()});
 const c={...setup(),maxPendingChallenges:1};const first=await challenge(c);
 assert.equal((await handleX402PaymentCheck(c)).statusCode,429);
 t.mock.timers.tick(301000);const second=await challenge(c);assert.notEqual(first.challengeId,second.challengeId);
 assert.equal((await handleX402PaymentCheck({...c,maxStoredChallenges:1})).statusCode,503);
});
