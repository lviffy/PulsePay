import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('../dist/index.js',import.meta.url));
const secret='a-test-only-secret-with-more-than-32-characters';
async function start(t,demo=false,extraEnv={}){
 const cwd=mkdtempSync(join(tmpdir(),'pulsepay-api-test-'));const port=33000+Math.floor(Math.random()*20000);const base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[entry],{cwd,env:{PATH:process.env.PATH,PORT:String(port),PULSEPAY_APP_URL:base,HEDERA_MERCHANT_ACCOUNT_ID:'0.0.99999',PULSEPAY_API_SECRET:secret,PULSEPAY_DEMO_MODE:String(demo),...extraEnv}});
 let output='';child.stderr.on('data',d=>output+=d);child.stdout.on('data',d=>output+=d);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}rmSync(cwd,{recursive:true,force:true});});
 for(let i=0;i<400;i++){if(child.exitCode!==null)throw Error(output);try{await fetch(base);return {base,call:async(path,body,auth=true)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(auth?{'x-api-key':secret}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})};}catch{await new Promise(r=>setTimeout(r,25));}}
 throw Error('Server did not start: '+output);
}
test('partial Hedera EVM configuration disables only the optional invoice service',async(t)=>{
 const {base}=await start(t,false,{HEDERA_EVM_SETTLEMENT_TOKEN_ADDRESS:'0x0000000000000000000000000000000000068cda',HEDERA_EVM_BUYER_ADDRESS:'0x1111111111111111111111111111111111111111'});
 const manifest=await (await fetch(base+'/.well-known/x402.json')).json();
 assert.ok(!manifest.services.some(service=>service.id==='agent-invoice-pro'));
});
test('merchant authentication, removed routes and unpaid proof handling',async(t)=>{
 const {base,call}=await start(t);
 assert.equal((await call('/api/merchant/state',undefined,false)).status,401);
 assert.equal((await call('/api/treasury/hook-config',{paused:true},false)).status,401);
 const state=await (await call('/api/merchant/state')).json();assert.equal('webhooks' in state,false);assert.equal(state.mode,'LIVE_HEDERA');assert.deepEqual(state.activities,[]);
 assert.equal((await call('/api/treasury/hook-config',{paused:true})).status,410);
 const response=await fetch(base+'/api/merchant/state',{headers:{origin:'https://attacker.example'}});assert.equal(response.headers.get('access-control-allow-origin'),null);
 const csv=await (await call('/api/export.csv')).text();assert.equal(csv.trim().split('\n').length,1);
 assert.equal((await call('/v1/services/market-data-pro/query',{},false)).status,402);
 assert.equal((await fetch(base+'/v1/services/market-data-pro/query',{method:'POST',headers:{'payment-signature':'not-a-payment'}})).status,400);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base},body:new URLSearchParams({secret}),redirect:'manual'});
 assert.equal(login.status,303);const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);
 assert.equal((await fetch(base+'/api/merchant/state',{headers:{cookie:cookie.split(';')[0]}})).status,200);
});
test('removed previews cannot be re-enabled and never return fabricated settlement',async(t)=>{
 const {base,call}=await start(t,true);
 const routes=['/api/invoices/create','/api/invoices/refund','/api/treasury/hook-config','/api/treasury/swap','/api/treasury/claim-fees','/api/subscriptions/renew','/api/reserves/withdraw','/api/webhooks/test'];
 for(const route of routes){
  const response=await call(route,{});
  assert.equal(response.status,410,route);
  assert.match((await response.json()).error,/removed/);
 }
 const state=await (await call('/api/merchant/state')).json();
 assert.equal(state.mode,'LIVE_HEDERA');
 assert.equal(state.totalHbarTinybars,'0');
 for(const field of ['invoices','subscriptions','metrics','webhooks'])assert.equal(field in state,false,field);
 const home=await (await fetch(base)).text();
 assert.match(home,/PulsePay payment API/);
 assert.ok(!home.includes('inv_acme_pro_001'));
 assert.equal((await fetch(base+'/receipt/inv_acme_pro_001')).status,404);
 assert.equal((await fetch(base+'/receipt/hedera/missing')).status,404);
 const merchant=await fetch(base+'/merchant',{redirect:'manual'});
 assert.equal(merchant.status,303);
 assert.equal(merchant.headers.get('location'),'http://localhost:3100/merchant');
 const csv=await (await call('/api/export.csv')).text();assert.equal(csv.trim().split('\n').length,1);
 const manifest=await (await fetch(base+'/.well-known/x402.json')).json();
 assert.ok(manifest.services.every(service=>service.description.includes('sample')));
});
