-- ============================================================================
-- ONEDECORE Phase 9D-B catalogue/inventory foundation — M35
-- ADR-0030 / ADR-0028. Forward-only. Not managed-applied in this gate.
-- No orders/payments. No public /shop.
-- ============================================================================

-- Permissions
insert into public.permissions (code, name, description, is_system, is_active) values
  ('commerce.read', 'Read commerce catalogue', 'Read commerce catalogue and inventory foundation', true, true),
  ('commerce.catalog.manage', 'Manage commerce catalogue', 'Manage categories, products, variants, and media', true, true),
  ('commerce.inventory.manage', 'Manage commerce inventory', 'Adjust commerce inventory', true, true),
  ('commerce.orders.manage', 'Manage commerce orders', 'Reserved for commerce order management', true, true),
  ('commerce.payments.read', 'Read commerce payments', 'Reserved for commerce payment visibility', true, true),
  ('commerce.settings.manage', 'Manage commerce settings', 'Manage tax, shipping, and pincode settings', true, true)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, is_system = true, is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'super_admin'
  and p.code in ('commerce.read','commerce.catalog.manage','commerce.inventory.manage',
                 'commerce.orders.manage','commerce.payments.read','commerce.settings.manage')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'sales_manager'
  and p.code in ('commerce.read','commerce.orders.manage','commerce.payments.read')
on conflict (role_id, permission_id) do nothing;

create sequence private.commerce_product_reference_seq start with 1 increment by 1;
create sequence private.commerce_category_reference_seq start with 1 increment by 1;

create table public.commerce_categories (
  id uuid primary key default gen_random_uuid(),
  category_reference text not null unique,
  name text not null,
  slug text not null unique,
  parent_category_id uuid references public.commerce_categories(id) on delete restrict,
  short_description text,
  seo_title text,
  seo_description text,
  sort_order integer not null default 0,
  status text not null default 'active',
  shipping_charge_paise_override bigint,
  cod_allowed_override boolean,
  free_shipping_eligible_override boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_categories_reference check (category_reference ~ '^OD-CC-[0-9]{4}-[0-9]{6}$'),
  constraint chk_commerce_categories_slug check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 2 and 120),
  constraint chk_commerce_categories_status check (status in ('active','archived')),
  constraint chk_commerce_categories_shipping check (shipping_charge_paise_override is null or shipping_charge_paise_override >= 0)
);

create table public.commerce_tax_rates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  rate_basis_points integer not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_tax_rates_code check (length(trim(code)) between 1 and 64),
  constraint chk_commerce_tax_rates_name check (length(trim(name)) between 1 and 160),
  constraint chk_commerce_tax_rates_basis check (rate_basis_points between 0 and 10000)
);

create table public.commerce_tax_settings (
  id smallint primary key default 1,
  gst_inclusive_display boolean not null default true,
  tax_required_for_publish boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_tax_settings_singleton check (id = 1)
);
insert into public.commerce_tax_settings(id) values (1) on conflict (id) do nothing;

create table public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  product_reference text not null unique,
  category_id uuid not null references public.commerce_categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text,
  full_description text not null default '',
  status text not null default 'draft',
  tax_rate_id uuid references public.commerce_tax_rates(id) on delete restrict,
  hsn_sac_code text,
  shipping_charge_paise_override bigint,
  cod_allowed_override boolean,
  free_shipping_eligible_override boolean,
  seo_title text,
  seo_description text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  lock_version integer not null default 1,
  constraint chk_commerce_products_reference check (product_reference ~ '^OD-P-[0-9]{4}-[0-9]{6}$'),
  constraint chk_commerce_products_slug check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 2 and 120),
  constraint chk_commerce_products_name check (length(trim(name)) between 2 and 200),
  constraint chk_commerce_products_no_html check (full_description !~ '<'),
  constraint chk_commerce_products_status check (status in ('draft','published','archived')),
  constraint chk_commerce_products_shipping check (shipping_charge_paise_override is null or shipping_charge_paise_override >= 0),
  constraint chk_commerce_products_lock check (lock_version >= 1)
);

create table public.commerce_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  sku text not null unique,
  option_values jsonb not null default '{}'::jsonb,
  display_name text,
  selling_price_paise bigint not null,
  compare_at_price_paise bigint,
  status text not null default 'active',
  availability_mode text not null default 'ready_stock',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_variants_price check (selling_price_paise >= 0 and (compare_at_price_paise is null or compare_at_price_paise >= selling_price_paise)),
  constraint chk_commerce_variants_status check (status in ('active','archived')),
  constraint chk_commerce_variants_mode check (availability_mode in ('ready_stock','made_to_order')),
  constraint chk_commerce_variants_sku check (sku ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(sku) between 2 and 64)
);

create table public.commerce_inventory (
  variant_id uuid primary key references public.commerce_product_variants(id) on delete restrict,
  stock_on_hand integer not null default 0,
  reserved_qty integer not null default 0,
  available_qty integer generated always as (stock_on_hand - reserved_qty) stored,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_inventory_nonnegative check (stock_on_hand >= 0 and reserved_qty >= 0),
  constraint chk_commerce_inventory_reserved check (stock_on_hand >= reserved_qty)
);

create table public.commerce_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  variant_id uuid references public.commerce_product_variants(id) on delete restrict,
  original_bucket text not null default 'commerce-product-originals',
  original_path text not null,
  public_bucket text not null default 'commerce-product-public',
  public_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  status text not null default 'archived',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  constraint chk_commerce_media_original_bucket check (original_bucket = 'commerce-product-originals'),
  constraint chk_commerce_media_public_bucket check (public_bucket = 'commerce-product-public'),
  constraint chk_commerce_media_status check (status in ('active','archived'))
);
create unique index uq_commerce_product_media_primary
  on public.commerce_product_media(product_id) where is_primary and status = 'active';

create table public.commerce_product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  specification_key text not null,
  specification_value text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  unique (product_id, specification_key)
);

create table public.commerce_related_products (
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  related_product_id uuid not null references public.commerce_products(id) on delete restrict,
  sort_order integer not null default 0,
  primary key (product_id, related_product_id),
  constraint chk_commerce_related_products_distinct check (product_id <> related_product_id)
);

create table public.commerce_pincodes (
  pincode text primary key,
  serviceable boolean not null,
  zone_code text,
  eta_min_days integer not null default 0,
  eta_max_days integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_pincodes_format check (pincode ~ '^[0-9]{6}$'),
  constraint chk_commerce_pincodes_eta check (eta_min_days >= 0 and eta_max_days >= eta_min_days)
);

create table public.commerce_shipping_settings (
  id smallint primary key default 1,
  default_shipping_charge_paise bigint not null default 0,
  free_shipping_threshold_paise bigint,
  cod_enabled_global boolean not null default true,
  assembly_install_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete restrict,
  constraint chk_commerce_shipping_singleton check (id = 1),
  constraint chk_commerce_shipping_amounts check (default_shipping_charge_paise >= 0 and (free_shipping_threshold_paise is null or free_shipping_threshold_paise >= 0))
);
insert into public.commerce_shipping_settings(id) values (1) on conflict (id) do nothing;

create table private.commerce_idempotency_requests (
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  response_snapshot jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key),
  constraint chk_commerce_idempotency_operation check (length(trim(operation)) between 1 and 64),
  constraint chk_commerce_idempotency_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_commerce_idempotency_response check (response_snapshot is null or (jsonb_typeof(response_snapshot) = 'object' and pg_column_size(response_snapshot) <= 8192))
);

create or replace function private.commerce_touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create or replace function private.commerce_reject_category_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_category_id = new.id then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;
  if new.parent_category_id is not null and exists (
    select 1 from public.commerce_categories c where c.id = new.parent_category_id and c.parent_category_id is not null
  ) then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;
  return new;
end $$;

create or replace function private.commerce_option_values_valid(p_values jsonb)
returns boolean language plpgsql immutable security definer set search_path = '' as $$
declare k text; v text;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'object' then return false; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_values)
  loop
    if k not in ('color','finish','size','upholstery') or jsonb_typeof(p_values -> k) <> 'string'
       or length(v) not between 1 and 64 or v ~ '[[:cntrl:]]' then return false; end if;
  end loop;
  return true;
end $$;

alter table public.commerce_product_variants
  add constraint chk_commerce_variants_options
  check (private.commerce_option_values_valid(option_values));

create or replace function private.commerce_media_same_product()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.variant_id is not null and not exists (
    select 1 from public.commerce_product_variants v where v.id = new.variant_id and v.product_id = new.product_id
  ) then raise exception 'COMMERCE_VALIDATION' using errcode = '22023'; end if;
  return new;
end $$;

create trigger trg_commerce_categories_parent before insert or update on public.commerce_categories
for each row execute function private.commerce_reject_category_parent();
create trigger trg_commerce_media_product before insert or update on public.commerce_product_media
for each row execute function private.commerce_media_same_product();

do $$
declare t text; r record; trigger_fn text;
begin
  trigger_fn := case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'set_updated_at'
  ) then 'private.set_updated_at()' else 'private.commerce_touch_updated_at()' end;
  for t in select unnest(array['commerce_categories','commerce_tax_rates','commerce_tax_settings','commerce_products','commerce_product_variants','commerce_inventory','commerce_product_media','commerce_product_specifications','commerce_pincodes','commerce_shipping_settings']) loop
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function %s', t, t, trigger_fn);
  end loop;
end $$;

create or replace function private.commerce_sha256(p_value text)
returns text language sql immutable security definer set search_path = ''
as $$ select encode(extensions.digest(convert_to(coalesce(p_value,''),'UTF8'),'sha256'),'hex') $$;

create or replace function private.commerce_require_actor(p_permission text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare a uuid := auth.uid();
begin
  if a is null or not exists (select 1 from public.profiles p where p.id = a and p.status = 'active')
     or p_permission is null or not private.has_permission(p_permission)
  then raise exception 'COMMERCE_UNAUTHORIZED' using errcode = '42501'; end if;
  return a;
end $$;

create or replace function private.commerce_idempotency_xact_lock(p_actor_id uuid,p_operation text,p_idempotency_key uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin perform pg_advisory_xact_lock(('x'||substr(private.commerce_sha256(coalesce(p_actor_id::text,'')||'|'||coalesce(p_operation,'')||'|'||coalesce(p_idempotency_key::text,'')),1,16))::bit(64)::bigint); end $$;

create or replace function private.commerce_idempotency_lookup(p_actor_id uuid,p_operation text,p_idempotency_key uuid,p_request_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.commerce_idempotency_requests%rowtype;
begin
  select * into r from private.commerce_idempotency_requests where actor_id=p_actor_id and operation=p_operation and idempotency_key=p_idempotency_key;
  if not found then return null; end if;
  if r.request_hash is distinct from p_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
  return r.response_snapshot;
end $$;

create or replace function private.commerce_idempotency_store(p_actor_id uuid,p_operation text,p_idempotency_key uuid,p_request_hash text,p_response jsonb)
returns void language sql security definer set search_path = '' as $$
insert into private.commerce_idempotency_requests(actor_id,operation,idempotency_key,request_hash,response_snapshot)
values ($1,$2,$3,$4,$5)
$$;

create or replace function private.generate_commerce_product_reference()
returns text language plpgsql security definer set search_path = '' as $$
begin return 'OD-P-'||to_char(now() at time zone 'Asia/Kolkata','YYYY')||'-'||lpad(nextval('private.commerce_product_reference_seq')::text,6,'0'); end $$;
create or replace function private.generate_commerce_category_reference()
returns text language plpgsql security definer set search_path = '' as $$
begin return 'OD-CC-'||to_char(now() at time zone 'Asia/Kolkata','YYYY')||'-'||lpad(nextval('private.commerce_category_reference_seq')::text,6,'0'); end $$;

-- Categories
create or replace function public.upsert_commerce_category(p_id uuid,p_name text,p_slug text,p_parent_id uuid,p_short_description text,p_seo_title text,p_seo_description text,p_sort_order integer,p_shipping_charge_paise_override bigint,p_cod_allowed_override boolean,p_free_shipping_eligible_override boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; replay jsonb; r public.commerce_categories%rowtype; op text:='upsert_commerce_category'; begin
 a:=private.commerce_require_actor('commerce.catalog.manage'); if p_idempotency_key is null then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if;
 h:=private.commerce_sha256(jsonb_build_array(p_id,p_name,p_slug,p_parent_id,p_short_description,p_seo_title,p_seo_description,p_sort_order,p_shipping_charge_paise_override,p_cod_allowed_override,p_free_shipping_eligible_override)::text);
 perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); replay:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if replay is not null then return replay; end if;
 if p_id is null then insert into public.commerce_categories(category_reference,name,slug,parent_category_id,short_description,seo_title,seo_description,sort_order,shipping_charge_paise_override,cod_allowed_override,free_shipping_eligible_override,created_by,updated_by)
 values(private.generate_commerce_category_reference(),trim(p_name),lower(trim(p_slug)),p_parent_id,p_short_description,p_seo_title,p_seo_description,coalesce(p_sort_order,0),p_shipping_charge_paise_override,p_cod_allowed_override,p_free_shipping_eligible_override,a,a) returning * into r;
 else update public.commerce_categories set name=trim(p_name),slug=lower(trim(p_slug)),parent_category_id=p_parent_id,short_description=p_short_description,seo_title=p_seo_title,seo_description=p_seo_description,sort_order=coalesce(p_sort_order,0),shipping_charge_paise_override=p_shipping_charge_paise_override,cod_allowed_override=p_cod_allowed_override,free_shipping_eligible_override=p_free_shipping_eligible_override,updated_by=a where id=p_id and status<>'archived' returning * into r; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; end if;
 replay=jsonb_build_object('id',r.id,'category_reference',r.category_reference,'status',r.status); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,replay); return replay; end $$;

create or replace function public.set_commerce_category_status(p_id uuid,p_status text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_categories%rowtype; op text:='set_commerce_category_status'; begin
 a:=private.commerce_require_actor('commerce.catalog.manage'); if p_status not in ('active','archived') then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if;
 h:=private.commerce_sha256(jsonb_build_array(p_id,p_status)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 update public.commerce_categories set status=p_status,updated_by=a where id=p_id returning * into r; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 x=jsonb_build_object('id',r.id,'status',r.status); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

-- Product and variant RPCs
create or replace function public.create_commerce_product(p_category_id uuid,p_name text,p_slug text,p_short_description text,p_full_description text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_products%rowtype; op text:='create_commerce_product'; begin
 a:=private.commerce_require_actor('commerce.catalog.manage'); h:=private.commerce_sha256(jsonb_build_array(p_category_id,p_name,p_slug,p_short_description,p_full_description)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 if not exists(select 1 from public.commerce_categories where id=p_category_id and status='active') then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.commerce_products(product_reference,category_id,name,slug,short_description,full_description,created_by,updated_by) values(private.generate_commerce_product_reference(),p_category_id,trim(p_name),lower(trim(p_slug)),p_short_description,coalesce(p_full_description,''),a,a) returning * into r;
 x=jsonb_build_object('id',r.id,'product_reference',r.product_reference,'status',r.status,'lock_version',r.lock_version); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.update_commerce_product(p_id uuid,p_category_id uuid,p_name text,p_slug text,p_short_description text,p_full_description text,p_tax_rate_id uuid,p_hsn_sac_code text,p_shipping_charge_paise_override bigint,p_cod_allowed_override boolean,p_free_shipping_eligible_override boolean,p_seo_title text,p_seo_description text,p_featured boolean,p_expected_lock_version integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_products%rowtype; op text:='update_commerce_product'; begin
 a:=private.commerce_require_actor('commerce.catalog.manage'); h:=private.commerce_sha256(jsonb_build_array(p_id,p_category_id,p_name,p_slug,p_short_description,p_full_description,p_tax_rate_id,p_hsn_sac_code,p_shipping_charge_paise_override,p_cod_allowed_override,p_free_shipping_eligible_override,p_seo_title,p_seo_description,p_featured,p_expected_lock_version)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 update public.commerce_products set category_id=p_category_id,name=trim(p_name),slug=lower(trim(p_slug)),short_description=p_short_description,full_description=coalesce(p_full_description,''),tax_rate_id=p_tax_rate_id,hsn_sac_code=p_hsn_sac_code,shipping_charge_paise_override=p_shipping_charge_paise_override,cod_allowed_override=p_cod_allowed_override,free_shipping_eligible_override=p_free_shipping_eligible_override,seo_title=p_seo_title,seo_description=p_seo_description,featured=coalesce(p_featured,false),updated_by=a,lock_version=lock_version+1 where id=p_id and lock_version=p_expected_lock_version and status in ('draft','published') returning * into r;
 if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; x=jsonb_build_object('id',r.id,'lock_version',r.lock_version); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.upsert_commerce_product_variant(p_id uuid,p_product_id uuid,p_sku text,p_option_values jsonb,p_display_name text,p_selling_price_paise bigint,p_compare_at_price_paise bigint,p_availability_mode text,p_sort_order integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_product_variants%rowtype; op text:='upsert_commerce_product_variant'; begin
 a:=private.commerce_require_actor('commerce.catalog.manage'); if not private.commerce_option_values_valid(coalesce(p_option_values,'{}'::jsonb)) then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if; h:=private.commerce_sha256(jsonb_build_array(p_id,p_product_id,p_sku,p_option_values,p_display_name,p_selling_price_paise,p_compare_at_price_paise,p_availability_mode,p_sort_order)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if;
 if not exists(select 1 from public.commerce_products where id=p_product_id) then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 if p_id is null then insert into public.commerce_product_variants(product_id,sku,option_values,display_name,selling_price_paise,compare_at_price_paise,availability_mode,sort_order,created_by,updated_by) values(p_product_id,lower(trim(p_sku)),coalesce(p_option_values,'{}'::jsonb),p_display_name,p_selling_price_paise,p_compare_at_price_paise,coalesce(p_availability_mode,'ready_stock'),coalesce(p_sort_order,0),a,a) returning * into r; insert into public.commerce_inventory(variant_id,updated_by) values(r.id,a);
 else update public.commerce_product_variants set sku=lower(trim(p_sku)),option_values=coalesce(p_option_values,'{}'::jsonb),display_name=p_display_name,selling_price_paise=p_selling_price_paise,compare_at_price_paise=p_compare_at_price_paise,availability_mode=coalesce(p_availability_mode,'ready_stock'),sort_order=coalesce(p_sort_order,0),updated_by=a where id=p_id and product_id=p_product_id returning * into r; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; end if;
 x=jsonb_build_object('id',r.id,'product_id',r.product_id,'sku',r.sku); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.set_commerce_variant_status(p_id uuid,p_status text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_product_variants%rowtype; op text:='set_commerce_variant_status'; begin
 a:=private.commerce_require_actor('commerce.catalog.manage'); if p_status not in ('active','archived') then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if; h:=private.commerce_sha256(jsonb_build_array(p_id,p_status)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; update public.commerce_product_variants set status=p_status,updated_by=a where id=p_id returning * into r; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; x=jsonb_build_object('id',r.id,'status',r.status); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.publish_commerce_product(p_id uuid,p_expected_lock_version integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_products%rowtype; t public.commerce_tax_settings%rowtype; op text:='publish_commerce_product'; begin
 a:=private.commerce_require_actor('commerce.catalog.manage'); h:=private.commerce_sha256(jsonb_build_array(p_id,p_expected_lock_version)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; select * into r from public.commerce_products where id=p_id for update; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
 select * into t from public.commerce_tax_settings where id=1; if length(trim(r.name)) not between 2 and 200 or not exists(select 1 from public.commerce_categories c where c.id=r.category_id and c.status='active') or not exists(select 1 from public.commerce_product_variants v where v.product_id=r.id and v.status='active' and private.commerce_option_values_valid(v.option_values) and v.selling_price_paise>=0) or (t.tax_required_for_publish and (r.tax_rate_id is null or not exists(select 1 from public.commerce_tax_rates tr where tr.id=r.tax_rate_id and tr.is_active))) or not exists(select 1 from public.commerce_product_media m where m.product_id=r.id and m.status='active' and m.is_primary and m.public_path<>'') then raise exception 'COMMERCE_PUBLISH_NOT_READY' using errcode='22023'; end if;
 update public.commerce_products set status='published',published_at=coalesce(published_at,now()),updated_by=a,lock_version=lock_version+1 where id=p_id and lock_version=p_expected_lock_version returning * into r; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; x=jsonb_build_object('id',r.id,'status',r.status,'lock_version',r.lock_version); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.archive_commerce_product(p_id uuid,p_expected_lock_version integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_products%rowtype; op text:='archive_commerce_product'; begin a:=private.commerce_require_actor('commerce.catalog.manage'); h:=private.commerce_sha256(jsonb_build_array(p_id,p_expected_lock_version)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; update public.commerce_products set status='archived',archived_at=coalesce(archived_at,now()),updated_by=a,lock_version=lock_version+1 where id=p_id and lock_version=p_expected_lock_version returning * into r; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; x=jsonb_build_object('id',r.id,'status',r.status,'lock_version',r.lock_version); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

-- Inventory and collection replacement RPCs
create or replace function public.adjust_commerce_inventory(p_variant_id uuid,p_delta integer,p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_inventory%rowtype; op text:='adjust_commerce_inventory'; begin a:=private.commerce_require_actor('commerce.inventory.manage'); if p_delta is null or p_reason is null or length(trim(p_reason)) not between 1 and 80 then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if; h:=private.commerce_sha256(jsonb_build_array(p_variant_id,p_delta,p_reason)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; select * into r from public.commerce_inventory where variant_id=p_variant_id for update; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; if r.stock_on_hand+p_delta<r.reserved_qty then raise exception 'COMMERCE_INVENTORY_UNDERFLOW' using errcode='22023'; end if; update public.commerce_inventory set stock_on_hand=stock_on_hand+p_delta,updated_by=a where variant_id=p_variant_id returning * into r; x=jsonb_build_object('variant_id',r.variant_id,'stock_on_hand',r.stock_on_hand,'reserved_qty',r.reserved_qty,'available_qty',r.available_qty); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.replace_commerce_product_specifications(p_product_id uuid,p_specs jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; i jsonb; op text:='replace_commerce_product_specifications'; begin a:=private.commerce_require_actor('commerce.catalog.manage'); if jsonb_typeof(p_specs)<>'array' then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if; h:=private.commerce_sha256(jsonb_build_array(p_product_id,p_specs)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; if not exists(select 1 from public.commerce_products where id=p_product_id) then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; delete from public.commerce_product_specifications where product_id=p_product_id; for i in select value from jsonb_array_elements(p_specs) loop if length(trim(i->>'key')) not between 1 and 120 or length(i->>'value')>1000 then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if; insert into public.commerce_product_specifications(product_id,specification_key,specification_value,sort_order,created_by,updated_by) values(p_product_id,trim(i->>'key'),i->>'value',coalesce((i->>'sort_order')::integer,0),a,a); end loop; x=jsonb_build_object('product_id',p_product_id,'count',jsonb_array_length(p_specs)); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.replace_commerce_related_products(p_product_id uuid,p_related_ids uuid[],p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; v_related uuid; v_ord integer := 0; op text:='replace_commerce_related_products';
begin
  a:=private.commerce_require_actor('commerce.catalog.manage');
  h:=private.commerce_sha256(jsonb_build_array(p_product_id,p_related_ids)::text);
  perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
  x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h);
  if x is not null then return x; end if;
  if p_product_id = any(coalesce(p_related_ids, array[]::uuid[]))
     or not exists (select 1 from public.commerce_products p where p.id = p_product_id) then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  delete from public.commerce_related_products where product_id = p_product_id;
  foreach v_related in array coalesce(p_related_ids, array[]::uuid[]) loop
    if not exists (select 1 from public.commerce_products p where p.id = v_related) then
      raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002';
    end if;
    insert into public.commerce_related_products(product_id, related_product_id, sort_order)
    values (p_product_id, v_related, v_ord);
    v_ord := v_ord + 1;
  end loop;
  x := jsonb_build_object('product_id', p_product_id, 'count', coalesce(array_length(p_related_ids,1),0));
  perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x);
  return x;
end $$;

-- Tax, shipping, pincodes
create or replace function public.upsert_commerce_tax_rate(p_id uuid,p_code text,p_name text,p_rate_basis_points integer,p_description text,p_is_active boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_tax_rates%rowtype; op text:='upsert_commerce_tax_rate'; begin a:=private.commerce_require_actor('commerce.settings.manage'); h:=private.commerce_sha256(jsonb_build_array(p_id,p_code,p_name,p_rate_basis_points,p_description,p_is_active)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; if p_id is null then insert into public.commerce_tax_rates(code,name,rate_basis_points,description,is_active,created_by,updated_by) values(trim(p_code),trim(p_name),p_rate_basis_points,p_description,coalesce(p_is_active,true),a,a) returning * into r; else update public.commerce_tax_rates set code=trim(p_code),name=trim(p_name),rate_basis_points=p_rate_basis_points,description=p_description,is_active=coalesce(p_is_active,true),updated_by=a where id=p_id returning * into r; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; end if; x=jsonb_build_object('id',r.id,'code',r.code,'rate_basis_points',r.rate_basis_points,'is_active',r.is_active); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.update_commerce_tax_settings(p_gst_inclusive_display boolean,p_tax_required_for_publish boolean,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_tax_settings%rowtype; op text:='update_commerce_tax_settings'; begin a:=private.commerce_require_actor('commerce.settings.manage'); h:=private.commerce_sha256(jsonb_build_array(p_gst_inclusive_display,p_tax_required_for_publish)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; update public.commerce_tax_settings set gst_inclusive_display=p_gst_inclusive_display,tax_required_for_publish=p_tax_required_for_publish,updated_by=a where id=1 returning * into r; x=jsonb_build_object('id',r.id,'gst_inclusive_display',r.gst_inclusive_display,'tax_required_for_publish',r.tax_required_for_publish); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.upsert_commerce_pincode(p_pincode text,p_serviceable boolean,p_zone_code text,p_eta_min_days integer,p_eta_max_days integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; op text:='upsert_commerce_pincode'; begin a:=private.commerce_require_actor('commerce.settings.manage'); h:=private.commerce_sha256(jsonb_build_array(p_pincode,p_serviceable,p_zone_code,p_eta_min_days,p_eta_max_days)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; insert into public.commerce_pincodes(pincode,serviceable,zone_code,eta_min_days,eta_max_days,updated_by) values(trim(p_pincode),p_serviceable,nullif(trim(p_zone_code),''),p_eta_min_days,p_eta_max_days,a) on conflict(pincode) do update set serviceable=excluded.serviceable,zone_code=excluded.zone_code,eta_min_days=excluded.eta_min_days,eta_max_days=excluded.eta_max_days,updated_by=excluded.updated_by; x=jsonb_build_object('pincode',trim(p_pincode),'serviceable',p_serviceable); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.update_commerce_shipping_settings(p_default_shipping_charge_paise bigint,p_free_shipping_threshold_paise bigint,p_cod_enabled_global boolean,p_assembly_install_note text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; r public.commerce_shipping_settings%rowtype; op text:='update_commerce_shipping_settings'; begin a:=private.commerce_require_actor('commerce.settings.manage'); h:=private.commerce_sha256(jsonb_build_array(p_default_shipping_charge_paise,p_free_shipping_threshold_paise,p_cod_enabled_global,p_assembly_install_note)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; update public.commerce_shipping_settings set default_shipping_charge_paise=p_default_shipping_charge_paise,free_shipping_threshold_paise=p_free_shipping_threshold_paise,cod_enabled_global=p_cod_enabled_global,assembly_install_note=p_assembly_install_note,updated_by=a where id=1 returning * into r; x=jsonb_build_object('id',r.id,'default_shipping_charge_paise',r.default_shipping_charge_paise,'cod_enabled_global',r.cod_enabled_global); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

-- Media lifecycle
create or replace function public.authorize_commerce_product_media_upload(p_product_id uuid,p_variant_id uuid,p_alt_text text,p_is_primary boolean,p_sort_order integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; m uuid:=gen_random_uuid(); op text:='authorize_commerce_product_media_upload'; begin a:=private.commerce_require_actor('commerce.catalog.manage'); h:=private.commerce_sha256(jsonb_build_array(p_product_id,p_variant_id,p_alt_text,p_is_primary,p_sort_order)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; if not exists(select 1 from public.commerce_products where id=p_product_id) or (p_variant_id is not null and not exists(select 1 from public.commerce_product_variants where id=p_variant_id and product_id=p_product_id)) then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; insert into public.commerce_product_media(id,product_id,variant_id,original_path,public_path,alt_text,is_primary,sort_order,created_by) values(m,p_product_id,p_variant_id,p_product_id::text||'/'||m::text||'/original',p_product_id::text||'/'||m::text||'/derivative.webp',coalesce(p_alt_text,''),coalesce(p_is_primary,false),coalesce(p_sort_order,0),a); x=jsonb_build_object('media_id',m,'original_path',p_product_id::text||'/'||m::text||'/original','public_path',p_product_id::text||'/'||m::text||'/derivative.webp'); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.finalize_commerce_product_media(p_media_id uuid,p_original_path text,p_public_path text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; m public.commerce_product_media%rowtype; op text:='finalize_commerce_product_media'; begin a:=private.commerce_require_actor('commerce.catalog.manage'); h:=private.commerce_sha256(jsonb_build_array(p_media_id,p_original_path,p_public_path)::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; select * into m from public.commerce_product_media where id=p_media_id for update; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; if m.original_path<>p_original_path or m.public_path<>p_public_path then raise exception 'COMMERCE_VALIDATION' using errcode='22023'; end if; if m.is_primary then update public.commerce_product_media set is_primary=false,updated_at=now() where product_id=m.product_id and id<>m.id and status='active'; end if; update public.commerce_product_media set status='active',updated_at=now() where id=m.id; x=jsonb_build_object('media_id',m.id,'status','active'); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

create or replace function public.archive_commerce_product_media(p_media_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a uuid; h text; x jsonb; op text:='archive_commerce_product_media'; begin a:=private.commerce_require_actor('commerce.catalog.manage'); h:=private.commerce_sha256(p_media_id::text); perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key); x:=private.commerce_idempotency_lookup(a,op,p_idempotency_key,h); if x is not null then return x; end if; update public.commerce_product_media set status='archived',updated_at=now() where id=p_media_id; if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if; x=jsonb_build_object('media_id',p_media_id,'status','archived'); perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x); return x; end $$;

-- RLS / storage
do $$ declare t text; begin
  foreach t in array array['commerce_categories','commerce_tax_rates','commerce_tax_settings','commerce_products','commerce_product_variants','commerce_inventory','commerce_product_media','commerce_product_specifications','commerce_related_products','commerce_pincodes','commerce_shipping_settings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.authorize(''commerce.read'')))',t||'_commerce_read',t);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('commerce-product-originals','commerce-product-originals',false,20971520,array['image/jpeg','image/png','image/webp']),
 ('commerce-product-public','commerce-product-public',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy commerce_product_originals_select on storage.objects for select to authenticated
using (bucket_id='commerce-product-originals' and (select public.authorize('commerce.catalog.manage')));

-- No authenticated insert/update/delete policies: service_role owns storage writes.

do $$
declare r record;
begin
  for r in select p.oid::regprocedure sig,n.nspname nsp from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and p.proname like '%commerce%' loop
    execute format('alter function %s owner to postgres',r.sig);
    execute format('revoke all on function %s from public, anon, authenticated',r.sig);
  end loop;
end $$;

grant execute on function public.upsert_commerce_category(uuid,text,text,uuid,text,text,text,integer,bigint,boolean,boolean,uuid) to authenticated;
grant execute on function public.set_commerce_category_status(uuid,text,uuid) to authenticated;
grant execute on function public.create_commerce_product(uuid,text,text,text,text,uuid) to authenticated;
grant execute on function public.update_commerce_product(uuid,uuid,text,text,text,text,uuid,text,bigint,boolean,boolean,text,text,boolean,integer,uuid) to authenticated;
grant execute on function public.publish_commerce_product(uuid,integer,uuid) to authenticated;
grant execute on function public.archive_commerce_product(uuid,integer,uuid) to authenticated;
grant execute on function public.upsert_commerce_product_variant(uuid,uuid,text,jsonb,text,bigint,bigint,text,integer,uuid) to authenticated;
grant execute on function public.set_commerce_variant_status(uuid,text,uuid) to authenticated;
grant execute on function public.replace_commerce_product_specifications(uuid,jsonb,uuid) to authenticated;
grant execute on function public.replace_commerce_related_products(uuid,uuid[],uuid) to authenticated;
grant execute on function public.adjust_commerce_inventory(uuid,integer,text,uuid) to authenticated;
grant execute on function public.upsert_commerce_tax_rate(uuid,text,text,integer,text,boolean,uuid) to authenticated;
grant execute on function public.update_commerce_tax_settings(boolean,boolean,uuid) to authenticated;
grant execute on function public.upsert_commerce_pincode(text,boolean,text,integer,integer,uuid) to authenticated;
grant execute on function public.update_commerce_shipping_settings(bigint,bigint,boolean,text,uuid) to authenticated;
grant execute on function public.authorize_commerce_product_media_upload(uuid,uuid,text,boolean,integer,uuid) to authenticated;
grant execute on function public.finalize_commerce_product_media(uuid,text,text,uuid) to authenticated;
grant execute on function public.archive_commerce_product_media(uuid,uuid) to authenticated;
grant execute on function public.finalize_commerce_product_media(uuid,text,text,uuid) to service_role;

revoke all on sequence private.commerce_product_reference_seq, private.commerce_category_reference_seq from public,anon,authenticated;
revoke all on table private.commerce_idempotency_requests from public,anon,authenticated;
