-- ONEDECORE Phase 9D-C1 public storefront read foundation pgTAP

begin;
select plan(33);

select has_function('public', 'list_public_commerce_categories', 'list_public_commerce_categories exists');
select has_function('public', 'search_public_commerce_products', 'search_public_commerce_products exists');
select has_function('public', 'get_public_commerce_product', 'get_public_commerce_product exists');
select has_function('public', 'check_public_commerce_pincode', 'check_public_commerce_pincode exists');
select has_function('public', 'list_public_commerce_sitemap', 'list_public_commerce_sitemap exists');

insert into auth.users (id, instance_id, email, aud, role) values
  ('9c111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_9dc1@onedecore.in', 'authenticated', 'authenticated'),
  ('9c333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_9dc1@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 9D-C1 ' || id::text
where id in (
  '9c111111-1111-4111-8111-111111111111',
  '9c333333-3333-4333-8333-333333333333'
);

insert into public.user_roles (user_id, role_id)
select '9c111111-1111-4111-8111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9c333333-3333-4333-8333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;

insert into public.commerce_categories (
  id, category_reference, name, slug, parent_category_id, short_description, status, created_by
) values
  ('aa111111-1111-4111-8111-111111111111', 'OD-CC-2026-900001', 'Beds', 'beds', null, 'Sleep', 'active', '9c111111-1111-4111-8111-111111111111'),
  ('aa111111-1111-4111-8111-111111111112', 'OD-CC-2026-900002', 'King Beds', 'king-beds', 'aa111111-1111-4111-8111-111111111111', 'King', 'active', '9c111111-1111-4111-8111-111111111111'),
  ('aa111111-1111-4111-8111-111111111113', 'OD-CC-2026-900003', 'Hidden', 'hidden-cat', null, 'Archived', 'archived', '9c111111-1111-4111-8111-111111111111');

insert into public.commerce_products (
  id, product_reference, category_id, name, slug, short_description, full_description, status, featured, created_by, published_at
) values
  ('bb111111-1111-4111-8111-111111111111', 'OD-P-2026-900001', 'aa111111-1111-4111-8111-111111111111', 'Published Bed', 'published-bed', 'A bed', 'Full bed copy', 'published', true, '9c111111-1111-4111-8111-111111111111', now()),
  ('bb111111-1111-4111-8111-111111111112', 'OD-P-2026-900002', 'aa111111-1111-4111-8111-111111111112', 'King Published', 'king-published', 'King', 'King copy', 'published', false, '9c111111-1111-4111-8111-111111111111', now()),
  ('bb111111-1111-4111-8111-111111111113', 'OD-P-2026-900003', 'aa111111-1111-4111-8111-111111111111', 'Draft Bed', 'draft-bed', 'Draft', 'Draft copy', 'draft', false, '9c111111-1111-4111-8111-111111111111', null),
  ('bb111111-1111-4111-8111-111111111114', 'OD-P-2026-900004', 'aa111111-1111-4111-8111-111111111111', 'Archived Bed', 'archived-bed', 'Archived', 'Archived copy', 'archived', false, '9c111111-1111-4111-8111-111111111111', now()),
  ('bb111111-1111-4111-8111-111111111115', 'OD-P-2026-900005', 'aa111111-1111-4111-8111-111111111113', 'Hidden Cat Product', 'hidden-cat-product', 'Hidden', 'Hidden', 'published', false, '9c111111-1111-4111-8111-111111111111', now());

insert into public.commerce_product_variants (
  id, product_id, sku, option_values, display_name, selling_price_paise, compare_at_price_paise, status, availability_mode, sort_order, created_by
) values
  ('cc111111-1111-4111-8111-111111111111', 'bb111111-1111-4111-8111-111111111111', 'pub-bed-oak', '{"color":"oak"}'::jsonb, 'Oak', 4250000, 5000000, 'active', 'ready_stock', 0, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111112', 'bb111111-1111-4111-8111-111111111111', 'pub-bed-hidden', '{"color":"hidden"}'::jsonb, 'Hidden', 100, null, 'archived', 'ready_stock', 1, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111113', 'bb111111-1111-4111-8111-111111111112', 'king-pub', '{"size":"king"}'::jsonb, 'King', 5100000, null, 'active', 'made_to_order', 0, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111114', 'bb111111-1111-4111-8111-111111111113', 'draft-var', '{}'::jsonb, 'Draft v', 1000, null, 'active', 'ready_stock', 0, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111115', 'bb111111-1111-4111-8111-111111111115', 'hidden-var', '{}'::jsonb, 'Hidden v', 1000, null, 'active', 'ready_stock', 0, '9c111111-1111-4111-8111-111111111111');

insert into public.commerce_inventory (variant_id, stock_on_hand, reserved_qty, updated_by) values
  ('cc111111-1111-4111-8111-111111111111', 4, 1, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111112', 99, 0, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111113', 0, 0, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111114', 5, 0, '9c111111-1111-4111-8111-111111111111'),
  ('cc111111-1111-4111-8111-111111111115', 5, 0, '9c111111-1111-4111-8111-111111111111');

insert into public.commerce_product_media (
  id, product_id, original_path, public_path, alt_text, is_primary, status, sort_order, created_by
) values
  ('dd111111-1111-4111-8111-111111111111', 'bb111111-1111-4111-8111-111111111111', 'bb111111-1111-4111-8111-111111111111/dd111111-1111-4111-8111-111111111111/original', 'bb111111-1111-4111-8111-111111111111/dd111111-1111-4111-8111-111111111111/derivative.webp', 'Primary bed', true, 'active', 0, '9c111111-1111-4111-8111-111111111111'),
  ('dd111111-1111-4111-8111-111111111112', 'bb111111-1111-4111-8111-111111111111', 'bb111111-1111-4111-8111-111111111111/dd111111-1111-4111-8111-111111111112/original', 'bb111111-1111-4111-8111-111111111111/dd111111-1111-4111-8111-111111111112/derivative.webp', 'Archived media', false, 'archived', 1, '9c111111-1111-4111-8111-111111111111'),
  ('dd111111-1111-4111-8111-111111111113', 'bb111111-1111-4111-8111-111111111112', 'bb111111-1111-4111-8111-111111111112/dd111111-1111-4111-8111-111111111113/original', 'bb111111-1111-4111-8111-111111111112/dd111111-1111-4111-8111-111111111113/derivative.webp', 'King', true, 'active', 0, '9c111111-1111-4111-8111-111111111111');

insert into public.commerce_related_products (product_id, related_product_id, sort_order) values
  ('bb111111-1111-4111-8111-111111111111', 'bb111111-1111-4111-8111-111111111112', 0),
  ('bb111111-1111-4111-8111-111111111111', 'bb111111-1111-4111-8111-111111111113', 1);

insert into public.commerce_pincodes (pincode, serviceable, zone_code, eta_min_days, eta_max_days, updated_by) values
  ('411001', true, 'PUNE-CORE', 3, 7, '9c111111-1111-4111-8111-111111111111'),
  ('411999', false, 'OUT', 0, 0, '9c111111-1111-4111-8111-111111111111');

update public.commerce_shipping_settings
set assembly_install_note = 'White-glove assembly on request'
where id = 1;

-- Anon: no raw table SELECT
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select count(*) from public.commerce_products$$,
  '42501',
  NULL,
  'anon cannot SELECT commerce_products'
);
select throws_ok(
  $$select count(*) from public.commerce_categories$$,
  '42501',
  NULL,
  'anon cannot SELECT commerce_categories'
);
select throws_ok(
  $$select count(*) from public.commerce_inventory$$,
  '42501',
  NULL,
  'anon cannot SELECT commerce_inventory'
);
select throws_ok(
  $$select count(*) from private.commerce_idempotency_requests$$,
  '42501',
  NULL,
  'anon cannot SELECT commerce ledger'
);

select lives_ok(
  $$select public.list_public_commerce_categories()$$,
  'anon can execute list_public_commerce_categories'
);
select lives_ok(
  $$select public.search_public_commerce_products(null,null,'featured',null,null,null,false,12,0)$$,
  'anon can execute search_public_commerce_products'
);

select throws_ok(
  $$select public.publish_commerce_product('bb111111-1111-4111-8111-111111111113', 1, gen_random_uuid())$$,
  '42501',
  NULL,
  'anon cannot execute publish_commerce_product'
);
select throws_ok(
  $$select public.adjust_commerce_inventory('cc111111-1111-4111-8111-111111111111', 1, 'qa', gen_random_uuid())$$,
  '42501',
  NULL,
  'anon cannot execute adjust_commerce_inventory'
);

select ok(
  (select public.search_public_commerce_products(null,null,'featured',null,null,null,false,12,0)
    -> 'items' @> '[]'::jsonb)
  and not exists (
    select 1
    from jsonb_array_elements(
      public.search_public_commerce_products(null,null,'featured',null,null,null,false,12,0) -> 'items'
    ) e
    where e->>'slug' in ('draft-bed','archived-bed','hidden-cat-product')
  ),
  'public search excludes draft, archived, and inactive-category products'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.search_public_commerce_products(null,null,'featured',null,null,null,false,12,0) -> 'items'
    ) e
    where e->>'slug' = 'published-bed'
  ),
  'public search returns published product'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.list_public_commerce_categories()) e
    where e->>'slug' = 'hidden-cat'
  )
  and exists (
    select 1
    from jsonb_array_elements(public.list_public_commerce_categories()) e
    where e->>'slug' = 'beds'
  ),
  'public categories exclude archived'
);

select is(
  public.get_public_commerce_product('draft-bed'),
  null,
  'get_public_commerce_product returns null for draft'
);

select is(
  public.get_public_commerce_product('archived-bed'),
  null,
  'get_public_commerce_product returns null for archived'
);

select ok(
  (select jsonb_array_length(public.get_public_commerce_product('published-bed')->'variants') = 1)
  and (select public.get_public_commerce_product('published-bed')->'variants'->0->>'sku') = 'pub-bed-oak',
  'inactive variants excluded from public detail'
);

select ok(
  (select jsonb_array_length(public.get_public_commerce_product('published-bed')->'media') = 1)
  and (select public.get_public_commerce_product('published-bed')->'media'->0->>'alt_text') = 'Primary bed',
  'archived media excluded from public detail'
);

select ok(
  (select jsonb_array_length(public.get_public_commerce_product('published-bed')->'related') = 1)
  and (select public.get_public_commerce_product('published-bed')->'related'->0->>'slug') = 'king-published',
  'related products filtered to published/active'
);

select throws_ok(
  $$select public.check_public_commerce_pincode('41100')$$,
  '22023',
  NULL,
  'malformed pincode fails closed'
);

select throws_ok(
  $$select public.search_public_commerce_products(null,null,'best_selling',null,null,null,false,12,0)$$,
  '22023',
  NULL,
  'arbitrary sort fails closed'
);

select is(
  (public.check_public_commerce_pincode('400000')->>'serviceable')::boolean,
  false,
  'unknown pincode is not serviceable'
);

select ok(
  (public.check_public_commerce_pincode('411001')->>'serviceable')::boolean
  and (public.check_public_commerce_pincode('411001')->>'eta_min_days') = '3'
  and public.check_public_commerce_pincode('411001') ? 'assembly_install_note'
  and not (public.check_public_commerce_pincode('411001') ? 'zone_code'),
  'serviceable pincode returns ETA and no zone internals'
);

select is(
  jsonb_array_length(public.search_public_commerce_products(null,null,'featured',null,null,null,false,200,0)->'items'),
  2,
  'limit is bounded and only two published/active products exist'
);

select ok(
  not (public.search_public_commerce_products(null,null,'featured',null,null,null,false,12,0)::text ilike '%stock_on_hand%')
  and not (public.search_public_commerce_products(null,null,'featured',null,null,null,false,12,0)::text ilike '%reserved_qty%')
  and not (public.get_public_commerce_product('published-bed')::text ilike '%stock_on_hand%'),
  'public RPCs do not expose internal stock fields'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.search_public_commerce_products('beds',null,'featured',null,null,null,false,12,0) -> 'items'
    ) e
    where e->>'slug' = 'king-published'
  ),
  'root category filter includes direct child category products'
);

select is(
  (select count(*)::integer
   from jsonb_array_elements(
     public.search_public_commerce_products(null,'%published%', 'featured',null,null,null,false,12,0)->'items'
   )),
  0,
  'LIKE metacharacters in search are escaped'
);

select ok(
  exists (
    select 1 from jsonb_array_elements(public.list_public_commerce_sitemap()->'products') e
    where e->>'slug' = 'published-bed'
  )
  and not exists (
    select 1 from jsonb_array_elements(public.list_public_commerce_sitemap()->'products') e
    where e->>'slug' in ('draft-bed','archived-bed','hidden-cat-product')
  )
  and not exists (
    select 1 from jsonb_array_elements(public.list_public_commerce_sitemap()->'categories') e
    where e->>'slug' = 'hidden-cat'
  ),
  'sitemap includes only active categories and published products'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"9c333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.commerce_products where slug = 'published-bed'),
  0,
  'authenticated without commerce.read cannot SELECT raw commerce_products'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"9c111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.commerce_products where slug = 'published-bed'),
  1,
  'commerce.read staff can SELECT raw commerce_products'
);

select lives_ok(
  $$select public.list_public_commerce_categories()$$,
  'authenticated can execute public list RPC'
);

reset role;
select * from finish();
rollback;
