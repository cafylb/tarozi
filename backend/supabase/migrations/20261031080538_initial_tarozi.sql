-- Tarozi: grocery price intelligence. No orders, checkout, payments or fulfillment.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 100),
  account_type text not null default 'customer' check (account_type in ('customer','business_buyer')),
  district text not null default '' check (length(district) <= 80),
  locale text not null default 'uz' check (locale in ('uz','ru','en')),
  created_at timestamptz not null default now()
);
create table private.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);

create table public.categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name_uz text not null, name_ru text not null, name_en text not null, sort_order integer not null default 0
);
create table public.products (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id),
  name text not null check (length(name) between 1 and 200), brand text not null default '',
  grade text not null default '', origin text not null default '',
  base_unit text not null check (base_unit in ('kg','L','unit')), active boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
create table public.variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  name text not null, pack_quantity numeric(18,6) not null check (pack_quantity > 0 and pack_quantity <= 1000000),
  barcode text unique, active boolean not null default true
);
create index variants_product_idx on public.variants(product_id);

create table public.sellers (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 160),
  legal_name text not null default '', tax_id text not null default '',
  business_phone text not null default '', website text not null default '',
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected','suspended')),
  created_by uuid references auth.users(id), is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index sellers_creator_idx on public.sellers(created_by);
create table public.seller_memberships (
  seller_id uuid not null references public.sellers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(seller_id,user_id)
);
create index memberships_user_idx on public.seller_memberships(user_id,seller_id);
create table public.branches (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.sellers(id),
  name text not null, district text not null, address text not null default '',
  delivery_fee_uzs bigint check (delivery_fee_uzs between 0 and 1000000000000),
  minimum_order_uzs bigint not null default 0 check (minimum_order_uzs between 0 and 1000000000000),
  active boolean not null default true
);
create index branches_seller_idx on public.branches(seller_id);
create index branches_district_idx on public.branches(district);

create table public.offers (
  id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id),
  variant_id uuid not null references public.variants(id),
  channel text not null check (channel in ('retail','wholesale')),
  price_uzs bigint not null check (price_uzs between 1 and 1000000000000),
  min_packs integer not null default 1 check (min_packs between 1 and 1000000),
  step_packs integer not null default 1 check (step_packs between 1 and 1000000),
  available_packs integer check (available_packs between 0 and 1000000000),
  availability text not null default 'available' check (availability in ('available','limited','unavailable')),
  quantity_tiers jsonb not null default '[]'::jsonb,
  conditions text not null default '' check (length(conditions) <= 1000),
  source_type text not null default 'seller' check (source_type in ('seller','admin_import','demo')),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  status text not null default 'published' check (status in ('published','withdrawn')),
  valid_until timestamptz not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  unique(branch_id,variant_id,channel)
);
create index offers_variant_channel_idx on public.offers(variant_id,channel,valid_until);
create index offers_branch_idx on public.offers(branch_id);
create table public.price_observations (
  id uuid primary key default gen_random_uuid(), offer_id uuid not null references public.offers(id),
  price_uzs bigint not null, pack_quantity numeric(18,6) not null,
  min_packs integer not null, step_packs integer not null, quantity_tiers jsonb not null,
  available_packs integer, availability text not null, conditions text not null,
  source_type text not null, source_url text, observed_at timestamptz not null default now(),
  valid_until timestamptz not null, status text not null, offer_version bigint not null,
  unique(offer_id,offer_version)
);
create index price_observations_offer_time_idx on public.price_observations(offer_id,observed_at desc);
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id), created_at timestamptz not null default now(),
  primary key(user_id,product_id)
);
create index favorites_product_idx on public.favorites(product_id);
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  channel text not null check (channel in ('retail','wholesale')), district text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index shopping_lists_user_idx on public.shopping_lists(user_id);
create table public.shopping_list_items (
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid not null references public.products(id), variant_id uuid references public.variants(id),
  quantity numeric(18,6) not null check (quantity > 0 and quantity <= 1000000),
  primary key(list_id,product_id)
);
create index list_items_product_idx on public.shopping_list_items(product_id);
create index list_items_variant_idx on public.shopping_list_items(variant_id);
create table public.alerts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id),
  channel text not null check (channel in ('retail','wholesale')), district text not null,
  target_unit_price_uzs numeric(18,6) not null check (target_unit_price_uzs > 0),
  include_demo boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now()
);
create index alerts_user_idx on public.alerts(user_id);
create index alerts_active_product_idx on public.alerts(product_id,channel,district) where active;
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  observation_id uuid not null references public.price_observations(id),
  message text not null, read_at timestamptz, created_at timestamptz not null default now(),
  unique(alert_id,observation_id)
);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index notifications_observation_idx on public.notifications(observation_id);
create table public.price_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id),
  offer_id uuid not null references public.offers(id), reason text not null check (length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);
create index reports_user_idx on public.price_reports(user_id);
create index reports_offer_idx on public.price_reports(offer_id);
create table public.search_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id), created_at timestamptz not null default now()
);
create index search_events_user_idx on public.search_events(user_id);
create index search_events_product_time_idx on public.search_events(product_id,created_at);
create table private.audit_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid, entity text not null,
  entity_id uuid not null, action text not null, details jsonb not null, created_at timestamptz not null default now()
);

-- Narrow, non-exposed privilege helpers. No role is read from editable JWT user_metadata.
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from private.admin_users where user_id=auth.uid())
$$;
create function private.owns_seller(sid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.seller_memberships where seller_id=sid and user_id=auth.uid())
$$;
create function private.seller_visible(sid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.sellers where id=sid and verification_status='approved')
$$;
create function private.can_publish(sid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_admin() or (private.owns_seller(sid) and private.seller_visible(sid))
$$;
revoke all on function private.is_admin(), private.owns_seller(uuid), private.seller_visible(uuid), private.can_publish(uuid) from public;
grant execute on function private.is_admin(), private.owns_seller(uuid), private.can_publish(uuid) to authenticated;
-- Read-only approval predicate is needed for anonymous catalog policies.
grant usage on schema private to anon;
grant execute on function private.seller_visible(uuid) to anon, authenticated;

create function private.init_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100));
 return new;
end $$;
revoke all on function private.init_profile() from public;
create trigger auth_user_profile after insert on auth.users for each row execute function private.init_profile();
insert into public.profiles(id,display_name)
select id,left(coalesce(raw_user_meta_data->>'display_name',''),100) from auth.users on conflict(id) do nothing;

create function private.guard_seller() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if current_user in ('anon','authenticated') then
   if tg_op='INSERT' and (new.created_by is distinct from auth.uid() or new.verification_status<>'pending' or new.is_demo) then
     raise exception 'New sellers require approval' using errcode='42501';
   end if;
   if tg_op='UPDATE' and (new.created_by is distinct from old.created_by or new.is_demo is distinct from old.is_demo) then
     raise exception 'Seller identity cannot be reassigned' using errcode='42501';
   end if;
   if tg_op='UPDATE' and new.verification_status is distinct from old.verification_status and not private.is_admin() then
     raise exception 'Only administrators can change verification' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_seller() from public;
create trigger guard_seller before insert or update on public.sellers for each row execute function private.guard_seller();
create function private.add_seller_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.created_by is not null then insert into public.seller_memberships(seller_id,user_id) values(new.id,new.created_by); end if;
 return new;
end $$;
revoke all on function private.add_seller_owner() from public;
create trigger add_seller_owner after insert on public.sellers for each row execute function private.add_seller_owner();

create function private.guard_offer() returns trigger language plpgsql security invoker set search_path = '' as $$
declare tier jsonb; thresholds integer[] := '{}'; n integer;
begin
 if tg_op='UPDATE' and (new.branch_id<>old.branch_id or new.variant_id<>old.variant_id or new.channel<>old.channel) then
   raise exception 'Offer branch, variant and channel are immutable';
 end if;
 if jsonb_typeof(new.quantity_tiers)<>'array' or jsonb_array_length(new.quantity_tiers)>20 then raise exception 'Invalid quantity tiers'; end if;
 for tier in select * from jsonb_array_elements(new.quantity_tiers) loop
   if jsonb_typeof(tier->'min_packs')<>'number' or jsonb_typeof(tier->'price_uzs')<>'number'
      or not (tier ? 'min_packs' and tier ? 'price_uzs') then raise exception 'Invalid quantity tier'; end if;
   if (tier->>'min_packs')::numeric<>trunc((tier->>'min_packs')::numeric)
      or (tier->>'price_uzs')::numeric<>trunc((tier->>'price_uzs')::numeric) then raise exception 'Tier values must be integers'; end if;
   n := (tier->>'min_packs')::integer;
   if n<1 or n>1000000 or n=any(thresholds) or (tier->>'price_uzs')::numeric not between 1 and 1000000000000 then raise exception 'Invalid quantity tier range'; end if;
   thresholds:=array_append(thresholds,n);
 end loop;
 if current_user in ('anon','authenticated') then
   if not private.is_admin() then
    -- A legitimate owner may refresh an administrator-imported offer. The new
    -- observation becomes their seller declaration; it must not retain import provenance.
    if tg_op='UPDATE' and new.source_type=old.source_type then new.source_type:='seller'; end if;
    if new.source_type<>'seller' then raise exception 'Only admins may import or label demo prices' using errcode='42501'; end if;
   end if;
   if new.valid_until<=now() or new.valid_until>now()+interval '7 days' then raise exception 'Quote validity must be within the next 7 days'; end if;
 end if;
 new.updated_at:=now();
 new.version:=case when tg_op='UPDATE' then old.version+1 else 1 end;
 return new;
end $$;
revoke all on function private.guard_offer() from public;
create trigger guard_offer before insert or update on public.offers for each row execute function private.guard_offer();

-- Snapshot observations and audit events cannot be edited through the Data API.
create function private.snapshot_offer() returns trigger language plpgsql security definer set search_path = '' as $$
declare oid uuid;
begin
 insert into public.price_observations(offer_id,price_uzs,pack_quantity,min_packs,step_packs,quantity_tiers,
   available_packs,availability,conditions,source_type,source_url,valid_until,status,offer_version)
 select new.id,new.price_uzs,v.pack_quantity,new.min_packs,new.step_packs,new.quantity_tiers,
   new.available_packs,new.availability,new.conditions,new.source_type,new.source_url,new.valid_until,new.status,new.version
 from public.variants v where v.id=new.variant_id returning id into oid;
 insert into private.audit_events(actor_id,entity,entity_id,action,details)
 values(auth.uid(),'offer',new.id,tg_op,jsonb_build_object('observation_id',oid,'price_uzs',new.price_uzs));
 return new;
end $$;
revoke all on function private.snapshot_offer() from public;
create trigger snapshot_offer after insert or update on public.offers for each row execute function private.snapshot_offer();

-- RLS is also enforced for clients accessing PostgREST directly.
alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.categories enable row level security;
create policy categories_read on public.categories for select to anon,authenticated using(true);
create policy categories_admin on public.categories for all to authenticated using(private.is_admin()) with check(private.is_admin());
alter table public.products enable row level security;
create policy products_read on public.products for select to anon,authenticated using(active);
create policy products_admin on public.products for all to authenticated using(private.is_admin()) with check(private.is_admin());
alter table public.variants enable row level security;
create policy variants_read on public.variants for select to anon,authenticated using(active);
create policy variants_admin on public.variants for all to authenticated using(private.is_admin()) with check(private.is_admin());
alter table public.sellers enable row level security;
create policy sellers_public on public.sellers for select to anon using(verification_status='approved');
create policy sellers_authenticated on public.sellers for select to authenticated using(verification_status='approved' or private.owns_seller(id) or private.is_admin());
create policy seller_apply on public.sellers for insert to authenticated with check(created_by=auth.uid() and verification_status='pending' and not is_demo);
create policy seller_update on public.sellers for update to authenticated using(private.owns_seller(id) or private.is_admin()) with check(private.owns_seller(id) or private.is_admin());
alter table public.seller_memberships enable row level security;
create policy membership_read on public.seller_memberships for select to authenticated using(user_id=auth.uid() or private.is_admin());
alter table public.branches enable row level security;
create policy branches_public on public.branches for select to anon using(active and private.seller_visible(seller_id));
create policy branches_read on public.branches for select to authenticated using((active and private.seller_visible(seller_id)) or private.owns_seller(seller_id) or private.is_admin());
create policy branches_write on public.branches for all to authenticated using(private.can_publish(seller_id)) with check(private.can_publish(seller_id));
alter table public.offers enable row level security;
create policy offers_public on public.offers for select to anon using(status='published' and exists(select 1 from public.branches b where b.id=branch_id and b.active and private.seller_visible(b.seller_id)));
create policy offers_read on public.offers for select to authenticated using(
 exists(select 1 from public.branches b where b.id=branch_id and ((status='published' and b.active and private.seller_visible(b.seller_id)) or private.owns_seller(b.seller_id) or private.is_admin())));
create policy offers_write on public.offers for all to authenticated using(exists(select 1 from public.branches b where b.id=branch_id and private.can_publish(b.seller_id)))
 with check(exists(select 1 from public.branches b where b.id=branch_id and b.active and private.can_publish(b.seller_id)));
alter table public.price_observations enable row level security;
create policy observations_read on public.price_observations for select to anon,authenticated using(exists(select 1 from public.offers o where o.id=offer_id));
alter table public.favorites enable row level security;
create policy favorite_own on public.favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.shopping_lists enable row level security;
create policy list_own on public.shopping_lists for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.shopping_list_items enable row level security;
create policy list_item_own on public.shopping_list_items for all to authenticated using(exists(select 1 from public.shopping_lists l where l.id=list_id and l.user_id=auth.uid()))
 with check(exists(select 1 from public.shopping_lists l where l.id=list_id and l.user_id=auth.uid()) and (variant_id is null or exists(select 1 from public.variants v where v.id=variant_id and v.product_id=shopping_list_items.product_id)));
alter table public.alerts enable row level security;
create policy alerts_own on public.alerts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.notifications enable row level security;
create policy notification_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notification_mark_read on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.price_reports enable row level security;
create policy reports_own on public.price_reports for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy reports_insert on public.price_reports for insert to authenticated with check(user_id=auth.uid() and status='open');
create policy reports_admin on public.price_reports for update to authenticated using(private.is_admin()) with check(private.is_admin());
alter table public.search_events enable row level security;
create policy search_own on public.search_events for select to authenticated using(user_id=auth.uid());
create policy search_insert on public.search_events for insert to authenticated with check(user_id=auth.uid());

-- Least privilege, including explicit grants for projects where new tables are not exposed by default.
revoke all on public.profiles,public.categories,public.products,public.variants,public.sellers,public.seller_memberships,
 public.branches,public.offers,public.price_observations,public.favorites,public.shopping_lists,
 public.shopping_list_items,public.alerts,public.notifications,public.price_reports,public.search_events from anon,authenticated;
grant select on public.categories,public.products,public.variants,public.sellers,public.branches,public.offers,public.price_observations to anon,authenticated;
grant select on public.profiles,public.seller_memberships,public.favorites,public.shopping_lists,public.shopping_list_items,
 public.alerts,public.notifications,public.price_reports,public.search_events to authenticated;
grant update(display_name,account_type,district,locale) on public.profiles to authenticated;
grant insert,update on public.categories,public.products,public.variants,public.sellers,public.branches,public.offers to authenticated;
grant insert,update,delete on public.favorites,public.shopping_lists,public.shopping_list_items,public.alerts to authenticated;
grant insert on public.price_reports,public.search_events to authenticated;
grant update(status) on public.price_reports to authenticated;
grant update(read_at) on public.notifications to authenticated;

create view public.offer_catalog with (security_invoker=true) as
select o.*,v.product_id,v.name as variant_name,v.pack_quantity,
 p.name as product_name,p.brand,p.grade,p.base_unit,p.category_id,
 b.seller_id,b.name as branch_name,b.district,b.address,b.delivery_fee_uzs,b.minimum_order_uzs,
 s.name as seller_name,(s.is_demo or o.source_type='demo') as is_demo,(s.verification_status='approved') as seller_approved,
 (o.price_uzs/v.pack_quantity) as unit_price_uzs
from public.offers o join public.variants v on v.id=o.variant_id and v.active
 join public.products p on p.id=v.product_id and p.active
 join public.branches b on b.id=o.branch_id and b.active join public.sellers s on s.id=b.seller_id;
grant select on public.offer_catalog to anon,authenticated;

create function public.my_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('is_admin',private.is_admin(),'seller_ids',coalesce((select jsonb_agg(seller_id) from public.seller_memberships where user_id=auth.uid()),'[]'::jsonb))
$$;
revoke all on function public.my_access() from public;
grant execute on function public.my_access() to authenticated;

-- Transactional saved list: header and all lines succeed or roll back together.
create function public.save_shopping_list(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare lid uuid; item jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items') not between 1 and 30 then raise exception '1-30 list items required'; end if;
 if payload ? 'id' then
  update public.shopping_lists set name=payload->>'name',channel=payload->>'channel',district=payload->>'district',updated_at=now()
   where id=(payload->>'id')::uuid returning id into lid;
  if lid is null then raise exception 'List not found' using errcode='P0002'; end if;
  delete from public.shopping_list_items where list_id=lid;
 else
  insert into public.shopping_lists(name,channel,district) values(payload->>'name',payload->>'channel',payload->>'district') returning id into lid;
 end if;
 for item in select * from jsonb_array_elements(payload->'items') loop
  insert into public.shopping_list_items(list_id,product_id,variant_id,quantity)
   values(lid,(item->>'product_id')::uuid,(item->>'variant_id')::uuid,(item->>'quantity')::numeric);
 end loop;
 return lid;
end $$;
revoke all on function public.save_shopping_list(jsonb) from public;
grant execute on function public.save_shopping_list(jsonb) to authenticated;

-- Reviewed JSON rows from a spreadsheet. Transactional import; failed rows roll back the entire batch.
create function public.publish_price_import(rows jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb; n integer:=0;
begin
 if not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 200 then raise exception '1-200 rows required'; end if;
 for item in select * from jsonb_array_elements(rows) loop
  insert into public.offers(branch_id,variant_id,channel,price_uzs,min_packs,step_packs,available_packs,availability,quantity_tiers,conditions,source_type,source_url,valid_until)
   values((item->>'branch_id')::uuid,(item->>'variant_id')::uuid,item->>'channel',(item->>'price_uzs')::bigint,
    coalesce((item->>'min_packs')::integer,1),coalesce((item->>'step_packs')::integer,1),
    (item->>'available_packs')::integer,coalesce(item->>'availability','available'),coalesce(item->'quantity_tiers','[]'),
    coalesce(item->>'conditions',''),'admin_import',item->>'source_url',(item->>'valid_until')::timestamptz)
   on conflict(branch_id,variant_id,channel) do update set price_uzs=excluded.price_uzs,min_packs=excluded.min_packs,
    step_packs=excluded.step_packs,available_packs=excluded.available_packs,availability=excluded.availability,
    quantity_tiers=excluded.quantity_tiers,conditions=excluded.conditions,source_type='admin_import',
    source_url=excluded.source_url,valid_until=excluded.valid_until,status='published';
  n:=n+1;
 end loop;
 return n;
end $$;
-- Audit insert is privileged; use a narrow trigger instead of granting audit writes to users.
-- The import's offer snapshots already create immutable audit entries.
revoke all on function public.publish_price_import(jsonb) from public;
grant execute on function public.publish_price_import(jsonb) to authenticated;

-- Alert evaluation reads only the caller's alerts; notifications are written by a bounded helper.
create function private.evaluate_alerts_for(uid uuid) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null or uid<>auth.uid() then raise exception 'Own alerts only' using errcode='42501'; end if;
 insert into public.notifications(user_id,alert_id,observation_id,message)
 select a.user_id,a.id,po.id,'Target price reached. Check pack size, MOQ, freshness and seller conditions.'
 from public.alerts a join public.variants v on v.product_id=a.product_id and v.active
 join public.offers o on o.variant_id=v.id join public.branches b on b.id=o.branch_id and b.active
 join public.sellers s on s.id=b.seller_id and s.verification_status='approved'
 join lateral (select id from public.price_observations where offer_id=o.id order by offer_version desc limit 1) po on true
 where a.user_id=uid and a.active and o.channel=a.channel and b.district=a.district
  and o.status='published' and o.availability<>'unavailable' and (o.available_packs is null or o.available_packs>=o.min_packs)
  and o.valid_until>now() and o.updated_at>=now()-interval '24 hours'
  and (not s.is_demo or a.include_demo) and (o.price_uzs/v.pack_quantity)<=a.target_unit_price_uzs
 on conflict(alert_id,observation_id) do nothing;
 get diagnostics n=row_count;
 return n;
end $$;
revoke all on function private.evaluate_alerts_for(uuid) from public;
grant execute on function private.evaluate_alerts_for(uuid) to authenticated;
create function public.evaluate_my_alerts() returns integer language sql security invoker set search_path='' as $$
 select private.evaluate_alerts_for(auth.uid())
$$;
revoke all on function public.evaluate_my_alerts() from public;
grant execute on function public.evaluate_my_alerts() to authenticated;

create function private.market_interest() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not (private.is_admin() or exists(select 1 from public.seller_memberships m join public.sellers s on s.id=m.seller_id where m.user_id=auth.uid() and s.verification_status='approved')) then
  raise exception 'Approved seller access required' using errcode='42501';
 end if;
 with events as (
  select product_id,user_id from public.search_events where created_at>=now()-interval '7 days'
  union select f.product_id,f.user_id from public.favorites f where f.created_at>=now()-interval '7 days'
  union select i.product_id,l.user_id from public.shopping_list_items i join public.shopping_lists l on l.id=i.list_id where l.updated_at>=now()-interval '7 days'
 ), grouped as (select product_id,count(distinct user_id) as interested_users from events group by product_id having count(distinct user_id)>=5)
 select coalesce(jsonb_agg(jsonb_build_object('product_id',product_id,'interested_users',interested_users)),'[]'::jsonb) into result from grouped;
 return jsonb_build_object('window_days',7,'minimum_distinct_users',5,'products',result,'evidence','Platform interest indicators, not confirmed sales. Small groups suppressed.');
end $$;
revoke all on function private.market_interest() from public;
grant execute on function private.market_interest() to authenticated;
create function public.market_signals() returns jsonb language sql security invoker set search_path='' as $$ select private.market_interest() $$;
revoke all on function public.market_signals() from public;
grant execute on function public.market_signals() to authenticated;

create function private.guard_catalog_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='variants' and (new.product_id<>old.product_id or new.pack_quantity<>old.pack_quantity) then
  raise exception 'Create a new variant instead of changing product or pack quantity';
 end if;
 return new;
end $$;
revoke all on function private.guard_catalog_identity() from public;
create trigger guard_variant_identity before update on public.variants for each row execute function private.guard_catalog_identity();

create function private.guard_branch_identity() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.seller_id<>old.seller_id then raise exception 'Branch seller cannot be reassigned'; end if;
 return new;
end $$;
revoke all on function private.guard_branch_identity() from public;
create trigger guard_branch_identity before update on public.branches for each row execute function private.guard_branch_identity();

create function private.audit_seller() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.audit_events(actor_id,entity,entity_id,action,details)
 values(auth.uid(),'seller',new.id,tg_op,jsonb_build_object('verification_status',new.verification_status));
 return new;
end $$;
revoke all on function private.audit_seller() from public;
create trigger audit_seller after insert or update on public.sellers for each row execute function private.audit_seller();

create function private.read_audit(n integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into result from
  (select id,actor_id,entity,entity_id,action,details,created_at from private.audit_events order by created_at desc,id limit least(greatest(n,1),100)) x;
 return result;
end $$;
revoke all on function private.read_audit(integer) from public;
grant execute on function private.read_audit(integer) to authenticated;
create function public.admin_audit_log(row_limit integer default 50) returns jsonb language sql security invoker set search_path='' as $$ select private.read_audit(row_limit) $$;
revoke all on function public.admin_audit_log(integer) from public;
grant execute on function public.admin_audit_log(integer) to authenticated;
