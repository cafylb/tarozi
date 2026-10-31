import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { compareBasket,compareSchema,offerSchema } from '../src/domain.js';

let db:PGlite;
const uid=(n:number)=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=uid(1),alice=uid(2),bob=uid(3),buyer=uid(4);
const seller=uid(10),branch=uid(11),offerId=uid(12);
const product='20000000-0000-4000-8000-000000000001';
const variant='30000000-0000-4000-8000-000000000001';
async function asUser<T>(user:string|null,fn:()=>Promise<T>):Promise<T>{
 await db.exec(`begin; set local role ${user?'authenticated':'anon'};`);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user??'']);
 try {const result=await fn();await db.exec('commit');return result;}catch(e){await db.exec('rollback');throw e;}
}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,migrations),'utf8'));
 await db.exec(await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
 for(let n=1;n<=9;n++)await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[uid(n),JSON.stringify({display_name:`User ${n}`,role:'admin',is_admin:true})]);
 await db.query('insert into private.admin_users values($1)',[admin]);
});
after(async()=>{await db?.close();});

test('migration enables RLS on every exposed table and private schema is not exposed',async()=>{
 const tables=await db.query<{relname:string;relrowsecurity:boolean}>("select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'");
 assert.ok(tables.rows.length>=15);assert.ok(tables.rows.every(t=>t.relrowsecurity));
 await assert.rejects(()=>asUser(buyer,()=>db.query('select * from private.admin_users')));
 const roles=await asUser(buyer,()=>db.query<{my_access:{is_admin:boolean}}>('select public.my_access()'));
 assert.equal(roles.rows[0]!.my_access.is_admin,false,'editable metadata must not grant admin');
});
test('anonymous demo comparison executes against the actual migration and data',async()=>{
 const rows=await asUser(null,()=>db.query('select * from public.offer_catalog'));
 // PostgREST serializes SQL dates to ISO strings. Exercise that transport boundary here.
 const result=compareBasket(compareSchema.parse({channel:'wholesale',district:'Chilonzor',delivery:'delivery',baseline_branch_id:'50000000-0000-4000-8000-000000000001',items:[1,2,3,4,5].map((n,i)=>({product_id:`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,quantity:[50,100,50,40,20][i]}))}),rows.rows.map(r=>offerSchema.parse(JSON.parse(JSON.stringify(r)))),new Date(),true);
 assert.equal(result.best_complete?.estimated_delivered_total_uzs,3200000);
 assert.equal(result.potential_savings?.difference_uzs,200000);
 assert.equal(result.complete_options.length,2);assert.ok(result.split_estimate);assert.equal(result.is_demo,true);
});
test('seller self-approval blocked; pending sellers cannot publish; approval creates owned membership',async()=>{
 await asUser(alice,()=>db.query("insert into public.sellers(id,name,created_by) values($1,'Alice business',$2)",[seller,alice]));
 const own=await asUser(alice,()=>db.query('select * from public.seller_memberships'));
 assert.equal(own.rows.length,1);
 await assert.rejects(()=>asUser(alice,()=>db.query("update public.sellers set verification_status='approved' where id=$1",[seller])));
 await assert.rejects(()=>asUser(alice,()=>db.query("insert into public.branches(id,seller_id,name,district) values($1,$2,'Alice branch','Chilonzor')",[branch,seller])));
 await asUser(admin,()=>db.query("update public.sellers set verification_status='approved' where id=$1",[seller]));
 await asUser(alice,()=>db.query("insert into public.branches(id,seller_id,name,district) values($1,$2,'Alice branch','Chilonzor')",[branch,seller]));
 await asUser(alice,()=>db.query("insert into public.offers(id,branch_id,variant_id,channel,price_uzs,valid_until) values($1,$2,$3,'wholesale',600000,now()+interval '4 hours')",[offerId,branch,variant]));
});
test('price updates append history; other seller cannot edit, reassign or forge observations',async()=>{
 await asUser(alice,()=>db.query('update public.offers set price_uzs=590000 where id=$1',[offerId]));
 const history=await asUser(null,()=>db.query<{price_uzs:number}>('select price_uzs from public.price_observations where offer_id=$1 order by observed_at',[offerId]));
 assert.deepEqual(history.rows.map(r=>Number(r.price_uzs)),[600000,590000]);
 const attack=await asUser(bob,()=>db.query('update public.offers set price_uzs=1 where id=$1 returning id',[offerId]));assert.equal(attack.rows.length,0);
 await assert.rejects(()=>asUser(bob,()=>db.query('insert into public.seller_memberships values($1,$2)',[seller,bob])));
 await assert.rejects(()=>asUser(alice,()=>db.query('update public.price_observations set price_uzs=1 where offer_id=$1',[offerId])));
 await assert.rejects(()=>asUser(alice,()=>db.query("update public.offers set source_type='demo' where id=$1",[offerId])));
 await assert.rejects(()=>asUser(alice,()=>db.query("update public.offers set quantity_tiers='[{\"min_packs\":1,\"price_uzs\":1.5}]' where id=$1",[offerId])));
});
test('private lists are atomic, isolated and cannot use mismatching variants',async()=>{
 const payload={name:'Restock',channel:'wholesale',district:'Chilonzor',items:[{product_id:product,quantity:50}]};
 const saved=await asUser(buyer,()=>db.query<{id:string}>('select public.save_shopping_list($1) as id',[JSON.stringify(payload)]));
 const listId=saved.rows[0]!.id;
 assert.equal((await asUser(bob,()=>db.query('select * from public.shopping_lists'))).rows.length,0);
 await assert.rejects(()=>asUser(bob,()=>db.query('select public.save_shopping_list($1)',[JSON.stringify({...payload,id:listId})])));
 await assert.rejects(()=>asUser(buyer,()=>db.query('select public.save_shopping_list($1)',[JSON.stringify({...payload,id:listId,items:[{product_id:product,quantity:1,variant_id:'30000000-0000-4000-8000-000000000002'}]})])));
 const items=await asUser(buyer,()=>db.query<{quantity:number}>('select * from public.shopping_list_items where list_id=$1',[listId]));assert.equal(Number(items.rows[0]!.quantity),50);
});
test('alerts are caller-scoped, idempotent and cannot modify notification contents',async()=>{
 await asUser(buyer,()=>db.query("insert into public.alerts(product_id,channel,district,target_unit_price_uzs) values($1,'wholesale','Chilonzor',20000)",[product]));
 const first=await asUser(buyer,()=>db.query<{n:number}>('select public.evaluate_my_alerts() n'));assert.ok(first.rows[0]!.n>=1);
 assert.equal((await asUser(buyer,()=>db.query<{n:number}>('select public.evaluate_my_alerts() n'))).rows[0]!.n,0);
 assert.equal((await asUser(bob,()=>db.query('select * from public.notifications'))).rows.length,0);
 await assert.rejects(()=>asUser(buyer,()=>db.query("update public.notifications set message='forged'")));
 await asUser(buyer,()=>db.query('update public.notifications set read_at=now()'));
});
test('reviewed imports are admin-only and all-or-nothing',async()=>{
 const row={branch_id:branch,variant_id:variant,channel:'wholesale',price_uzs:580000,valid_until:new Date(Date.now()+3600000).toISOString()};
 await assert.rejects(()=>asUser(alice,()=>db.query('select public.publish_price_import($1)',[JSON.stringify([row])])));
 await asUser(admin,()=>db.query('select public.publish_price_import($1)',[JSON.stringify([row])]));
 await assert.rejects(()=>asUser(admin,()=>db.query('select public.publish_price_import($1)',[JSON.stringify([{...row,price_uzs:570000},{...row,branch_id:uid(999)}])])));
 const value=await asUser(null,()=>db.query<{price_uzs:number}>('select price_uzs from public.offers where id=$1',[offerId]));assert.equal(Number(value.rows[0]!.price_uzs),580000);
});
test('market interest is seller-only and small groups are suppressed',async()=>{
 await assert.rejects(()=>asUser(buyer,()=>db.query('select public.market_signals()')));
 for(let n=4;n<=7;n++)await asUser(uid(n),()=>db.query('insert into public.search_events(product_id) values($1)',[product]));
 let signals=await asUser(alice,()=>db.query<{value:{products:unknown[]}}>('select public.market_signals() value'));assert.equal(signals.rows[0]!.value.products.length,0);
 await asUser(uid(8),()=>db.query('insert into public.search_events(product_id) values($1)',[product]));
 signals=await asUser(alice,()=>db.query<{value:{products:unknown[]}}>('select public.market_signals() value'));assert.equal(signals.rows[0]!.value.products.length,1);
});
test('variant identity and seller assignment cannot silently rewrite price history',async()=>{
 await assert.rejects(()=>asUser(admin,()=>db.query('update public.variants set pack_quantity=1 where id=$1',[variant])));
 await assert.rejects(()=>asUser(admin,()=>db.query("update public.branches set seller_id='40000000-0000-4000-8000-000000000001' where id=$1",[branch])));
});
test('audit is admin-only and offer versions order multiple updates inside one transaction',async()=>{
 await assert.rejects(()=>asUser(buyer,()=>db.query('select public.admin_audit_log(10)')));
 const events=await asUser(admin,()=>db.query<{data:unknown[]}>('select public.admin_audit_log(10) data'));assert.ok(events.rows[0]!.data.length>0);
 await asUser(alice,async()=>{await db.query('update public.offers set price_uzs=560000 where id=$1',[offerId]);await db.query('update public.offers set price_uzs=550000 where id=$1',[offerId]);});
 const observations=await asUser(null,()=>db.query<{price_uzs:number;offer_version:number;source_type:string}>('select price_uzs,offer_version,source_type from public.price_observations where offer_id=$1 order by offer_version desc',[offerId]));
 assert.equal(Number(observations.rows[0]!.price_uzs),550000);assert.equal(Number(observations.rows[1]!.price_uzs),560000);
 assert.equal(observations.rows[0]!.source_type,'seller');
});
