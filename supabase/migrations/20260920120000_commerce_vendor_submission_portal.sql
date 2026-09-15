-- ONEDECORE commerce vendor submission portal.
-- Vendors can create/edit only their own product submissions; taxonomy, approval and publish remain staff-only.

insert into public.roles (code,name,description,is_system,is_active) values
 ('commerce_vendor','Commerce Vendor','External vendor product-submission account',true,true)
on conflict (code) do update set name=excluded.name,description=excluded.description,is_system=true,is_active=true;

insert into public.permissions (code,name,description,is_system,is_active) values
 ('commerce.vendor.access','Access vendor commerce portal','Create and maintain owned product submissions only',true,true)
on conflict (code) do update set name=excluded.name,description=excluded.description,is_system=true,is_active=true;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='commerce_vendor' and p.code='commerce.vendor.access'
on conflict (role_id,permission_id) do nothing;

create sequence private.commerce_vendor_reference_seq start with 1 increment by 1;

create table public.commerce_vendors (
 id uuid primary key default gen_random_uuid(),
 vendor_code text not null unique,
 user_id uuid not null unique references auth.users(id) on delete restrict,
 display_name text not null,
 status text not null default 'active',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id) on delete restrict,
 constraint chk_commerce_vendor_code check (vendor_code ~ '^OD-V-[0-9]{4}-[0-9]{6}$'),
 constraint chk_commerce_vendor_name check (length(trim(display_name)) between 2 and 160),
 constraint chk_commerce_vendor_status check (status in ('active','suspended','disabled'))
);create trigger trg_commerce_vendors_updated_at before update on public.commerce_vendors
for each row execute function private.set_updated_at();

alter table public.commerce_products alter column category_id drop not null;
alter table public.commerce_products
 add column vendor_id uuid references public.commerce_vendors(id) on delete restrict,
 add column vendor_submission_status text,
 add column vendor_stock_status text,
 add column submitted_at timestamptz,
 add column reviewed_at timestamptz,
 add column reviewed_by uuid references public.profiles(id) on delete restrict,
 add column review_note text;

alter table public.commerce_products
 add constraint chk_commerce_vendor_submission_status check (
   vendor_submission_status is null or vendor_submission_status in ('draft','pending_review','changes_requested','approved','rejected')
 ),
 add constraint chk_commerce_vendor_stock_status check (
   vendor_stock_status is null or vendor_stock_status in ('in_stock','made_to_order','out_of_stock')
 ),
 add constraint chk_commerce_vendor_product_shape check (
   (vendor_id is null and vendor_submission_status is null and vendor_stock_status is null)
   or (vendor_id is not null and vendor_submission_status is not null and vendor_stock_status is not null)
 );

create index idx_commerce_products_vendor on public.commerce_products(vendor_id, vendor_submission_status, updated_at desc)
where vendor_id is not null;

create or replace function private.generate_commerce_vendor_reference()
returns text language plpgsql security definer set search_path='' as $$
begin
 return 'OD-V-'||to_char(now() at time zone 'Asia/Kolkata','YYYY')||'-'||lpad(nextval('private.commerce_vendor_reference_seq')::text,6,'0');
end $$;create or replace function private.current_commerce_vendor_id()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v uuid;
begin
 if auth.uid() is null or not private.has_permission('commerce.vendor.access') then return null; end if;
 select id into v from public.commerce_vendors where user_id=auth.uid() and status='active';
 return v;
end $$;

create or replace function private.commerce_require_vendor()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v uuid:=private.current_commerce_vendor_id();
begin
 if v is null then raise exception 'COMMERCE_UNAUTHORIZED' using errcode='42501'; end if;
 return v;
end $$;

create or replace function private.commerce_vendor_owns_product(p_product_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.commerce_products p
   where p.id=$1 and p.vendor_id=private.current_commerce_vendor_id()
 );
$$;

create or replace function private.commerce_vendor_publish_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and old.status is distinct from new.status
    and new.vendor_id is not null and new.vendor_submission_status<>'approved' then
   raise exception 'COMMERCE_VENDOR_APPROVAL_REQUIRED' using errcode='22023';
 end if;
 return new;
end $$;

create trigger trg_commerce_vendor_publish_guard
before update of status on public.commerce_products
for each row execute function private.commerce_vendor_publish_guard();create or replace function public.create_commerce_vendor(
 p_user_id uuid,p_display_name text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; h text; x jsonb; r public.commerce_vendors%rowtype; v_role uuid; op text:='create_commerce_vendor';
begin
 a:=private.commerce_require_actor('commerce.catalog.manage');
 if p_user_id is null or length(trim(coalesce(p_display_name,''))) not between 2 and 160 then
   raise exception 'COMMERCE_VALIDATION' using errcode='22023';
 end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 h:=private.commerce_sha256(jsonb_build_array(p_user_id,trim(p_display_name))::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 if exists(select 1 from public.commerce_vendors where user_id=p_user_id) then raise exception 'COMMERCE_VENDOR_USER_EXISTS' using errcode='23505'; end if;
 insert into public.commerce_vendors(vendor_code,user_id,display_name,created_by)
 values(private.generate_commerce_vendor_reference(),p_user_id,trim(p_display_name),a) returning * into r;
 select id into v_role from public.roles where code='commerce_vendor' and is_active=true;
 if v_role is null then raise exception 'COMMERCE_VENDOR_ROLE_MISSING' using errcode='42501'; end if;
 insert into public.user_roles(user_id,role_id,assigned_by) values(p_user_id,v_role,a)
 on conflict(user_id,role_id) do nothing;
 x:=jsonb_build_object('id',r.id,'vendor_code',r.vendor_code,'user_id',r.user_id,'display_name',r.display_name,'status',r.status);
 perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;

create or replace function public.get_my_commerce_vendor()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare vendor_id uuid:=private.current_commerce_vendor_id(); v public.commerce_vendors%rowtype;
begin
 if vendor_id is null then return null; end if;
 select * into v from public.commerce_vendors where id=vendor_id;
 if not found then return null; end if;
 return jsonb_build_object('id',v.id,'vendor_code',v.vendor_code,'user_id',v.user_id,'display_name',v.display_name,'status',v.status);
end $$;create or replace function public.create_my_vendor_commerce_product(
 p_name text,p_description text,p_sku text,p_selling_price_paise bigint,p_stock_status text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_vendor uuid; h text; x jsonb; p public.commerce_products%rowtype;
 v public.commerce_product_variants%rowtype; v_ref text; v_mode text; op text:='create_my_vendor_commerce_product';
begin
 v_vendor:=private.commerce_require_vendor();
 if a is null or length(trim(coalesce(p_name,''))) not between 2 and 200
    or length(trim(coalesce(p_description,''))) not between 2 and 4000 or p_description ~ '<'
    or p_selling_price_paise is null or p_selling_price_paise<=0
    or p_stock_status not in ('in_stock','made_to_order','out_of_stock') then
   raise exception 'COMMERCE_VALIDATION' using errcode='22023';
 end if;
 if lower(trim(coalesce(p_sku,''))) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(trim(p_sku)) not between 2 and 64 then
   raise exception 'COMMERCE_VALIDATION' using errcode='22023';
 end if;
 h:=private.commerce_sha256(jsonb_build_array(p_name,p_description,p_sku,p_selling_price_paise,p_stock_status)::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 v_ref:=private.generate_commerce_product_reference(); v_mode:=case when p_stock_status='made_to_order' then 'made_to_order' else 'ready_stock' end;
 insert into public.commerce_products(product_reference,category_id,name,slug,short_description,full_description,vendor_id,vendor_submission_status,vendor_stock_status,created_by,updated_by)
 values(v_ref,null,trim(p_name),lower(v_ref),left(trim(p_description),240),trim(p_description),v_vendor,'draft',p_stock_status,a,a) returning * into p;
 insert into public.commerce_product_variants(product_id,sku,option_values,selling_price_paise,availability_mode,sort_order,created_by,updated_by)
 values(p.id,lower(trim(p_sku)),'{}'::jsonb,p_selling_price_paise,v_mode,0,a,a) returning * into v;
 insert into public.commerce_inventory(variant_id,updated_by) values(v.id,a);
 x:=jsonb_build_object('product_id',p.id,'variant_id',v.id,'product_reference',p.product_reference,'lock_version',p.lock_version);
 perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;create or replace function public.update_my_vendor_commerce_product(
 p_product_id uuid,p_name text,p_description text,p_sku text,p_selling_price_paise bigint,p_stock_status text,p_expected_lock_version integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_vendor uuid; h text; x jsonb; p public.commerce_products%rowtype; v_id uuid; v_mode text; op text:='update_my_vendor_commerce_product';
begin
 v_vendor:=private.commerce_require_vendor();
 if length(trim(coalesce(p_name,''))) not between 2 and 200 or length(trim(coalesce(p_description,''))) not between 2 and 4000
    or p_description ~ '<' or p_selling_price_paise is null or p_selling_price_paise<=0
    or p_stock_status not in ('in_stock','made_to_order','out_of_stock')
    or lower(trim(coalesce(p_sku,''))) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
   raise exception 'COMMERCE_VALIDATION' using errcode='22023';
 end if;
 h:=private.commerce_sha256(jsonb_build_array(p_product_id,p_name,p_description,p_sku,p_selling_price_paise,p_stock_status,p_expected_lock_version)::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 select id into v_id from public.commerce_product_variants where product_id=p_product_id order by sort_order,created_at limit 1;
 if v_id is null then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 v_mode:=case when p_stock_status='made_to_order' then 'made_to_order' else 'ready_stock' end;
 update public.commerce_products set name=trim(p_name),short_description=left(trim(p_description),240),full_description=trim(p_description),
   vendor_stock_status=p_stock_status,updated_by=a,lock_version=lock_version+1
 where id=p_product_id and vendor_id=v_vendor and status='draft'
   and vendor_submission_status in ('draft','changes_requested') and lock_version=p_expected_lock_version returning * into p;
 if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 update public.commerce_product_variants set sku=lower(trim(p_sku)),selling_price_paise=p_selling_price_paise,availability_mode=v_mode,updated_by=a
 where id=v_id and product_id=p_product_id;
 x:=jsonb_build_object('product_id',p.id,'lock_version',p.lock_version,'vendor_submission_status',p.vendor_submission_status);
 perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;create or replace function public.submit_my_vendor_commerce_product(
 p_product_id uuid,p_expected_lock_version integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_vendor uuid; h text; x jsonb; p public.commerce_products%rowtype; op text:='submit_my_vendor_commerce_product';
begin
 v_vendor:=private.commerce_require_vendor();
 h:=private.commerce_sha256(jsonb_build_array(p_product_id,p_expected_lock_version)::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 select * into p from public.commerce_products where id=p_product_id and vendor_id=v_vendor for update;
 if not found or p.status<>'draft' or p.vendor_submission_status not in ('draft','changes_requested') or p.lock_version<>p_expected_lock_version then
   raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002';
 end if;
 if length(trim(p.name))<2 or length(trim(p.full_description))<2 or p.vendor_stock_status is null
    or not exists(select 1 from public.commerce_product_variants v where v.product_id=p.id and v.status='active' and v.selling_price_paise>0)
    or not exists(select 1 from public.commerce_product_media m where m.product_id=p.id and m.status='active') then
   raise exception 'COMMERCE_VENDOR_SUBMISSION_NOT_READY' using errcode='22023';
 end if;
 update public.commerce_products set vendor_submission_status='pending_review',submitted_at=now(),review_note=null,updated_by=a,lock_version=lock_version+1
 where id=p.id returning * into p;
 x:=jsonb_build_object('product_id',p.id,'vendor_submission_status',p.vendor_submission_status,'lock_version',p.lock_version,'submitted_at',p.submitted_at);
 perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;

create or replace function public.review_vendor_commerce_product(
 p_product_id uuid,p_decision text,p_note text,p_expected_lock_version integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid; h text; x jsonb; p public.commerce_products%rowtype; v_status text; op text:='review_vendor_commerce_product';
begin
 a:=private.commerce_require_actor('commerce.catalog.manage');
 if p_decision not in ('approve','request_changes','reject') then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if;
 if p_decision in ('request_changes','reject') and length(trim(coalesce(p_note,'')))<2 then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if;
 h:=private.commerce_sha256(jsonb_build_array(p_product_id,p_decision,p_note,p_expected_lock_version)::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 select * into p from public.commerce_products where id=p_product_id and vendor_id is not null for update;
 if not found or p.status<>'draft' or p.vendor_submission_status<>'pending_review' or p.lock_version<>p_expected_lock_version then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 if p_decision='approve' and (p.category_id is null or not exists(select 1 from public.commerce_categories c where c.id=p.category_id and c.status='active')) then raise exception 'COMMERCE_VENDOR_CATEGORY_REQUIRED' using errcode='22023'; end if;
 v_status:=case p_decision when 'approve' then 'approved' when 'request_changes' then 'changes_requested' else 'rejected' end;
 update public.commerce_products set vendor_submission_status=v_status,review_note=nullif(trim(coalesce(p_note,'')),''),reviewed_at=now(),reviewed_by=a,updated_by=a,lock_version=lock_version+1 where id=p.id returning * into p;
 x:=jsonb_build_object('product_id',p.id,'vendor_submission_status',p.vendor_submission_status,'lock_version',p.lock_version);
 perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;create or replace function public.authorize_my_vendor_product_media_upload(
 p_product_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_vendor uuid; h text; x jsonb; m uuid:=gen_random_uuid(); p public.commerce_products%rowtype; v_primary boolean; op text:='authorize_my_vendor_product_media_upload';
begin
 v_vendor:=private.commerce_require_vendor();
 select * into p from public.commerce_products where id=p_product_id and vendor_id=v_vendor and status='draft' and vendor_submission_status in ('draft','changes_requested');
 if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 h:=private.commerce_sha256(p_product_id::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 v_primary:=not exists(select 1 from public.commerce_product_media where product_id=p_product_id and status='active');
 insert into public.commerce_product_media(id,product_id,variant_id,original_path,public_path,alt_text,is_primary,sort_order,created_by)
 values(m,p_product_id,null,p_product_id::text||'/'||m::text||'/original',p_product_id::text||'/'||m::text||'/derivative.webp',p.name,v_primary,0,a);
 x:=jsonb_build_object('media_id',m,'original_path',p_product_id::text||'/'||m::text||'/original','public_path',p_product_id::text||'/'||m::text||'/derivative.webp');
 perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;

create or replace function public.finalize_my_vendor_product_media(
 p_media_id uuid,p_original_path text,p_public_path text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_vendor uuid; h text; x jsonb; m public.commerce_product_media%rowtype; op text:='finalize_my_vendor_product_media';
begin
 v_vendor:=private.commerce_require_vendor();
 select m0.* into m from public.commerce_product_media m0 join public.commerce_products p on p.id=m0.product_id
 where m0.id=p_media_id and p.vendor_id=v_vendor and p.status='draft' and p.vendor_submission_status in ('draft','changes_requested') for update of m0;
 if not found or m.original_path<>p_original_path or m.public_path<>p_public_path then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 h:=private.commerce_sha256(jsonb_build_array(p_media_id,p_original_path,p_public_path)::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id=m.original_bucket and o.name=m.original_path)
    or not exists(select 1 from storage.objects o where o.bucket_id=m.public_bucket and o.name=m.public_path) then raise exception 'COMMERCE_MEDIA_OBJECT_MISSING' using errcode='22023'; end if;
 if m.is_primary then update public.commerce_product_media set is_primary=false,updated_at=now() where product_id=m.product_id and id<>m.id and status='active'; end if;
 update public.commerce_product_media set status='active',updated_at=now() where id=m.id;
 x:=jsonb_build_object('media_id',m.id,'status','active'); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;create or replace function public.archive_my_vendor_product_media(
 p_media_id uuid,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_vendor uuid; h text; x jsonb; m public.commerce_product_media%rowtype; v_next uuid; op text:='archive_my_vendor_product_media';
begin
 v_vendor:=private.commerce_require_vendor();
 select m0.* into m from public.commerce_product_media m0 join public.commerce_products p on p.id=m0.product_id
 where m0.id=p_media_id and p.vendor_id=v_vendor and p.status='draft' and p.vendor_submission_status in ('draft','changes_requested') for update of m0;
 if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 h:=private.commerce_sha256(p_media_id::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
 x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 update public.commerce_product_media set status='archived',is_primary=false,updated_at=now() where id=m.id;
 if m.is_primary then
   select id into v_next from public.commerce_product_media
   where product_id=m.product_id and status='active' and id<>m.id order by sort_order,created_at,id limit 1;
   if v_next is not null then update public.commerce_product_media set is_primary=true,updated_at=now() where id=v_next; end if;
 end if;
 x:=jsonb_build_object('media_id',m.id,'status','archived'); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x;
end $$;

create or replace function private.commerce_vendor_owns_variant(p_variant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.commerce_product_variants v
   join public.commerce_products p on p.id=v.product_id
   where v.id=$1 and p.vendor_id=private.current_commerce_vendor_id()
 );
$$;alter table public.commerce_vendors enable row level security;
alter table public.commerce_vendors force row level security;
revoke all on table public.commerce_vendors from public,anon,authenticated;
grant select on table public.commerce_vendors to authenticated;

create policy commerce_vendors_admin_read on public.commerce_vendors for select to authenticated
using ((select public.authorize('commerce.read')));
create policy commerce_vendors_self_read on public.commerce_vendors for select to authenticated
using (id=private.current_commerce_vendor_id());

create policy commerce_products_vendor_read on public.commerce_products for select to authenticated
using (vendor_id=private.current_commerce_vendor_id());
create policy commerce_variants_vendor_read on public.commerce_product_variants for select to authenticated
using (private.commerce_vendor_owns_product(product_id));
create policy commerce_inventory_vendor_read on public.commerce_inventory for select to authenticated
using (private.commerce_vendor_owns_variant(variant_id));
create policy commerce_media_vendor_read on public.commerce_product_media for select to authenticated
using (private.commerce_vendor_owns_product(product_id));

revoke all on sequence private.commerce_vendor_reference_seq from public,anon,authenticated;
revoke all on function private.generate_commerce_vendor_reference() from public,anon,authenticated;
revoke all on function private.current_commerce_vendor_id() from public,anon,authenticated;
revoke all on function private.commerce_require_vendor() from public,anon,authenticated;
revoke all on function private.commerce_vendor_owns_product(uuid) from public,anon,authenticated;
revoke all on function private.commerce_vendor_owns_variant(uuid) from public,anon,authenticated;
revoke all on function private.commerce_vendor_publish_guard() from public,anon,authenticated;
grant execute on function private.current_commerce_vendor_id() to authenticated;
grant execute on function private.commerce_vendor_owns_product(uuid) to authenticated;
grant execute on function private.commerce_vendor_owns_variant(uuid) to authenticated;do $$ declare r record; begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
  'create_commerce_vendor','get_my_commerce_vendor','create_my_vendor_commerce_product',
  'update_my_vendor_commerce_product','submit_my_vendor_commerce_product','review_vendor_commerce_product',
  'authorize_my_vendor_product_media_upload','finalize_my_vendor_product_media','archive_my_vendor_product_media'
 ) loop
  execute format('alter function %s owner to postgres',r.sig);
  execute format('revoke all on function %s from public,anon,authenticated',r.sig);
 end loop;
end $$;

grant execute on function public.create_commerce_vendor(uuid,text,uuid) to authenticated;
grant execute on function public.get_my_commerce_vendor() to authenticated;
grant execute on function public.create_my_vendor_commerce_product(text,text,text,bigint,text,uuid) to authenticated;
grant execute on function public.update_my_vendor_commerce_product(uuid,text,text,text,bigint,text,integer,uuid) to authenticated;
grant execute on function public.submit_my_vendor_commerce_product(uuid,integer,uuid) to authenticated;
grant execute on function public.review_vendor_commerce_product(uuid,text,text,integer,uuid) to authenticated;
grant execute on function public.authorize_my_vendor_product_media_upload(uuid,uuid) to authenticated;
grant execute on function public.finalize_my_vendor_product_media(uuid,text,text,uuid) to authenticated;
grant execute on function public.archive_my_vendor_product_media(uuid,uuid) to authenticated;

comment on table public.commerce_vendors is 'One-to-one vendor account registry: one immutable vendor code and one auth user per commerce vendor.';
comment on column public.commerce_products.vendor_submission_status is 'Vendor review workflow only; independent from catalogue publication status.';