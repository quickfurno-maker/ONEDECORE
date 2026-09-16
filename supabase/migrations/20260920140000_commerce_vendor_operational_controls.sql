-- Vendor operational controls used by the ONEDECORE commerce admin.
-- Status remains independent from catalogue publication; inactive vendors fail
-- closed because private.current_commerce_vendor_id() returns active rows only.

alter table public.commerce_products
  add column vendor_sales_enabled boolean not null default true;

comment on column public.commerce_products.vendor_sales_enabled is
  'Vendor operational sales switch; independent from admin publication status.';

create or replace function public.set_commerce_vendor_status(
  p_vendor_id uuid,
  p_status text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid;
  h text;
  x jsonb;
  r public.commerce_vendors%rowtype;
  op text := 'set_commerce_vendor_status';
begin
  a := private.commerce_require_actor('commerce.catalog.manage');
  if p_vendor_id is null or p_status not in ('active','suspended','disabled') then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  h := private.commerce_sha256(jsonb_build_array(p_vendor_id,p_status)::text);
  perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
  x := private.commerce_idempotency_lookup(a,op,p_idempotency_key,h);
  if x is not null then return x; end if;
  update public.commerce_vendors
  set status = p_status
  where id = p_vendor_id
  returning * into r;
  if not found then
    raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002';
  end if;

  x := jsonb_build_object(
    'id',r.id,
    'vendor_code',r.vendor_code,
    'user_id',r.user_id,
    'display_name',r.display_name,
    'status',r.status
  );
  perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x);
  return x;
end $$;

alter function public.set_commerce_vendor_status(uuid,text,uuid) owner to postgres;
revoke all on function public.set_commerce_vendor_status(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.set_commerce_vendor_status(uuid,text,uuid) to authenticated;

comment on function public.set_commerce_vendor_status(uuid,text,uuid) is
  'Admin-only vendor lifecycle control. Suspended/disabled vendors immediately lose vendor portal access.';


create or replace function public.set_my_vendor_product_sales_state(
  p_product_id uuid,
  p_enabled boolean,
  p_stock_status text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid := auth.uid();
  v_vendor uuid;
  h text;
  x jsonb;
  r public.commerce_products%rowtype;
  op text := 'set_my_vendor_product_sales_state';
begin
  v_vendor := private.commerce_require_vendor();
  if p_product_id is null or p_enabled is null
     or p_stock_status not in ('in_stock','made_to_order','out_of_stock') then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  h := private.commerce_sha256(jsonb_build_array(p_product_id,p_enabled,p_stock_status)::text);
  perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
  x := private.commerce_idempotency_lookup(a,op,p_idempotency_key,h);
  if x is not null then return x; end if;

  update public.commerce_products
  set vendor_sales_enabled = p_enabled,
      vendor_stock_status = p_stock_status,
      updated_by = a
  where id = p_product_id
    and vendor_id = v_vendor
    and status in ('draft','published')
    and vendor_submission_status is distinct from 'rejected'
  returning * into r;
  if not found then
    raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002';
  end if;

  x := jsonb_build_object(
    'product_id',r.id,
    'vendor_sales_enabled',r.vendor_sales_enabled,
    'vendor_stock_status',r.vendor_stock_status
  );
  perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x);
  return x;
end $$;

create or replace function public.set_my_vendor_inventory_quantity(
  p_variant_id uuid,
  p_stock_on_hand integer,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid := auth.uid();
  v_vendor uuid;
  h text;
  x jsonb;
  v public.commerce_product_variants%rowtype;
  i public.commerce_inventory%rowtype;
  product_id_value uuid;
  op text := 'set_my_vendor_inventory_quantity';
begin
  v_vendor := private.commerce_require_vendor();
  if p_variant_id is null or p_stock_on_hand is null
     or p_stock_on_hand < 0 or p_stock_on_hand > 1000000 then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;
  select v0.* into v
  from public.commerce_product_variants v0
  join public.commerce_products p on p.id = v0.product_id
  where v0.id = p_variant_id
    and p.vendor_id = v_vendor
    and p.status in ('draft','published')
    and p.vendor_submission_status is distinct from 'rejected'
    and v0.status = 'active';
  product_id_value := v.product_id;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  if v.availability_mode <> 'ready_stock' then
    raise exception 'COMMERCE_VALIDATION' using errcode='22023';
  end if;

  h := private.commerce_sha256(jsonb_build_array(p_variant_id,p_stock_on_hand)::text);
  perform private.commerce_idempotency_xact_lock(a,op,p_idempotency_key);
  x := private.commerce_idempotency_lookup(a,op,p_idempotency_key,h);
  if x is not null then return x; end if;

  select * into i from public.commerce_inventory
  where variant_id = p_variant_id for update;
  if not found then raise exception 'COMMERCE_NOT_FOUND' using errcode='P0002'; end if;
  if p_stock_on_hand < i.reserved_qty then
    raise exception 'COMMERCE_INVENTORY_UNDERFLOW' using errcode='22023';
  end if;
  update public.commerce_inventory
  set stock_on_hand = p_stock_on_hand,
      updated_by = a
  where variant_id = p_variant_id
  returning * into i;

  update public.commerce_products
  set vendor_stock_status = case
        when i.available_qty > 0 then 'in_stock'
        else 'out_of_stock'
      end,
      updated_by = a
  where id = product_id_value;

  x := jsonb_build_object(
    'variant_id',i.variant_id,
    'stock_on_hand',i.stock_on_hand,
    'reserved_qty',i.reserved_qty,
    'available_qty',i.available_qty
  );
  perform private.commerce_idempotency_store(a,op,p_idempotency_key,h,x);
  return x;
end $$;

alter function public.set_my_vendor_product_sales_state(uuid,boolean,text,uuid) owner to postgres;
alter function public.set_my_vendor_inventory_quantity(uuid,integer,uuid) owner to postgres;
revoke all on function public.set_my_vendor_product_sales_state(uuid,boolean,text,uuid) from public,anon,authenticated;
revoke all on function public.set_my_vendor_inventory_quantity(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.set_my_vendor_product_sales_state(uuid,boolean,text,uuid) to authenticated;
grant execute on function public.set_my_vendor_inventory_quantity(uuid,integer,uuid) to authenticated;

comment on function public.set_my_vendor_product_sales_state(uuid,boolean,text,uuid) is
  'Vendor-owned operational availability switch; does not publish or approve catalogue content.';
comment on function public.set_my_vendor_inventory_quantity(uuid,integer,uuid) is
  'Vendor-owned absolute ready-stock quantity update; cannot reduce below reserved quantity.';

-- Vendor operational availability must affect storefront reads and checkout atomically.
create or replace function public.search_public_commerce_products(
  p_category_slug text,
  p_query text,
  p_sort text,
  p_min_price_paise bigint,
  p_max_price_paise bigint,
  p_availability_mode text,
  p_featured_only boolean,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sort text;
  v_limit integer;
  v_offset integer;
  v_query text;
  v_like text;
  v_category_ids uuid[];
  v_total integer;
  v_items jsonb;
begin
  v_sort := coalesce(nullif(trim(p_sort), ''), 'featured');
  if v_sort not in ('featured', 'newest', 'price_low_high', 'price_high_low') then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;

  if p_availability_mode is not null and p_availability_mode not in ('ready_stock', 'made_to_order') then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;

  if p_min_price_paise is not null and p_min_price_paise < 0 then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;
  if p_max_price_paise is not null and p_max_price_paise < 0 then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;
  if p_min_price_paise is not null and p_max_price_paise is not null and p_min_price_paise > p_max_price_paise then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 12), 1), 48);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  if v_offset > 10000 then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;

  v_query := nullif(btrim(coalesce(p_query, '')), '');
  if v_query is not null then
    if char_length(v_query) > 80 then
      raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
    end if;
    v_like := private.commerce_public_like_pattern(v_query);
  end if;

  if p_category_slug is not null and btrim(p_category_slug) <> '' then
    if p_category_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_category_slug) not between 2 and 120 then
      raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
    end if;
    select array_agg(x.id)
    into v_category_ids
    from (
      select c.id
      from public.commerce_categories c
      where private.commerce_public_category_visible(c.id)
        and (
          c.slug = p_category_slug
          or (
            c.parent_category_id is not null
            and exists (
              select 1
              from public.commerce_categories r
              where r.id = c.parent_category_id
                and r.slug = p_category_slug
                and private.commerce_public_category_visible(r.id)
            )
          )
        )
    ) x;
    if v_category_ids is null then
      return jsonb_build_object('items', '[]'::jsonb, 'total', 0);
    end if;
  end if;

  with published as (
    select
      p.product_reference,
      p.name,
      p.slug,
      p.short_description,
      p.featured,
      p.published_at,
      c.name as category_name,
      c.slug as category_slug,
      (
        select min(v.selling_price_paise)
        from public.commerce_product_variants v
        where v.product_id = p.id
          and v.status = 'active'
          and (p_availability_mode is null or v.availability_mode = p_availability_mode)
      ) as starting_price_paise,
      (
        select v.compare_at_price_paise
        from public.commerce_product_variants v
        where v.product_id = p.id
          and v.status = 'active'
          and (p_availability_mode is null or v.availability_mode = p_availability_mode)
        order by v.selling_price_paise, v.sort_order
        limit 1
      ) as compare_at_price_paise,
      (
        select count(*)::integer
        from public.commerce_product_variants v
        where v.product_id = p.id
          and v.status = 'active'
          and (p_availability_mode is null or v.availability_mode = p_availability_mode)
      ) as variant_count,
      (
        select bool_or(private.commerce_public_variant_available(v.availability_mode, i.available_qty))
        from public.commerce_product_variants v
        left join public.commerce_inventory i on i.variant_id = v.id
        where v.product_id = p.id
          and v.status = 'active'
          and (p_availability_mode is null or v.availability_mode = p_availability_mode)
      )
        and (p.vendor_id is null or p.vendor_sales_enabled)
        and (p.vendor_id is null or p.vendor_stock_status <> 'out_of_stock') as is_available,
      (
        select case
          when count(distinct v.availability_mode) = 0 then null
          when count(distinct v.availability_mode) = 1 then min(v.availability_mode)
          else 'mixed'
        end
        from public.commerce_product_variants v
        where v.product_id = p.id
          and v.status = 'active'
          and (p_availability_mode is null or v.availability_mode = p_availability_mode)
      ) as availability_mode,
      (
        select m.public_path
        from public.commerce_product_media m
        where m.product_id = p.id
          and m.is_primary
          and private.commerce_public_media_visible(m.product_id, m.variant_id, m.status, m.public_path)
        order by m.sort_order
        limit 1
      ) as primary_image_path,
      (
        select m.alt_text
        from public.commerce_product_media m
        where m.product_id = p.id
          and m.is_primary
          and private.commerce_public_media_visible(m.product_id, m.variant_id, m.status, m.public_path)
        order by m.sort_order
        limit 1
      ) as primary_image_alt
    from public.commerce_products p
    join public.commerce_categories c
      on c.id = p.category_id
     and private.commerce_public_category_visible(c.id)
    where p.status = 'published'
      and (v_category_ids is null or p.category_id = any (v_category_ids))
      and (coalesce(p_featured_only, false) is false or p.featured)
      and (
        v_like is null
        or p.name ilike v_like escape '\'
        or p.slug ilike v_like escape '\'
        or coalesce(p.short_description, '') ilike v_like escape '\'
        or c.name ilike v_like escape '\'
      )
  ),
  priced as (
    select *
    from published
    where starting_price_paise is not null
      and (p_min_price_paise is null or starting_price_paise >= p_min_price_paise)
      and (p_max_price_paise is null or starting_price_paise <= p_max_price_paise)
  ),
  page as (
    select
      jsonb_build_object(
        'product_reference', product_reference,
        'name', name,
        'slug', slug,
        'category_name', category_name,
        'category_slug', category_slug,
        'short_description', short_description,
        'featured', featured,
        'starting_price_paise', starting_price_paise,
        'compare_at_price_paise', case
          when compare_at_price_paise is not null and compare_at_price_paise > starting_price_paise
            then compare_at_price_paise
          else null
        end,
        'primary_image_path', primary_image_path,
        'primary_image_alt', coalesce(primary_image_alt, ''),
        'variant_count', variant_count,
        'availability_mode', availability_mode,
        'is_available', coalesce(is_available, false)
      ) as item,
      name,
      slug,
      case v_sort
        when 'newest' then extract(epoch from coalesce(published_at, to_timestamp(0))) * -1
        when 'price_low_high' then starting_price_paise
        when 'price_high_low' then -starting_price_paise
        else case when featured then 0 else 1 end
      end as ord
    from priced
    order by
      case v_sort
        when 'newest' then extract(epoch from coalesce(published_at, to_timestamp(0))) * -1
        when 'price_low_high' then starting_price_paise
        when 'price_high_low' then -starting_price_paise
        else case when featured then 0 else 1 end
      end,
      case when v_sort = 'featured' then extract(epoch from coalesce(published_at, to_timestamp(0))) * -1 else 0 end,
      name,
      slug
    limit v_limit
    offset v_offset
  )
  select
    (select count(*)::integer from priced),
    coalesce((select jsonb_agg(item order by ord, name, slug) from page), '[]'::jsonb)
  into v_total, v_items;

  return jsonb_build_object('items', v_items, 'total', v_total);
end;
$$;

create or replace function public.get_public_commerce_product(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text;
  result jsonb;
begin
  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 2 and 120 then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'product_reference', p.product_reference,
    'name', p.name,
    'slug', p.slug,
    'short_description', p.short_description,
    'full_description', p.full_description,
    'seo_title', p.seo_title,
    'seo_description', p.seo_description,
    'hsn_sac_code', p.hsn_sac_code,
    'featured', p.featured,
    'gst_inclusive_display', true,
    'category', jsonb_build_object(
      'name', c.name,
      'slug', c.slug,
      'parent_slug', parent.slug
    ),
    'variants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'sku', v.sku,
          'display_name', v.display_name,
          'option_values', v.option_values,
          'selling_price_paise', v.selling_price_paise,
          'compare_at_price_paise', case
            when v.compare_at_price_paise is not null and v.compare_at_price_paise > v.selling_price_paise
              then v.compare_at_price_paise
            else null
          end,
          'availability_mode', v.availability_mode,
          'is_available', (private.commerce_public_variant_available(v.availability_mode, i.available_qty)
            and (p.vendor_id is null or p.vendor_sales_enabled)
            and (p.vendor_id is null or p.vendor_stock_status <> 'out_of_stock')),
          'sort_order', v.sort_order
        )
        order by v.sort_order, v.sku
      )
      from public.commerce_product_variants v
      left join public.commerce_inventory i on i.variant_id = v.id
      where v.product_id = p.id and v.status = 'active'
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'public_path', m.public_path,
          'alt_text', m.alt_text,
          'is_primary', m.is_primary,
          'sort_order', m.sort_order
        )
        order by m.is_primary desc, m.sort_order, m.created_at
      )
      from public.commerce_product_media m
      where m.product_id = p.id
        and private.commerce_public_media_visible(m.product_id, m.variant_id, m.status, m.public_path)
    ), '[]'::jsonb),
    'specifications', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', s.specification_key,
          'value', s.specification_value,
          'sort_order', s.sort_order
        )
        order by s.sort_order, s.specification_key
      )
      from public.commerce_product_specifications s
      where s.product_id = p.id
    ), '[]'::jsonb),
    'related', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_reference', rp.product_reference,
          'name', rp.name,
          'slug', rp.slug,
          'category_name', rc.name,
          'category_slug', rc.slug,
          'short_description', rp.short_description,
          'featured', rp.featured,
          'starting_price_paise', (
            select min(v.selling_price_paise)
            from public.commerce_product_variants v
            where v.product_id = rp.id and v.status = 'active'
          ),
          'compare_at_price_paise', (
            select v.compare_at_price_paise
            from public.commerce_product_variants v
            where v.product_id = rp.id and v.status = 'active'
            order by v.selling_price_paise, v.sort_order
            limit 1
          ),
          'primary_image_path', (
            select m.public_path
            from public.commerce_product_media m
            where m.product_id = rp.id
              and m.is_primary
              and private.commerce_public_media_visible(m.product_id, m.variant_id, m.status, m.public_path)
            limit 1
          ),
          'primary_image_alt', (
            select m.alt_text
            from public.commerce_product_media m
            where m.product_id = rp.id
              and m.is_primary
              and private.commerce_public_media_visible(m.product_id, m.variant_id, m.status, m.public_path)
            limit 1
          ),
          'variant_count', (
            select count(*)::integer
            from public.commerce_product_variants v
            where v.product_id = rp.id and v.status = 'active'
          ),
          'availability_mode', (
            select case
              when count(distinct v.availability_mode) = 0 then null
              when count(distinct v.availability_mode) = 1 then min(v.availability_mode)
              else 'mixed'
            end
            from public.commerce_product_variants v
            where v.product_id = rp.id and v.status = 'active'
          ),
          'is_available', coalesce((
            select bool_or(private.commerce_public_variant_available(v.availability_mode, i.available_qty))
            from public.commerce_product_variants v
            left join public.commerce_inventory i on i.variant_id = v.id
            where v.product_id = rp.id and v.status = 'active'
          ), false)
          and (rp.vendor_id is null or rp.vendor_sales_enabled)
          and (rp.vendor_id is null or rp.vendor_stock_status <> 'out_of_stock')
        )
        order by rel.sort_order, rp.name
      )
      from public.commerce_related_products rel
      join public.commerce_products rp on rp.id = rel.related_product_id
      join public.commerce_categories rc on rc.id = rp.category_id
      where rel.product_id = p.id
        and rp.status = 'published'
        and private.commerce_public_category_visible(rc.id)
    ), '[]'::jsonb)
  )
  into result
  from public.commerce_products p
  join public.commerce_categories c
    on c.id = p.category_id
   and private.commerce_public_category_visible(c.id)
  left join public.commerce_categories parent
    on parent.id = c.parent_category_id
   and private.commerce_public_category_visible(parent.id)
  where p.slug = v_slug
    and p.status = 'published';

  return result;
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
    if not found or p.status <> 'published' or not private.commerce_public_category_visible(p.category_id)
       or (p.vendor_id is not null and (p.vendor_sales_enabled is not true or p.vendor_stock_status = 'out_of_stock')) then
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
