-- ONEDECORE Phase 9D-D1 / conceptual M37
-- commerce_order_cod_checkout_foundation
-- COD order engine, immutable snapshots, guest tracking primitives,
-- hashed public rate-limit ledger. No payment tables. No UI.

-- ---------------------------------------------------------------------------
-- Sequences and private ledgers
-- ---------------------------------------------------------------------------

create sequence private.commerce_order_reference_seq as bigint start with 1 increment by 1;

create table private.commerce_public_idempotency_requests (
  operation text not null
    constraint chk_commerce_public_idemp_operation check (char_length(operation) between 1 and 64),
  idempotency_key uuid not null,
  request_hash text not null
    constraint chk_commerce_public_idemp_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  response_snapshot jsonb
    constraint chk_commerce_public_idemp_snapshot check (
      response_snapshot is null
      or (
        jsonb_typeof(response_snapshot) = 'object'
        and octet_length(response_snapshot::text) <= 8192
      )
    ),
  created_at timestamptz not null default now(),
  primary key (operation, idempotency_key)
);

create table private.commerce_public_request_attempts (
  id bigint generated always as identity primary key,
  operation text not null
    constraint chk_commerce_public_attempt_operation check (operation in ('quote', 'checkout', 'track')),
  network_fingerprint_hash text not null
    constraint chk_commerce_public_attempt_net check (network_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  phone_fingerprint_hash text
    constraint chk_commerce_public_attempt_phone check (
      phone_fingerprint_hash is null or phone_fingerprint_hash ~ '^[0-9a-f]{64}$'
    ),
  created_at timestamptz not null default now()
);

create index commerce_public_request_attempts_net_idx
  on private.commerce_public_request_attempts (operation, network_fingerprint_hash, created_at desc);
create index commerce_public_request_attempts_phone_idx
  on private.commerce_public_request_attempts (operation, phone_fingerprint_hash, created_at desc)
  where phone_fingerprint_hash is not null;

revoke all on sequence private.commerce_order_reference_seq from public, anon, authenticated;
revoke all on table private.commerce_public_idempotency_requests from public, anon, authenticated;
revoke all on table private.commerce_public_request_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public order tables
-- ---------------------------------------------------------------------------

create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique
    constraint chk_commerce_orders_reference check (order_reference ~ '^OD-O-[0-9]{4}-[0-9]{6}$'),
  contact_id uuid references public.contacts(id) on delete restrict,
  status text not null
    constraint chk_commerce_orders_status check (status in (
      'pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'payment_failed', 'cancelled'
    )),
  payment_method text not null
    constraint chk_commerce_orders_payment_method check (payment_method in ('cod', 'online')),
  currency text not null default 'INR'
    constraint chk_commerce_orders_currency check (currency = 'INR'),
  customer_name text not null,
  customer_mobile_e164 text not null
    constraint chk_commerce_orders_mobile check (customer_mobile_e164 ~ '^\+91[6-9][0-9]{9}$'),
  customer_email text,
  subtotal_paise bigint not null
    constraint chk_commerce_orders_subtotal check (subtotal_paise >= 0),
  discount_paise bigint not null default 0
    constraint chk_commerce_orders_discount check (discount_paise >= 0),
  tax_paise bigint not null
    constraint chk_commerce_orders_tax check (tax_paise >= 0),
  shipping_paise bigint not null
    constraint chk_commerce_orders_shipping check (shipping_paise >= 0),
  total_paise bigint not null
    constraint chk_commerce_orders_total check (total_paise >= 0 and total_paise = subtotal_paise + shipping_paise),
  inventory_hold_expires_at timestamptz,
  cancellation_reason_code text,
  fulfilment_tracking_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  processing_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create table public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  line_number integer not null
    constraint chk_commerce_order_items_line check (line_number between 1 and 20),
  product_id uuid not null references public.commerce_products(id) on delete restrict,
  variant_id uuid not null references public.commerce_product_variants(id) on delete restrict,
  product_reference text not null,
  product_name text not null,
  product_slug text not null,
  sku text not null,
  variant_display_name text,
  option_values jsonb not null default '{}'::jsonb
    constraint chk_commerce_order_items_options check (
      private.commerce_option_values_valid(option_values)
      and pg_column_size(option_values) <= 1024
    ),
  primary_image_public_path text,
  compare_at_unit_price_paise bigint
    constraint chk_commerce_order_items_compare check (
      compare_at_unit_price_paise is null or compare_at_unit_price_paise >= 0
    ),
  selling_unit_price_paise bigint not null
    constraint chk_commerce_order_items_selling check (selling_unit_price_paise >= 0),
  discount_paise bigint not null default 0
    constraint chk_commerce_order_items_discount check (discount_paise >= 0),
  tax_rate_code text not null,
  tax_rate_basis_points integer not null
    constraint chk_commerce_order_items_tax_bp check (tax_rate_basis_points between 0 and 10000),
  hsn_sac_code text,
  taxable_paise bigint not null
    constraint chk_commerce_order_items_taxable check (taxable_paise >= 0),
  tax_paise bigint not null
    constraint chk_commerce_order_items_tax check (tax_paise >= 0),
  quantity integer not null
    constraint chk_commerce_order_items_qty check (quantity between 1 and 20),
  line_total_paise bigint not null
    constraint chk_commerce_order_items_line_total check (line_total_paise >= 0),
  availability_mode text not null
    constraint chk_commerce_order_items_mode check (availability_mode in ('ready_stock', 'made_to_order')),
  created_at timestamptz not null default now(),
  unique (order_id, line_number)
);

create table public.commerce_order_delivery (
  order_id uuid primary key references public.commerce_orders(id) on delete restrict,
  recipient_name text not null,
  mobile_e164 text not null
    constraint chk_commerce_order_delivery_mobile check (mobile_e164 ~ '^\+91[6-9][0-9]{9}$'),
  email text,
  address_line_1 text not null,
  address_line_2 text,
  locality text not null,
  city text not null,
  state text not null,
  pincode text not null
    constraint chk_commerce_order_delivery_pincode check (pincode ~ '^[0-9]{6}$'),
  serviceable_snapshot boolean not null
    constraint chk_commerce_order_delivery_serviceable check (serviceable_snapshot is true),
  shipping_charge_paise bigint not null
    constraint chk_commerce_order_delivery_ship check (shipping_charge_paise >= 0),
  eta_min_days integer not null,
  eta_max_days integer not null,
  assembly_install_note text,
  created_at timestamptz not null default now(),
  constraint chk_commerce_order_delivery_eta check (
    eta_min_days >= 0 and eta_max_days >= eta_min_days
  )
);

create table public.commerce_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id) on delete restrict,
  event_code text not null
    constraint chk_commerce_order_events_code check (event_code in (
      'order_confirmed_cod',
      'processing_started',
      'order_shipped',
      'order_delivered',
      'order_cancelled',
      'inventory_restocked_on_cancel'
    )),
  from_status text,
  to_status text,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  actor_kind text not null
    constraint chk_commerce_order_events_actor check (actor_kind in ('system', 'guest', 'staff')),
  metadata jsonb not null default '{}'::jsonb
    constraint chk_commerce_order_events_metadata check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 2048
    ),
  created_at timestamptz not null default now()
);

create index commerce_orders_status_idx on public.commerce_orders (status, created_at desc);
create index commerce_order_items_order_idx on public.commerce_order_items (order_id, line_number);
create index commerce_order_events_order_idx on public.commerce_order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Immutability / restricted mutation
-- ---------------------------------------------------------------------------

create or replace function private.commerce_forbid_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'COMMERCE_ORDER_VALIDATION' using errcode = '22023';
end;
$$;

create or replace function private.commerce_forbid_row_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'COMMERCE_ORDER_VALIDATION' using errcode = '22023';
end;
$$;

create or replace function private.commerce_orders_restrict_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.order_reference is distinct from old.order_reference
     or new.contact_id is distinct from old.contact_id
     or new.payment_method is distinct from old.payment_method
     or new.currency is distinct from old.currency
     or new.customer_name is distinct from old.customer_name
     or new.customer_mobile_e164 is distinct from old.customer_mobile_e164
     or new.customer_email is distinct from old.customer_email
     or new.subtotal_paise is distinct from old.subtotal_paise
     or new.discount_paise is distinct from old.discount_paise
     or new.tax_paise is distinct from old.tax_paise
     or new.shipping_paise is distinct from old.shipping_paise
     or new.total_paise is distinct from old.total_paise
     or new.created_at is distinct from old.created_at
     or new.confirmed_at is distinct from old.confirmed_at and old.confirmed_at is not null
  then
    raise exception 'COMMERCE_ORDER_VALIDATION' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger trg_commerce_orders_no_delete
  before delete on public.commerce_orders
  for each row execute function private.commerce_forbid_hard_delete();
create trigger trg_commerce_orders_restrict_update
  before update on public.commerce_orders
  for each row execute function private.commerce_orders_restrict_update();
create trigger trg_commerce_orders_updated_at
  before update on public.commerce_orders
  for each row execute function private.set_updated_at();

create trigger trg_commerce_order_items_immutable
  before update or delete on public.commerce_order_items
  for each row execute function private.commerce_forbid_row_mutation();
create trigger trg_commerce_order_delivery_immutable
  before update or delete on public.commerce_order_delivery
  for each row execute function private.commerce_forbid_row_mutation();
create trigger trg_commerce_order_events_immutable
  before update or delete on public.commerce_order_events
  for each row execute function private.commerce_forbid_row_mutation();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.commerce_order_raise(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_code = 'COMMERCE_UNAUTHORIZED' then
    raise exception 'COMMERCE_UNAUTHORIZED' using errcode = '42501';
  end if;
  raise exception '%', p_code using errcode = '22023';
end;
$$;

create or replace function private.commerce_inclusive_tax_paise(p_gross_paise bigint, p_rate_basis_points integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_gross_paise, 0) <= 0 or coalesce(p_rate_basis_points, 0) <= 0 then 0
    else round(
      (p_gross_paise::numeric * p_rate_basis_points::numeric)
      / (10000::numeric + p_rate_basis_points::numeric)
    )::bigint
  end;
$$;

create or replace function private.generate_commerce_order_reference()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return 'OD-O-'
    || to_char((now() at time zone 'Asia/Kolkata'), 'YYYY')
    || '-'
    || lpad(nextval('private.commerce_order_reference_seq')::text, 6, '0');
end;
$$;

create or replace function private.commerce_public_plain_text(p_value text, p_min integer, p_max integer)
returns text
language plpgsql
set search_path = ''
as $$
declare v text := trim(coalesce(p_value, ''));
begin
  if char_length(v) < p_min or char_length(v) > p_max then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  if v ~ '[[:cntrl:]]' or v ~ '[<>]' then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  return v;
end;
$$;

create or replace function private.commerce_public_normalize_mobile(p_value text)
returns text
language plpgsql
set search_path = ''
as $$
declare v text := trim(coalesce(p_value, ''));
begin
  if v ~ '^[6-9][0-9]{9}$' then
    v := '+91' || v;
  end if;
  if v !~ '^\+91[6-9][0-9]{9}$' then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  return v;
end;
$$;

create or replace function private.commerce_public_normalize_email(p_value text)
returns text
language plpgsql
set search_path = ''
as $$
declare v text := nullif(lower(trim(coalesce(p_value, ''))), '');
begin
  if v is null then
    return null;
  end if;
  if char_length(v) > 120 or v !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  return v;
end;
$$;

create or replace function private.commerce_public_idempotency_xact_lock(p_operation text, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock((
    'x' || substr(
      private.commerce_sha256(coalesce(p_operation, '') || '|' || coalesce(p_idempotency_key::text, '')),
      1,
      16
    )
  )::bit(64)::bigint);
end;
$$;

create or replace function private.commerce_public_idempotency_lookup(
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r private.commerce_public_idempotency_requests%rowtype;
begin
  select * into r
  from private.commerce_public_idempotency_requests
  where operation = p_operation and idempotency_key = p_idempotency_key;
  if not found then
    return null;
  end if;
  if r.request_hash is distinct from p_request_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
  end if;
  return r.response_snapshot;
end;
$$;

create or replace function private.commerce_public_idempotency_store(
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text,
  p_response jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.commerce_public_idempotency_requests(
    operation, idempotency_key, request_hash, response_snapshot
  ) values ($1, $2, $3, $4);
$$;

-- Shipping / COD precedence (documented):
-- charge: product.shipping_charge_paise_override
--      -> category.shipping_charge_paise_override
--      -> commerce_shipping_settings.default_shipping_charge_paise
-- free-ship eligibility: product.free_shipping_eligible_override
--      -> category.free_shipping_eligible_override
--      -> (threshold is not null AND merchandise subtotal >= threshold)
-- No parent-category inheritance.
-- COD: settings.cod_enabled_global AND coalesce(product.cod_allowed_override, category.cod_allowed_override, true)

create or replace function private.commerce_resolve_shipping_charge_paise(
  p_product_override bigint,
  p_category_override bigint,
  p_default_charge bigint,
  p_product_free boolean,
  p_category_free boolean,
  p_threshold bigint,
  p_subtotal_paise bigint
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(
      p_product_free,
      p_category_free,
      (p_threshold is not null and p_subtotal_paise >= p_threshold)
    ) then 0
    else coalesce(p_product_override, p_category_override, coalesce(p_default_charge, 0))
  end;
$$;

create or replace function private.commerce_build_quote(p_lines jsonb, p_pincode text, p_require_cod boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.commerce_shipping_settings%rowtype;
  tax_settings public.commerce_tax_settings%rowtype;
  pin public.commerce_pincodes%rowtype;
  elem jsonb;
  line_sku text;
  qty integer;
  seen text[] := array[]::text[];
  line_no integer := 0;
  v public.commerce_product_variants%rowtype;
  p public.commerce_products%rowtype;
  cat public.commerce_categories%rowtype;
  tax public.commerce_tax_rates%rowtype;
  inv public.commerce_inventory%rowtype;
  img text;
  line_gross bigint;
  line_tax bigint;
  line_discount bigint;
  can_fulfil boolean;
  lines jsonb := '[]'::jsonb;
  subtotal bigint := 0;
  discount_total bigint := 0;
  tax_total bigint := 0;
  shipping bigint := 0;
  line_charge bigint;
  max_charge bigint := 0;
  all_free_ok boolean := true;
  any_explicit_free boolean := false;
  line_free boolean;
  cod_line boolean;
  cod_allowed boolean;
  assembly text;
begin
  if jsonb_typeof(coalesce(p_lines, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_lines) < 1
     or jsonb_array_length(p_lines) > 20 then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  if p_pincode is null or p_pincode !~ '^[0-9]{6}$' then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;

  select * into settings from public.commerce_shipping_settings where id = 1;
  select * into tax_settings from public.commerce_tax_settings where id = 1;
  select * into pin from public.commerce_pincodes where pincode = p_pincode;
  if not found or pin.serviceable is not true then
    perform private.commerce_order_raise('COMMERCE_ORDER_NOT_SERVICEABLE');
  end if;

  assembly := settings.assembly_install_note;
  cod_allowed := coalesce(settings.cod_enabled_global, false);

  for elem in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(elem) <> 'object' then
      perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
    end if;
    line_sku := lower(trim(coalesce(elem->>'sku', '')));
    begin
      qty := (elem->>'quantity')::integer;
    exception when others then
      perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
    end;
    if line_sku = '' or line_sku !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or qty is null or qty < 1 or qty > 20 then
      perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
    end if;
    if line_sku = any(seen) then
      perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
    end if;
    seen := array_append(seen, line_sku);
    line_no := line_no + 1;

    select * into v from public.commerce_product_variants where commerce_product_variants.sku = line_sku and status = 'active';
    if not found then
      perform private.commerce_order_raise('COMMERCE_ORDER_UNAVAILABLE');
    end if;
    select * into p from public.commerce_products where id = v.product_id;
    if not found or p.status <> 'published' or not private.commerce_public_category_visible(p.category_id) then
      perform private.commerce_order_raise('COMMERCE_ORDER_UNAVAILABLE');
    end if;
    select * into cat from public.commerce_categories where id = p.category_id;
    select * into tax from public.commerce_tax_rates where id = p.tax_rate_id and is_active;
    if tax_settings.tax_required_for_publish and not found then
      perform private.commerce_order_raise('COMMERCE_ORDER_UNAVAILABLE');
    end if;
    if not found then
      perform private.commerce_order_raise('COMMERCE_ORDER_UNAVAILABLE');
    end if;
    select * into inv from public.commerce_inventory where variant_id = v.id;
    can_fulfil := case
      when v.availability_mode = 'made_to_order' then true
      else coalesce(inv.available_qty, 0) >= qty
    end;

    select m.public_path into img
    from public.commerce_product_media m
    where m.product_id = p.id
      and private.commerce_public_media_visible(m.product_id, m.variant_id, m.status, m.public_path)
    order by m.is_primary desc, m.sort_order asc, m.created_at asc
    limit 1;

    line_gross := v.selling_price_paise * qty;
    line_tax := private.commerce_inclusive_tax_paise(line_gross, tax.rate_basis_points);
    line_discount := case
      when v.compare_at_price_paise is not null and v.compare_at_price_paise > v.selling_price_paise
        then (v.compare_at_price_paise - v.selling_price_paise) * qty
      else 0
    end;
    subtotal := subtotal + line_gross;
    tax_total := tax_total + line_tax;
    discount_total := discount_total + line_discount;

    line_charge := coalesce(
      p.shipping_charge_paise_override,
      cat.shipping_charge_paise_override,
      settings.default_shipping_charge_paise,
      0
    );
    if line_charge > max_charge then
      max_charge := line_charge;
    end if;
    line_free := coalesce(p.free_shipping_eligible_override, cat.free_shipping_eligible_override);
    if line_free is false then
      all_free_ok := false;
    end if;
    if line_free is true then
      any_explicit_free := true;
    end if;

    cod_line := coalesce(settings.cod_enabled_global, false)
      and coalesce(p.cod_allowed_override, cat.cod_allowed_override, true);
    if not cod_line then
      cod_allowed := false;
    end if;

    lines := lines || jsonb_build_array(jsonb_build_object(
      'line_number', line_no,
      'sku', v.sku,
      'quantity', qty,
      'product_id', p.id,
      'variant_id', v.id,
      'product_reference', p.product_reference,
      'product_name', p.name,
      'product_slug', p.slug,
      'variant_display_name', v.display_name,
      'option_values', v.option_values,
      'primary_image_public_path', img,
      'selling_unit_price_paise', v.selling_price_paise,
      'compare_at_unit_price_paise', case
        when v.compare_at_price_paise is not null and v.compare_at_price_paise > v.selling_price_paise
          then v.compare_at_price_paise
        else null
      end,
      'discount_paise', line_discount,
      'tax_rate_code', tax.code,
      'tax_rate_basis_points', tax.rate_basis_points,
      'hsn_sac_code', p.hsn_sac_code,
      'taxable_paise', line_gross - line_tax,
      'tax_paise', line_tax,
      'line_total_paise', line_gross,
      'availability_mode', v.availability_mode,
      'can_fulfil', can_fulfil
    ));
  end loop;

  -- Charge: max(product override -> category override -> global default) across lines.
  -- Free-ship: blocked if any line override is false; otherwise explicit true
  -- or (all overrides null and merchandise subtotal meets threshold).
  shipping := case
    when all_free_ok and (
      any_explicit_free
      or (
        settings.free_shipping_threshold_paise is not null
        and subtotal >= settings.free_shipping_threshold_paise
      )
    ) then 0
    else max_charge
  end;

  if p_require_cod and not cod_allowed then
    perform private.commerce_order_raise('COMMERCE_COD_UNAVAILABLE');
  end if;

  return jsonb_build_object(
    'lines', lines,
    'subtotal_paise', subtotal,
    'discount_paise', discount_total,
    'tax_paise', tax_total,
    'shipping_paise', shipping,
    'total_paise', subtotal + shipping,
    'pincode', pin.pincode,
    'serviceable', true,
    'eta_min_days', pin.eta_min_days,
    'eta_max_days', pin.eta_max_days,
    'assembly_install_note', assembly,
    'cod_allowed', cod_allowed
  );
end;
$$;

create or replace function private.commerce_public_quote_view(p_quote jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'lines', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'sku', e.value->>'sku',
          'quantity', (e.value->>'quantity')::integer,
          'product_name', e.value->>'product_name',
          'product_slug', e.value->>'product_slug',
          'variant_display_name', e.value->>'variant_display_name',
          'option_values', e.value->'option_values',
          'primary_image_public_path', e.value->>'primary_image_public_path',
          'selling_unit_price_paise', (e.value->>'selling_unit_price_paise')::bigint,
          'compare_at_unit_price_paise', nullif(e.value->>'compare_at_unit_price_paise','')::bigint,
          'discount_paise', (e.value->>'discount_paise')::bigint,
          'line_total_paise', (e.value->>'line_total_paise')::bigint,
          'tax_paise', (e.value->>'tax_paise')::bigint,
          'availability_mode', e.value->>'availability_mode',
          'can_fulfil', (e.value->>'can_fulfil')::boolean
        )
        order by (e.value->>'line_number')::integer
      )
      from jsonb_array_elements(p_quote->'lines') e
    ), '[]'::jsonb),
    'subtotal_paise', (p_quote->>'subtotal_paise')::bigint,
    'discount_paise', (p_quote->>'discount_paise')::bigint,
    'tax_paise', (p_quote->>'tax_paise')::bigint,
    'shipping_paise', (p_quote->>'shipping_paise')::bigint,
    'total_paise', (p_quote->>'total_paise')::bigint,
    'pincode', p_quote->>'pincode',
    'serviceable', true,
    'eta_min_days', (p_quote->>'eta_min_days')::integer,
    'eta_max_days', (p_quote->>'eta_max_days')::integer,
    'assembly_install_note', p_quote->>'assembly_install_note',
    'cod_allowed', (p_quote->>'cod_allowed')::boolean
  );
$$;

-- ---------------------------------------------------------------------------
-- Public / staff RPCs
-- ---------------------------------------------------------------------------

create or replace function public.quote_public_commerce_cart(
  p_lines jsonb,
  p_pincode text,
  p_payment_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q jsonb;
  require_cod boolean := false;
begin
  if p_payment_method is not null and p_payment_method not in ('cod', 'online') then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  require_cod := p_payment_method = 'cod';
  q := private.commerce_build_quote(p_lines, p_pincode, require_cod);
  return private.commerce_public_quote_view(q);
end;
$$;

create or replace function public.create_public_commerce_cod_order(
  p_lines jsonb,
  p_customer jsonb,
  p_delivery jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  op text := 'create_public_commerce_cod_order';
  request_hash text;
  replay jsonb;
  q jsonb;
  line jsonb;
  cust_name text;
  cust_mobile text;
  cust_email text;
  rec_name text;
  rec_mobile text;
  rec_email text;
  addr1 text;
  addr2 text;
  locality text;
  city text;
  state text;
  pincode text;
  order_row public.commerce_orders%rowtype;
  locked_variant_id uuid;
  qty integer;
  mode text;
  inv public.commerce_inventory%rowtype;
  safe jsonb;
begin
  if p_idempotency_key is null or jsonb_typeof(coalesce(p_customer, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_delivery, 'null'::jsonb)) <> 'object' then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;

  cust_name := private.commerce_public_plain_text(p_customer->>'name', 2, 80);
  cust_mobile := private.commerce_public_normalize_mobile(p_customer->>'mobile');
  cust_email := private.commerce_public_normalize_email(p_customer->>'email');
  rec_name := private.commerce_public_plain_text(p_delivery->>'recipient_name', 2, 80);
  rec_mobile := private.commerce_public_normalize_mobile(p_delivery->>'mobile');
  rec_email := private.commerce_public_normalize_email(p_delivery->>'email');
  addr1 := private.commerce_public_plain_text(p_delivery->>'address_line_1', 5, 200);
  if coalesce(trim(p_delivery->>'address_line_2'), '') = '' then
    addr2 := null;
  else
    addr2 := private.commerce_public_plain_text(p_delivery->>'address_line_2', 1, 200);
  end if;
  locality := private.commerce_public_plain_text(p_delivery->>'locality', 2, 80);
  city := private.commerce_public_plain_text(p_delivery->>'city', 2, 80);
  state := private.commerce_public_plain_text(p_delivery->>'state', 2, 80);
  pincode := trim(coalesce(p_delivery->>'pincode', ''));
  if pincode !~ '^[0-9]{6}$' then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;

  request_hash := private.commerce_sha256(
    jsonb_build_array(p_lines, cust_name, cust_mobile, cust_email, rec_name, rec_mobile, rec_email, addr1, addr2, locality, city, state, pincode)::text
  );
  perform private.commerce_public_idempotency_xact_lock(op, p_idempotency_key);
  replay := private.commerce_public_idempotency_lookup(op, p_idempotency_key, request_hash);
  if replay is not null then
    return replay;
  end if;

  q := private.commerce_build_quote(p_lines, pincode, true);
  if exists (
    select 1 from jsonb_array_elements(q->'lines') e where (e->>'can_fulfil')::boolean is not true
  ) then
    perform private.commerce_order_raise('COMMERCE_INVENTORY_UNAVAILABLE');
  end if;

  for line in
    select value
    from jsonb_array_elements(q->'lines')
    order by (value->>'variant_id')
  loop
    locked_variant_id := (line->>'variant_id')::uuid;
    qty := (line->>'quantity')::integer;
    mode := line->>'availability_mode';
    if mode = 'ready_stock' then
      select * into inv from public.commerce_inventory where commerce_inventory.variant_id = locked_variant_id for update;
      if not found or inv.available_qty < qty then
        perform private.commerce_order_raise('COMMERCE_INVENTORY_UNAVAILABLE');
      end if;
      update public.commerce_inventory
         set stock_on_hand = stock_on_hand - qty,
             updated_at = now()
       where commerce_inventory.variant_id = locked_variant_id;
    end if;
  end loop;

  insert into public.commerce_orders (
    order_reference, contact_id, status, payment_method, currency,
    customer_name, customer_mobile_e164, customer_email,
    subtotal_paise, discount_paise, tax_paise, shipping_paise, total_paise,
    confirmed_at
  ) values (
    private.generate_commerce_order_reference(),
    null,
    'confirmed',
    'cod',
    'INR',
    cust_name, cust_mobile, cust_email,
    (q->>'subtotal_paise')::bigint,
    (q->>'discount_paise')::bigint,
    (q->>'tax_paise')::bigint,
    (q->>'shipping_paise')::bigint,
    (q->>'total_paise')::bigint,
    now()
  ) returning * into order_row;

  insert into public.commerce_order_items (
    order_id, line_number, product_id, variant_id, product_reference, product_name, product_slug,
    sku, variant_display_name, option_values, primary_image_public_path,
    compare_at_unit_price_paise, selling_unit_price_paise, discount_paise,
    tax_rate_code, tax_rate_basis_points, hsn_sac_code, taxable_paise, tax_paise,
    quantity, line_total_paise, availability_mode
  )
  select
    order_row.id,
    (e->>'line_number')::integer,
    (e->>'product_id')::uuid,
    (e->>'variant_id')::uuid,
    e->>'product_reference',
    e->>'product_name',
    e->>'product_slug',
    e->>'sku',
    e->>'variant_display_name',
    coalesce(e->'option_values', '{}'::jsonb),
    e->>'primary_image_public_path',
    nullif(e->>'compare_at_unit_price_paise', '')::bigint,
    (e->>'selling_unit_price_paise')::bigint,
    (e->>'discount_paise')::bigint,
    e->>'tax_rate_code',
    (e->>'tax_rate_basis_points')::integer,
    e->>'hsn_sac_code',
    (e->>'taxable_paise')::bigint,
    (e->>'tax_paise')::bigint,
    (e->>'quantity')::integer,
    (e->>'line_total_paise')::bigint,
    e->>'availability_mode'
  from jsonb_array_elements(q->'lines') e;

  insert into public.commerce_order_delivery (
    order_id, recipient_name, mobile_e164, email, address_line_1, address_line_2,
    locality, city, state, pincode, serviceable_snapshot, shipping_charge_paise,
    eta_min_days, eta_max_days, assembly_install_note
  ) values (
    order_row.id, rec_name, rec_mobile, rec_email, addr1, addr2,
    locality, city, state, pincode, true, (q->>'shipping_paise')::bigint,
    (q->>'eta_min_days')::integer, (q->>'eta_max_days')::integer,
    q->>'assembly_install_note'
  );

  insert into public.commerce_order_events (
    order_id, event_code, from_status, to_status, actor_profile_id, actor_kind, metadata
  ) values (
    order_row.id, 'order_confirmed_cod', null, 'confirmed', null, 'guest', '{}'::jsonb
  );

  safe := jsonb_build_object(
    'order_reference', order_row.order_reference,
    'status', order_row.status,
    'total_paise', order_row.total_paise
  );
  perform private.commerce_public_idempotency_store(op, p_idempotency_key, request_hash, safe);
  return safe;
end;
$$;

create or replace function public.verify_public_commerce_order_tracking_identity(
  p_order_reference text,
  p_mobile_e164 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched boolean := false;
  mobile text;
begin
  begin
    mobile := private.commerce_public_normalize_mobile(p_mobile_e164);
  exception when others then
    return jsonb_build_object('matched', false);
  end;
  select exists (
    select 1
    from public.commerce_orders o
    where o.order_reference = trim(coalesce(p_order_reference, ''))
      and o.customer_mobile_e164 = mobile
  ) into matched;
  return jsonb_build_object('matched', matched);
end;
$$;

create or replace function public.get_public_commerce_order_tracking_snapshot(p_order_reference text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.commerce_orders%rowtype;
  d public.commerce_order_delivery%rowtype;
begin
  select * into o from public.commerce_orders where order_reference = trim(coalesce(p_order_reference, ''));
  if not found then
    perform private.commerce_order_raise('COMMERCE_ORDER_NOT_FOUND');
  end if;
  select * into d from public.commerce_order_delivery where order_id = o.id;
  return jsonb_build_object(
    'order_reference', o.order_reference,
    'status', o.status,
    'payment_method', o.payment_method,
    'currency', o.currency,
    'created_at', o.created_at,
    'confirmed_at', o.confirmed_at,
    'processing_at', o.processing_at,
    'shipped_at', o.shipped_at,
    'delivered_at', o.delivered_at,
    'cancelled_at', o.cancelled_at,
    'subtotal_paise', o.subtotal_paise,
    'discount_paise', o.discount_paise,
    'tax_paise', o.tax_paise,
    'shipping_paise', o.shipping_paise,
    'total_paise', o.total_paise,
    'fulfilment_tracking_reference', o.fulfilment_tracking_reference,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'line_number', i.line_number,
        'product_name', i.product_name,
        'product_slug', i.product_slug,
        'sku', i.sku,
        'variant_display_name', i.variant_display_name,
        'quantity', i.quantity,
        'selling_unit_price_paise', i.selling_unit_price_paise,
        'line_total_paise', i.line_total_paise,
        'availability_mode', i.availability_mode,
        'primary_image_public_path', i.primary_image_public_path
      ) order by i.line_number)
      from public.commerce_order_items i
      where i.order_id = o.id
    ), '[]'::jsonb),
    'delivery', jsonb_build_object(
      'recipient_name', d.recipient_name,
      'mobile_e164', d.mobile_e164,
      'email', d.email,
      'address_line_1', d.address_line_1,
      'address_line_2', d.address_line_2,
      'locality', d.locality,
      'city', d.city,
      'state', d.state,
      'pincode', d.pincode,
      'shipping_charge_paise', d.shipping_charge_paise,
      'eta_min_days', d.eta_min_days,
      'eta_max_days', d.eta_max_days,
      'assembly_install_note', d.assembly_install_note
    )
  );
end;
$$;

create or replace function private.commerce_public_rate_limit_xact_lock(
  p_scope text,
  p_operation text,
  p_fingerprint_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope not in ('network', 'phone')
     or p_operation is null
     or p_fingerprint_hash is null
  then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  perform pg_advisory_xact_lock((
    'x' || substr(
      private.commerce_sha256(
        'commerce-rate-limit|' || p_scope || '|' || p_operation || '|' || p_fingerprint_hash
      ),
      1,
      16
    )
  )::bit(64)::bigint);
end;
$$;

create or replace function public.consume_commerce_public_rate_limit(
  p_operation text,
  p_network_fingerprint_hash text,
  p_phone_fingerprint_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  net_limit integer;
  phone_limit integer;
  net_count integer;
  phone_count integer;
  oldest timestamptz;
  retry integer := 0;
begin
  if p_operation not in ('quote', 'checkout', 'track')
     or p_network_fingerprint_hash is null
     or p_network_fingerprint_hash !~ '^[0-9a-f]{64}$'
     or (
       p_phone_fingerprint_hash is not null
       and p_phone_fingerprint_hash !~ '^[0-9a-f]{64}$'
     )
  then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  if p_operation = 'checkout' and p_phone_fingerprint_hash is null then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;

  perform private.commerce_public_rate_limit_xact_lock(
    'network', p_operation, p_network_fingerprint_hash
  );
  if p_phone_fingerprint_hash is not null then
    perform private.commerce_public_rate_limit_xact_lock(
      'phone', p_operation, p_phone_fingerprint_hash
    );
  end if;

  net_limit := case p_operation when 'quote' then 60 when 'checkout' then 8 else 20 end;
  phone_limit := case p_operation when 'quote' then 60 when 'checkout' then 5 else 8 end;

  select count(*)::integer, min(created_at)
    into net_count, oldest
  from private.commerce_public_request_attempts
  where operation = p_operation
    and network_fingerprint_hash = p_network_fingerprint_hash
    and created_at >= now() - interval '15 minutes';

  if net_count >= net_limit then
    retry := greatest(1, ceil(extract(epoch from ((oldest + interval '15 minutes') - now())))::integer);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', retry);
  end if;

  if p_phone_fingerprint_hash is not null then
    select count(*)::integer, min(created_at)
      into phone_count, oldest
    from private.commerce_public_request_attempts
    where operation = p_operation
      and phone_fingerprint_hash = p_phone_fingerprint_hash
      and created_at >= now() - interval '15 minutes';
    if phone_count >= phone_limit then
      retry := greatest(1, ceil(extract(epoch from ((oldest + interval '15 minutes') - now())))::integer);
      return jsonb_build_object('allowed', false, 'retry_after_seconds', retry);
    end if;
  end if;

  insert into private.commerce_public_request_attempts(
    operation, network_fingerprint_hash, phone_fingerprint_hash
  ) values (p_operation, p_network_fingerprint_hash, p_phone_fingerprint_hash);

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

create or replace function public.transition_commerce_order_fulfilment(
  p_order_id uuid,
  p_to_status text,
  p_fulfilment_tracking_reference text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid;
  h text;
  x jsonb;
  o public.commerce_orders%rowtype;
  op text := 'transition_commerce_order_fulfilment';
  tracking text;
  event_code text;
begin
  a := private.commerce_require_actor('commerce.orders.manage');
  if p_idempotency_key is null or p_to_status not in ('processing', 'shipped', 'delivered') then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  tracking := nullif(trim(coalesce(p_fulfilment_tracking_reference, '')), '');
  if tracking is not null then
    tracking := private.commerce_public_plain_text(tracking, 1, 80);
  end if;
  h := private.commerce_sha256(jsonb_build_array(p_order_id, p_to_status, tracking)::text);
  perform private.commerce_idempotency_xact_lock(a, op, p_idempotency_key);
  x := private.commerce_idempotency_lookup(a, op, p_idempotency_key, h);
  if x is not null then
    return x;
  end if;

  select * into o from public.commerce_orders where id = p_order_id for update;
  if not found then
    perform private.commerce_order_raise('COMMERCE_ORDER_NOT_FOUND');
  end if;
  if o.payment_method <> 'cod' then
    perform private.commerce_order_raise('COMMERCE_ORDER_TRANSITION_INVALID');
  end if;
  if not (
    (o.status = 'confirmed' and p_to_status = 'processing')
    or (o.status = 'processing' and p_to_status = 'shipped')
    or (o.status = 'shipped' and p_to_status = 'delivered')
  ) then
    perform private.commerce_order_raise('COMMERCE_ORDER_TRANSITION_INVALID');
  end if;

  if p_to_status = 'processing' then
    update public.commerce_orders
       set status = 'processing', processing_at = now()
     where id = o.id;
    event_code := 'processing_started';
  elsif p_to_status = 'shipped' then
    update public.commerce_orders
       set status = 'shipped',
           shipped_at = now(),
           fulfilment_tracking_reference = coalesce(tracking, fulfilment_tracking_reference)
     where id = o.id;
    event_code := 'order_shipped';
  else
    update public.commerce_orders
       set status = 'delivered', delivered_at = now()
     where id = o.id;
    event_code := 'order_delivered';
  end if;

  insert into public.commerce_order_events(
    order_id, event_code, from_status, to_status, actor_profile_id, actor_kind, metadata
  ) values (
    o.id, event_code, o.status, p_to_status, a, 'staff',
    case when tracking is null then '{}'::jsonb else jsonb_build_object('has_tracking_ref', true) end
  );

  x := jsonb_build_object('id', o.id, 'status', p_to_status);
  perform private.commerce_idempotency_store(a, op, p_idempotency_key, h, x);
  return x;
end;
$$;

create or replace function public.cancel_commerce_order(
  p_order_id uuid,
  p_reason_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid;
  h text;
  x jsonb;
  o public.commerce_orders%rowtype;
  op text := 'cancel_commerce_order';
  reason text;
  item public.commerce_order_items%rowtype;
  restocked integer := 0;
begin
  a := private.commerce_require_actor('commerce.orders.manage');
  reason := trim(coalesce(p_reason_code, ''));
  if p_idempotency_key is null or reason not in ('customer_request', 'out_of_stock', 'fraud_review', 'other') then
    perform private.commerce_order_raise('COMMERCE_ORDER_VALIDATION');
  end if;
  h := private.commerce_sha256(jsonb_build_array(p_order_id, reason)::text);
  perform private.commerce_idempotency_xact_lock(a, op, p_idempotency_key);
  x := private.commerce_idempotency_lookup(a, op, p_idempotency_key, h);
  if x is not null then
    return x;
  end if;

  select * into o from public.commerce_orders where id = p_order_id for update;
  if not found then
    perform private.commerce_order_raise('COMMERCE_ORDER_NOT_FOUND');
  end if;
  if o.status not in ('confirmed', 'processing') then
    perform private.commerce_order_raise('COMMERCE_ORDER_TRANSITION_INVALID');
  end if;

  for item in
    select * from public.commerce_order_items
    where order_id = o.id
    order by variant_id, line_number
  loop
    if item.availability_mode = 'ready_stock' then
      perform 1 from public.commerce_inventory where commerce_inventory.variant_id = item.variant_id for update;
      update public.commerce_inventory
         set stock_on_hand = stock_on_hand + item.quantity,
             updated_at = now()
       where commerce_inventory.variant_id = item.variant_id;
      restocked := restocked + 1;
    end if;
  end loop;

  update public.commerce_orders
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason_code = reason
   where id = o.id;

  insert into public.commerce_order_events(
    order_id, event_code, from_status, to_status, actor_profile_id, actor_kind, metadata
  ) values (
    o.id, 'order_cancelled', o.status, 'cancelled', a, 'staff',
    jsonb_build_object('reason_code', reason)
  );
  if restocked > 0 then
    insert into public.commerce_order_events(
      order_id, event_code, from_status, to_status, actor_profile_id, actor_kind, metadata
    ) values (
      o.id, 'inventory_restocked_on_cancel', o.status, 'cancelled', a, 'staff',
      jsonb_build_object('ready_stock_lines', restocked)
    );
  end if;

  x := jsonb_build_object('id', o.id, 'status', 'cancelled');
  perform private.commerce_idempotency_store(a, op, p_idempotency_key, h, x);
  return x;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS / grants
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['commerce_orders','commerce_order_items','commerce_order_delivery','commerce_order_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.authorize(''commerce.read'')))',
      t || '_commerce_read',
      t
    );
  end loop;
end $$;

revoke all on function private.commerce_forbid_hard_delete() from public, anon, authenticated;
revoke all on function private.commerce_forbid_row_mutation() from public, anon, authenticated;
revoke all on function private.commerce_orders_restrict_update() from public, anon, authenticated;
revoke all on function private.commerce_order_raise(text) from public, anon, authenticated;
revoke all on function private.commerce_inclusive_tax_paise(bigint, integer) from public, anon, authenticated;
revoke all on function private.generate_commerce_order_reference() from public, anon, authenticated;
revoke all on function private.commerce_public_plain_text(text, integer, integer) from public, anon, authenticated;
revoke all on function private.commerce_public_normalize_mobile(text) from public, anon, authenticated;
revoke all on function private.commerce_public_normalize_email(text) from public, anon, authenticated;
revoke all on function private.commerce_public_idempotency_xact_lock(text, uuid) from public, anon, authenticated;
revoke all on function private.commerce_public_idempotency_lookup(text, uuid, text) from public, anon, authenticated;
revoke all on function private.commerce_public_idempotency_store(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.commerce_resolve_shipping_charge_paise(bigint, bigint, bigint, boolean, boolean, bigint, bigint) from public, anon, authenticated;
revoke all on function private.commerce_build_quote(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function private.commerce_public_quote_view(jsonb) from public, anon, authenticated;
revoke all on function private.commerce_public_rate_limit_xact_lock(text, text, text) from public, anon, authenticated, service_role;

do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (
        (
          n.nspname = 'private'
          and p.proname in (
            'generate_commerce_order_reference',
            'commerce_public_idempotency_xact_lock',
            'commerce_public_idempotency_lookup',
            'commerce_public_idempotency_store',
            'commerce_build_quote',
            'commerce_public_rate_limit_xact_lock'
          )
        )
        or (
          n.nspname = 'public'
          and p.proname in (
            'quote_public_commerce_cart',
            'create_public_commerce_cod_order',
            'verify_public_commerce_order_tracking_identity',
            'get_public_commerce_order_tracking_snapshot',
            'consume_commerce_public_rate_limit',
            'transition_commerce_order_fulfilment',
            'cancel_commerce_order'
          )
        )
      )
  loop
    execute format(
      'alter function %I.%I(%s) owner to postgres',
      r.nspname,
      r.proname,
      r.args
    );
  end loop;
end $$;

revoke all on function public.quote_public_commerce_cart(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.create_public_commerce_cod_order(jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.verify_public_commerce_order_tracking_identity(text, text) from public, anon, authenticated;
revoke all on function public.get_public_commerce_order_tracking_snapshot(text) from public, anon, authenticated;
revoke all on function public.consume_commerce_public_rate_limit(text, text, text) from public, anon, authenticated;
revoke all on function public.transition_commerce_order_fulfilment(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.cancel_commerce_order(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.quote_public_commerce_cart(jsonb, text, text) to service_role;
grant execute on function public.create_public_commerce_cod_order(jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.verify_public_commerce_order_tracking_identity(text, text) to service_role;
grant execute on function public.get_public_commerce_order_tracking_snapshot(text) to service_role;
grant execute on function public.consume_commerce_public_rate_limit(text, text, text) to service_role;
grant execute on function public.transition_commerce_order_fulfilment(uuid, text, text, uuid) to authenticated;
grant execute on function public.cancel_commerce_order(uuid, text, uuid) to authenticated;
