import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAssistant,bestOffers,findProducts} from './assistant.mjs';

test('offer search understands RU/EN/UZ and ranks product costs without delivery',()=>{
 for(const query of ['сахар 50 кг','sugar 50 kg','shakar 50 kg'])assert.deepEqual(findProducts(query),['sugar']);
 assert.deepEqual(findProducts('un 25 kg'),['flour']);
 assert.deepEqual(findProducts('unknown item'),[]);for(const [query,id] of [['sabzi','carrot'],['tomat','tomato-paste'],['sariyog','butter'],['choy','tea'],['tuxum','egg'],['makaron','pasta']])assert.deepEqual(findProducts(query),[id]);
 const offers=bestOffers(['sugar'],50);
 assert.equal(offers[0].supplierId,'baraka');assert.equal('delivery' in offers[0],false);assert.equal(offers[0].total,490000);
 assert.equal(bestOffers(['rice'],25)[0].total,362500);
 assert.equal(bestOffers(['sugar'],5).length,0);
 assert.equal(bestOffers(['sugar'],2000).length,0);
});

test('assistant validates requests, grounds AI offers and falls back without charging',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tarozi-assistant-test-'));
 let handler,providerCalls=0,providerStatus=200;
 const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost')));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const config=key=>fs.writeFile(path.join(root,'.env.local'),`APP_URL=${base}\nGEMINI_API_KEY=${key}\n`);
 await config('test-key');
 handler=createAssistant(root,server.address().port,{fetchImpl:async(url,options)=>{
  providerCalls++;assert(!url.includes('test-key'));assert.equal(options.headers['x-goog-api-key'],'test-key');
  const request=JSON.parse(options.body);assert(!request.tools);assert.equal(request.generationConfig.responseMimeType,'application/json');
  if(providerStatus!==200)return new Response('{}',{status:providerStatus});
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({answer:'Сравнил предложения из демо-каталога.',productIds:['sugar','made-up-product']})}]}}]}));
 }});
 async function post(body,origin=base){const response=await fetch(base+'/api/assistant',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});return{status:response.status,data:await response.json()};}
 try{
  assert.equal((await post({message:'сахар 50 кг',language:'ru'},'https://other.example')).status,403);
  assert.equal((await post('{invalid')).status,400);
  assert.equal((await post({message:''})).status,400);
  assert.equal((await post({message:'сахар 0 кг'})).status,400);
  const ai=await post({message:'сахар 50 кг',language:'ru'});
  assert.equal(ai.data.mode,'ai');assert.equal(ai.data.offers.length,3);assert.equal(ai.data.offers[0].total,490000);
  assert(!ai.data.offers.some(offer=>offer.productId==='made-up-product'));
  providerStatus=402;
  const unavailable=await post({message:'сахар 50 кг'});
  assert.equal(unavailable.data.mode,'catalog');assert.equal(unavailable.data.notice,'AI_BILLING');assert.equal(unavailable.data.offers[0].total,490000);
  const afterBilling=providerCalls;await post({message:'сахар 50 кг'});assert.equal(providerCalls,afterBilling);
  await config('');const before=providerCalls;
  const catalog=await post({message:'sugar 50 kg',language:'en'});
  assert.equal(catalog.data.mode,'catalog');assert.equal(catalog.data.offers.length,3);assert.equal(providerCalls,before);
  const faq=await post({message:'How does Tarozi work?',language:'en'});
  assert(faq.data.answer.includes('no real payments'));assert.equal(providerCalls,before);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await fs.unlink(path.join(root,'.env.local'));await fs.rmdir(root);
 }
});
