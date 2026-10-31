import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createAuth} from './auth.mjs';
import {matchesSearch,filteredProducts} from '../prototypes/style-lab/model.mjs';

test('rice search excludes matches inside unrelated words',()=>{
 assert.deepEqual(filteredProducts({query:'рис'}).map(product=>product.id),['rice']);
 assert.deepEqual(filteredProducts({query:'РИС ЛАЗЕР'}).map(product=>product.id),['rice']);
 assert.equal(matchesSearch('Белый, кристаллический','рис'),false);
 assert.equal(matchesSearch('Рис «Лазер» Laser rice Lazer guruch','Rice'),true);
 assert.equal(matchesSearch('Рис «Лазер» Laser rice Lazer guruch','guruch'),true);
 assert.equal(matchesSearch('Сахар-песок','сах'),true);
});

test('roles, seller ownership, inventory, search analytics and persistence',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tarozi-commerce-'));
 let handle;const server=http.createServer((req,res)=>handle(req,res,new URL(req.url,'http://localhost')));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,base=`http://127.0.0.1:${port}`;
 await fs.writeFile(path.join(root,'.env.local'),`APP_URL=${base}\n`);handle=await createAuth(root,port);
 const request=async(route,{cookie='',body,origin=base}={})=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 try{
  assert.equal((await request('/api/seller/items')).status,401);
  const buyer=await request('/api/auth/register',{body:{name:'Buyer',email:'buyer@example.test',password:'testPass123',role:'buyer'}});assert.equal(buyer.status,200);assert.equal(buyer.data.user.role,'buyer');
  assert.equal((await request('/api/seller/items',{cookie:buyer.cookie})).status,403);
  const seller=await request('/api/auth/register',{body:{name:'Seller',email:'seller@example.test',password:'testPass123',role:'seller'}});assert.equal(seller.data.user.role,'seller');
  const other=await request('/api/auth/register',{body:{email:'other@example.test',password:'testPass123',role:'seller'}});
  assert.equal((await request('/api/seller/analytics',{cookie:seller.cookie})).data.searches.reduce((a,b)=>a+b,0),0);
  const body={productId:'rice',name:'Rice Laser',price:14000,stock:50};
  assert.equal((await request('/api/seller/items',{cookie:seller.cookie,origin:'https://other.test',body})).status,403);
  assert.equal((await request('/api/seller/items',{cookie:seller.cookie,body:{...body,price:-10}})).status,400);
  const created=await request('/api/seller/items',{cookie:seller.cookie,body});assert.equal(created.status,200);const item=created.data.item;assert.equal(item.history.length,1);
  assert.equal((await request('/api/seller/items',{cookie:other.cookie,body:{...body,id:item.id}})).status,404);
  assert.equal((await request('/api/seller/items',{cookie:other.cookie})).data.items.length,0);
  const updated=await request('/api/seller/items',{cookie:seller.cookie,body:{...body,id:item.id,price:13800}});assert.equal(updated.data.item.history.length,2);assert.equal(updated.data.item.history.at(-1).price,13800);
  const catalog=(await request('/api/market/catalog')).data;assert.equal(catalog.items[0].price,13800);assert(!JSON.stringify(catalog).includes('seller@example'));assert(!JSON.stringify(catalog).includes('hash'));
  await request('/api/market/event',{cookie:buyer.cookie,body:{type:'search',productId:'rice'}});
  await request('/api/market/event',{cookie:buyer.cookie,body:{type:'view',productId:'rice',itemId:item.id}});
  assert.equal((await request('/api/market/event',{body:{type:'view',productId:'rice',itemId:'not-real'}})).status,400);
  const stats=(await request('/api/seller/analytics',{cookie:seller.cookie})).data;assert.equal(stats.demand.find(row=>row.productId==='rice').count,1);assert.equal(stats.items[0].views,1);assert.equal(stats.views.reduce((a,b)=>a+b,0),1);
  assert.equal((await request('/api/seller/analytics',{cookie:other.cookie})).data.items.length,0);
  assert.equal((await request('/api/seller/store',{cookie:seller.cookie,body:{store:'Shop',address:'Tashkent',lat:0,lng:0}})).status,400);
  assert.equal((await request('/api/seller/store',{cookie:seller.cookie,body:{store:'Shop',address:'Tashkent',lat:41.32,lng:69.28}})).status,200);
  assert.equal((await request('/api/market/catalog')).data.stores[0].name,'Shop');
  await request('/api/seller/items',{cookie:seller.cookie,body:{...body,id:item.id,stock:0}});assert.equal((await request('/api/market/catalog')).data.items.length,0);
  handle=await createAuth(root,port);
  const login=await request('/api/auth/login',{body:{email:'seller@example.test',password:'testPass123',role:'seller'}});assert.equal(login.status,200);
  assert.equal((await request('/api/seller/items',{cookie:login.cookie})).data.items.length,1);
  assert.equal((await request('/api/seller/analytics',{cookie:login.cookie})).data.items[0].views,1);
  assert.equal((await request('/api/auth/session',{cookie:login.cookie})).data.user.store,'Shop');
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
});
