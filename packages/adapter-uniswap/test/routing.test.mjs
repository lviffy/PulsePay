import test from 'node:test';
import assert from 'node:assert/strict';
import {UniswapRoutingAdapter} from '../dist/index.js';
const input='0x1111111111111111111111111111111111111111',output='0x2222222222222222222222222222222222222222';
const params={tokenInAddress:input,tokenInSymbol:'WETH',tokenInDecimals:18,tokenOutAddress:output,targetUsdtAmountUnits:20000000n,payerAddress:'0x3333333333333333333333333333333333333333'};
test('missing key and unsupported Whitechain cannot produce synthetic quotes',async()=>{
 assert.throws(()=>new UniswapRoutingAdapter({chainId:1874}),/not supported/);
 await assert.rejects(new UniswapRoutingAdapter().getExactOutputQuote(params),/API_KEY/);
});
test('real exact-output API request preserves amounts and validates the response',async(t)=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls++;assert.equal(url,'https://trade-api.gateway.uniswap.org/v1/quote');
  const request=JSON.parse(options.body);assert.equal(request.amount,'20000000');assert.equal(request.type,'EXACT_OUTPUT');assert.equal(request.tokenInChainId,'1301');assert.equal(options.headers['x-api-key'],'test');
  return Response.json({routing:'CLASSIC',quote:{input:{token:input,amount:'123456789123456789'},output:{token:output,amount:'20000000'},gasUseEstimate:'123000'}});
 });
 const result=await new UniswapRoutingAdapter({apiKey:'test'}).getExactOutputQuote(params);assert.equal(calls,1);assert.equal(result.inputAmount,'123456789123456789');
});
test('malformed or failed API responses cannot become quotes',async(t)=>{
 const adapter=new UniswapRoutingAdapter({apiKey:'test'});
 t.mock.method(globalThis,'fetch',async()=>Response.json({routing:'CLASSIC',quote:{input:{token:input,amount:'1'},output:{token:output,amount:'999'}}}));
 await assert.rejects(adapter.getExactOutputQuote(params),/invalid/);
 t.mock.method(globalThis,'fetch',async()=>new Response('offline',{status:503}));
 await assert.rejects(adapter.getExactOutputQuote(params),/503/);
 await assert.rejects(adapter.getExactOutputQuote({...params,slippageTolerancePercent:NaN}),/Slippage/);
});
