-- SYNTHETIC COMPETITION DATA ONLY. No company below is a real supplier or partner.
-- Local reset loads this seed. Do not run against production as live-price data.
insert into public.categories(id,slug,name_uz,name_ru,name_en,sort_order) values
('10000000-0000-4000-8000-000000000001','flour-sugar-baking','Un, shakar va pishiriq','Мука, сахар и выпечка','Flour, sugar and baking',1),
('10000000-0000-4000-8000-000000000002','rice-grains-pasta','Guruch, don va makaron','Рис, крупы и макароны','Rice, grains and pasta',2),
('10000000-0000-4000-8000-000000000003','oils-fats','Yog‘lar','Масла и жиры','Oils and fats',3),
('10000000-0000-4000-8000-000000000004','vegetables-fruit','Sabzavot va mevalar','Овощи и фрукты','Vegetables and fruit',4),
('10000000-0000-4000-8000-000000000005','meat-poultry','Go‘sht va parranda','Мясо и птица','Meat and poultry',5),
('10000000-0000-4000-8000-000000000006','dairy-eggs','Sut mahsulotlari va tuxum','Молочные продукты и яйца','Dairy and eggs',6),
('10000000-0000-4000-8000-000000000007','drinks','Ichimliklar','Напитки','Drinks',7),
('10000000-0000-4000-8000-000000000008','packaged-groceries','Qadoqlangan oziq-ovqat','Упакованные продукты','Packaged groceries',8)
on conflict(id) do nothing;
insert into public.products(id,category_id,name,brand,grade,origin,base_unit) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','White sugar','DEMO brand','White crystal','Synthetic demo','kg'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Wheat flour','DEMO brand','Grade 1','Synthetic demo','kg'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Packaged rice','DEMO brand','Same variety and grade','Synthetic demo','kg'),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','Sunflower oil','DEMO brand','Refined','Synthetic demo','L'),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','Pasta horns','DEMO brand','Dry wheat pasta','Synthetic demo','kg')
on conflict(id) do nothing;
insert into public.variants(id,product_id,name,pack_quantity) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50 kg bag',50),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','50 kg bag',50),
('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','25 kg bag',25),
('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004','5 L bottle',5),
('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000005','5 kg bag',5)
on conflict(id) do nothing;
insert into public.sellers(id,name,verification_status,is_demo) values
('40000000-0000-4000-8000-000000000001','DEMO Supplier A','approved',true),
('40000000-0000-4000-8000-000000000002','DEMO Supplier B','approved',true),
('40000000-0000-4000-8000-000000000003','DEMO Supplier C','approved',true)
on conflict(id) do nothing;
insert into public.branches(id,seller_id,name,district,address,delivery_fee_uzs) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','DEMO A Chilonzor','Chilonzor','Synthetic location',60000),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','DEMO B Chilonzor','Chilonzor','Synthetic location',45000),
('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','DEMO C Chilonzor','Chilonzor','Synthetic location',50000)
on conflict(id) do nothing;
insert into public.offers(id,branch_id,variant_id,channel,price_uzs,available_packs,source_type,valid_until,conditions)
select ('60000000-0000-4000-8000-'||lpad((seller_n*10+sku_n)::text,12,'0'))::uuid,
 ('50000000-0000-4000-8000-'||lpad(seller_n::text,12,'0'))::uuid,
 ('30000000-0000-4000-8000-'||lpad(sku_n::text,12,'0'))::uuid,'wholesale',price,1000,'demo',
 case when seller_n=3 and sku_n<>1 then now()-interval '1 hour' else now()+interval '6 hours' end,
 'DEMO ONLY. Tax-inclusive synthetic package price; delivery fee is shown separately.'
from (values
 (1,1,650000),(1,2,350000),(1,3,475000),(1,4,90000),(1,5,80000),
 (2,1,625000),(2,2,325000),(2,3,450000),(2,4,85000),(2,5,75000),
 (3,1,600000),(3,2,310000),(3,3,437500),(3,4,82500),(3,5,72500)
) prices(seller_n,sku_n,price) on conflict(id) do nothing;
-- Retail is a distinct channel, with explicitly separate demo prices.
insert into public.offers(branch_id,variant_id,channel,price_uzs,min_packs,available_packs,source_type,valid_until,conditions)
select branch_id,variant_id,'retail',price_uzs+10000,1,50,'demo',now()+interval '6 hours',
 'DEMO ONLY. Retail package quote, not a wholesale benchmark.' from public.offers where channel='wholesale' and source_type='demo'
on conflict(branch_id,variant_id,channel) do nothing;
