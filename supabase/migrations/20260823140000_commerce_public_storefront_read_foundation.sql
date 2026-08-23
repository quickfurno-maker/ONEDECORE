-- ============================================================================
-- ONEDECORE Phase 9D-C1 public storefront read foundation
-- Forward-only after M35. Repository only. Not managed-applied in this gate.
-- No anon table SELECT. No orders/payments. No cart. No M35 rewrite.
-- ============================================================================

create or replace function private.commerce_public_like_pattern(p_query text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

create or replace function private.commerce_public_variant_available(
  p_mode text,
  p_available_qty integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_mode = 'made_to_order' then true
    else coalesce(p_available_qty, 0) > 0
  end;
$$;

create or replace function public.list_public_commerce_categories()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', q.name,
        'slug', q.slug,
        'short_description', q.short_description,
        'seo_title', q.seo_title,
        'seo_description', q.seo_description,
        'sort_order', q.sort_order,
        'parent_slug', q.parent_slug,
        'is_root', q.is_root
      )
      order by q.sort_order, q.name
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      c.name,
      c.slug,
      c.short_description,
      c.seo_title,
      c.seo_description,
      c.sort_order,
      p.slug as parent_slug,
      (c.parent_category_id is null) as is_root
    from public.commerce_categories c
    left join public.commerce_categories p
      on p.id = c.parent_category_id
     and p.status = 'active'
    where c.status = 'active'
      and (c.parent_category_id is null or p.id is not null)
  ) q;
  return result;
end;
$$;

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
      where c.status = 'active'
        and (
          c.slug = p_category_slug
          or (
            c.parent_category_id is not null
            and exists (
              select 1
              from public.commerce_categories r
              where r.id = c.parent_category_id
                and r.status = 'active'
                and r.slug = p_category_slug
                and r.parent_category_id is null
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
        where v.product_id = p.id and v.status = 'active'
      ) as variant_count,
      (
        select bool_or(private.commerce_public_variant_available(v.availability_mode, i.available_qty))
        from public.commerce_product_variants v
        left join public.commerce_inventory i on i.variant_id = v.id
        where v.product_id = p.id and v.status = 'active'
      ) as is_available,
      (
        select case
          when count(distinct v.availability_mode) = 0 then null
          when count(distinct v.availability_mode) = 1 then min(v.availability_mode)
          else 'mixed'
        end
        from public.commerce_product_variants v
        where v.product_id = p.id and v.status = 'active'
      ) as availability_mode,
      (
        select m.public_path
        from public.commerce_product_media m
        where m.product_id = p.id and m.status = 'active' and m.is_primary and m.public_path <> ''
        order by m.sort_order
        limit 1
      ) as primary_image_path,
      (
        select m.alt_text
        from public.commerce_product_media m
        where m.product_id = p.id and m.status = 'active' and m.is_primary and m.public_path <> ''
        order by m.sort_order
        limit 1
      ) as primary_image_alt
    from public.commerce_products p
    join public.commerce_categories c on c.id = p.category_id and c.status = 'active'
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
          'is_available', private.commerce_public_variant_available(v.availability_mode, i.available_qty),
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
      where m.product_id = p.id and m.status = 'active' and m.public_path <> ''
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
            where m.product_id = rp.id and m.status = 'active' and m.is_primary and m.public_path <> ''
            limit 1
          ),
          'primary_image_alt', (
            select m.alt_text
            from public.commerce_product_media m
            where m.product_id = rp.id and m.status = 'active' and m.is_primary and m.public_path <> ''
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
        )
        order by rel.sort_order, rp.name
      )
      from public.commerce_related_products rel
      join public.commerce_products rp on rp.id = rel.related_product_id
      join public.commerce_categories rc on rc.id = rp.category_id
      where rel.product_id = p.id
        and rp.status = 'published'
        and rc.status = 'active'
    ), '[]'::jsonb)
  )
  into result
  from public.commerce_products p
  join public.commerce_categories c on c.id = p.category_id and c.status = 'active'
  left join public.commerce_categories parent on parent.id = c.parent_category_id and parent.status = 'active'
  where p.slug = v_slug
    and p.status = 'published';

  return result;
end;
$$;

create or replace function public.check_public_commerce_pincode(p_pincode text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pin text;
  rec public.commerce_pincodes%rowtype;
  v_note text;
begin
  v_pin := btrim(coalesce(p_pincode, ''));
  if v_pin !~ '^[0-9]{6}$' then
    raise exception 'COMMERCE_VALIDATION' using errcode = '22023';
  end if;

  select * into rec from public.commerce_pincodes where pincode = v_pin;
  if rec.pincode is null then
    return jsonb_build_object(
      'pincode', v_pin,
      'serviceable', false
    );
  end if;

  select nullif(btrim(assembly_install_note), '')
  into v_note
  from public.commerce_shipping_settings
  where id = 1;

  if rec.serviceable then
    return jsonb_build_object(
      'pincode', rec.pincode,
      'serviceable', true,
      'eta_min_days', rec.eta_min_days,
      'eta_max_days', rec.eta_max_days,
      'assembly_install_note', v_note
    );
  end if;

  return jsonb_build_object(
    'pincode', rec.pincode,
    'serviceable', false
  );
end;
$$;

create or replace function public.list_public_commerce_sitemap()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object('slug', c.slug, 'updated_at', c.updated_at)
        order by c.slug
      )
      from public.commerce_categories c
      where c.status = 'active'
        and (
          c.parent_category_id is null
          or exists (
            select 1 from public.commerce_categories p
            where p.id = c.parent_category_id and p.status = 'active'
          )
        )
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object('slug', p.slug, 'updated_at', p.updated_at)
        order by p.slug
      )
      from public.commerce_products p
      join public.commerce_categories c on c.id = p.category_id and c.status = 'active'
      where p.status = 'published'
    ), '[]'::jsonb)
  );
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.proname in (
        'commerce_public_like_pattern',
        'commerce_public_variant_available',
        'list_public_commerce_categories',
        'search_public_commerce_products',
        'get_public_commerce_product',
        'check_public_commerce_pincode',
        'list_public_commerce_sitemap'
      )
  loop
    execute format('alter function %s owner to postgres', r.sig);
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

grant execute on function public.list_public_commerce_categories() to anon, authenticated;
grant execute on function public.search_public_commerce_products(text, text, text, bigint, bigint, text, boolean, integer, integer) to anon, authenticated;
grant execute on function public.get_public_commerce_product(text) to anon, authenticated;
grant execute on function public.check_public_commerce_pincode(text) to anon, authenticated;
grant execute on function public.list_public_commerce_sitemap() to anon, authenticated;

comment on function public.list_public_commerce_categories() is
  '9D-C1 public-safe active category list. No anon table SELECT.';
comment on function public.search_public_commerce_products(text, text, text, bigint, bigint, text, boolean, integer, integer) is
  '9D-C1 public-safe published product search. Bounded, allowlisted sort.';
comment on function public.get_public_commerce_product(text) is
  '9D-C1 public-safe published product detail by slug.';
comment on function public.check_public_commerce_pincode(text) is
  '9D-C1 public-safe 6-digit pincode serviceability check.';
comment on function public.list_public_commerce_sitemap() is
  '9D-C1 public-safe sitemap slugs for active categories and published products.';
