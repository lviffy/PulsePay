import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('../dist/index.js',import.meta.url));
const secret='a-test-only-secret-with-more-than-32-characters';
async function start(t,demo=false){
 const cwd=mkdtempSync(join(tmpdir(),'pulsepay-api-test-'));const port=33000+Math.floor(Math.random()*20000);const base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,[entry],{cwd,env:{PATH:process.env.PATH,PORT:String(port),PULSEPAY_APP_URL:base,HEDERA_MERCHANT_ACCOUNT_ID:'0.0.99999',PULSEPAY_API_SECRET:secret,PULSEPAY_DEMO_MODE:String(demo)}});
 let output='';child.stderr.on('data',d=>output+=d);child.stdout.on('data',d=>output+=d);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}rmSync(cwd,{recursive:true,force:true});});
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(output);try{await fetch(base);return {base,call:async(path,body,auth=true)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(auth?{'x-api-key':secret}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})};}catch{await new Promise(r=>setTimeout(r,25));}}
 throw Error('Server did not start: '+output);
}
test('merchant authentication, secret redaction, demo gate and unpaid proof handling',async(t)=>{
 const {base,call}=await start(t);
 assert.equal((await call('/api/merchant/state',undefined,false)).status,401);
 assert.equal((await call('/api/treasury/hook-config',{paused:true},false)).status,401);
 const state=await (await call('/api/merchant/state')).json();assert.equal('secret' in state.webhooks,false);
 assert.equal((await call('/api/treasury/hook-config',{paused:true})).status,501);
 const response=await fetch(base+'/api/merchant/state',{headers:{origin:'https://attacker.example'}});assert.equal(response.headers.get('access-control-allow-origin'),null);
 const csv=await (await call('/api/export.csv')).text();assert.equal(csv.trim().split('\n').length,1);
 assert.equal((await call('/v1/services/market-data-pro/query',{},false)).status,402);
 assert.equal((await fetch(base+'/v1/services/market-data-pro/query',{method:'POST',headers:{'payment-signature':'not-a-payment'}})).status,400);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:base},body:new URLSearchParams({secret}),redirect:'manual'});
 assert.equal(login.status,303);const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);
 assert.equal((await fetch(base+'/api/merchant/state',{headers:{cookie:cookie.split(';')[0]}})).status,200);
});
test('simulation validates amounts and never exports fabricated settlement',async(t)=>{
 const {call}=await start(t,true);
 for(const amount of [-100,'invalid',null,0,0.0000001])assert.equal((await call('/api/treasury/swap',{fromAsset:'USDT',toAsset:'WETH',amountUsdt:amount})).status,400);
 assert.equal((await call('/api/invoices/create',{title:'bad',amountUsdt:-20})).status,400);
 assert.equal((await call('/api/invoices/refund',{invoiceId:'inv_acme_pro_001',amountUsdt:'invalid'})).status,400);
 const swap=await (await call('/api/treasury/swap',{fromAsset:'USDT',toAsset:'WETH',amountUsdt:'100.01'})).json();assert.equal(swap.simulated,true);assert.equal(swap.txId,undefined);
 const invoice=await (await call('/api/invoices/create',{title:'<img src=x onerror=alert(1)>',amountUsdt:'20.000001'})).json();
 assert.equal(invoice.simulated,true);const html=await (await call(invoice.invoice.receiptUrl)).text();assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('Simulation'));
 const csv=await (await call('/api/export.csv')).text();assert.equal(csv.trim().split('\n').length,1);
});
