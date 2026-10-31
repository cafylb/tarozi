import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { configSchema } from '../src/config.js';
process.env.NODE_ENV='test';
const config=configSchema.parse({SUPABASE_PUBLISHABLE_KEY:'test-publishable-key-for-local-tests'});
test('HTTP liveness, OpenAPI, authorization and invalid comparison boundaries',async()=>{
 const app=await buildApp(config);
 try {
  assert.equal((await app.inject({method:'GET',url:'/health'})).statusCode,200);
  const spec=await app.inject({method:'GET',url:'/openapi.json'});assert.equal(spec.statusCode,200);
  assert.ok(spec.json().paths['/advisor/compare']);assert.ok(spec.json().paths['/auth/register']);
  for(const url of ['/me','/lists','/seller/dashboard','/admin/sellers'])assert.equal((await app.inject({method:'GET',url})).statusCode,401);
  assert.equal((await app.inject({method:'GET',url:'/me',headers:{authorization:'x'}})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/advisor/compare',payload:{items:[],channel:'wholesale'}})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:'/auth/register',payload:{email:'bad',password:'short',display_name:'Test'}})).statusCode,400);
 } finally {await app.close();}
});
