import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBasket, compareSchema, fairPrice, priceLine, type Offer } from '../src/domain.js';

const uid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=new Date('2026-10-31T12:00:00Z');
const product=uid(1),other=uid(2);
function offer(changes:Partial<Offer>={}):Offer{return {id:uid(10),product_id:product,variant_id:uid(20),branch_id:uid(30),seller_id:uid(40),product_name:'Rice',brand:'Exact brand',grade:'Same grade',base_unit:'kg',variant_name:'5 kg',pack_quantity:5,seller_name:'A',branch_name:'A branch',district:'Chilonzor',channel:'wholesale',price_uzs:75000,min_packs:1,step_packs:1,available_packs:100,availability:'available',quantity_tiers:[],updated_at:'2026-10-31T11:00:00Z',valid_until:'2026-10-31T16:00:00Z',source_type:'seller',source_url:null,conditions:'Tax included',minimum_order_uzs:0,delivery_fee_uzs:null,is_demo:false,status:'published',seller_approved:true,...changes};}
const input=(items=[{product_id:product,quantity:10}])=>compareSchema.parse({items,channel:'wholesale',district:'Chilonzor'});

test('rounds up packs and discloses excess without fractional UZS',()=>{
 const line=priceLine(offer({pack_quantity:0.4,price_uzs:5500}),{product_id:product,quantity:1});
 assert.equal(line?.packs,3);assert.equal(line?.purchased_quantity,1.2);assert.equal(line?.excess_quantity,0.2);assert.equal(line?.subtotal_uzs,16500);
});
test('honors pack MOQ, order multiples, stock and quantity tiers',()=>{
 const o=offer({min_packs:3,step_packs:2,quantity_tiers:[{min_packs:4,price_uzs:60000}]});
 assert.equal(priceLine(o,{product_id:product,quantity:1})?.subtotal_uzs,240000);
 assert.equal(priceLine({...o,available_packs:3},{product_id:product,quantity:1}),null);
});
test('keeps incomplete suppliers out of complete ranking',()=>{
 const rows=[offer(),offer({id:uid(11),product_id:other,variant_id:uid(21)}),offer({id:uid(12),seller_id:uid(41),branch_id:uid(31),price_uzs:1})];
 const result=compareBasket(input([{product_id:product,quantity:10},{product_id:other,quantity:10}]),rows,now);
 assert.equal(result.complete_options.length,1);assert.equal(result.best_complete?.seller_id,uid(40));assert.equal(result.incomplete_options.length,1);
});
test('excludes expired, stale, unapproved, wrong-channel, future and demo prices',()=>{
 const rows=[offer({valid_until:now.toISOString()}),offer({updated_at:'2026-10-28T11:00:00Z'}),offer({seller_approved:false}),offer({channel:'retail'}),offer({updated_at:'2026-11-01T11:00:00Z'}),offer({is_demo:true})];
 assert.equal(compareBasket(input(),rows,now).best_complete,null);
});
test('cannot substitute a different variant when exact variant requested',()=>{
 const request=input();request.items[0]!.variant_id=uid(999);
 assert.equal(compareBasket(request,[offer()],now).best_complete,null);
});
test('does not call unknown transport a delivered total',()=>{
 const result=compareBasket({...input(),delivery:'delivery'},[offer()],now);
 assert.equal(result.best_complete?.estimated_delivered_total_uzs,null);assert.equal(result.ranking_basis,'goods_only_transport_not_comparable');
});
test('known delivery costs can reverse goods-only recommendation; baseline is named',()=>{
 const a=offer({price_uzs:70000,delivery_fee_uzs:50000});
 const b=offer({id:uid(11),branch_id:uid(31),seller_id:uid(41),price_uzs:75000,delivery_fee_uzs:10000});
 const result=compareBasket({...input(),delivery:'delivery',baseline_branch_id:a.branch_id},[a,b],now);
 assert.equal(result.best_complete?.branch_id,b.branch_id);assert.equal(result.potential_savings?.difference_uzs,30000);assert.equal(result.potential_savings?.actual_purchase_savings,false);
});
test('branch minimums disqualify incomplete minimum spends, including split allocations',()=>{
 const result=compareBasket(input(),[offer({minimum_order_uzs:999999})],now);
 assert.equal(result.best_complete,null);assert.equal(result.split_estimate,null);
});
test('fair price deduplicates sellers and suppresses small samples',()=>{
 const a=offer();assert.equal(fairPrice([a,offer({id:uid(11)})],now).median_unit_price_uzs,null);
 const rows=[a,offer({id:uid(12),seller_id:uid(41),price_uzs:50000}),offer({id:uid(13),seller_id:uid(42),price_uzs:100000})];
 assert.equal(fairPrice(rows,now).median_unit_price_uzs,15000);
 assert.throws(()=>fairPrice([...rows,offer({channel:'retail'})],now));
});
test('duplicate products are rejected instead of undercounting',()=>{assert.throws(()=>input([{product_id:product,quantity:5},{product_id:product,quantity:3}]));});
