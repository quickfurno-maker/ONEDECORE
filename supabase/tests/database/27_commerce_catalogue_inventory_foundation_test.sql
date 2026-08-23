-- ONEDECORE Phase 9D-B commerce catalogue / inventory foundation pgTAP

begin;
select plan(84);

select has_table('public', 'commerce_categories', 'commerce_categories exists');
select has_table('public', 'commerce_products', 'commerce_products exists');
select has_table('public', 'commerce_product_variants', 'commerce_product_variants exists');
select has_table('public', 'commerce_product_media', 'commerce_product_media exists');
select has_table('public', 'commerce_product_specifications', 'commerce_product_specifications exists');
select has_table('public', 'commerce_inventory', 'commerce_inventory exists');
select has_table('public', 'commerce_related_products', 'commerce_related_products exists');
select has_table('public', 'commerce_pincodes', 'commerce_pincodes exists');
select has_table('public', 'commerce_shipping_settings', 'commerce_shipping_settings exists');
select has_table('public', 'commerce_tax_rates', 'commerce_tax_rates exists');
select has_table('public', 'commerce_tax_settings', 'commerce_tax_settings exists');

select hasnt_table('public', 'commerce_payments', 'no commerce_payments in 9D-B');
select hasnt_table('public', 'commerce_payment_events', 'no commerce_payment_events in 9D-B');

select ok(
  (select public from storage.buckets where id = 'commerce-product-originals') is false
  and (select file_size_limit from storage.buckets where id = 'commerce-product-originals') = 20971520,
  'commerce-product-originals is private 20 MiB'
);
select ok(
  (select public from storage.buckets where id = 'commerce-product-public') is true
  and (select file_size_limit from storage.buckets where id = 'commerce-product-public') = 8388608,
  'commerce-product-public is public 8 MiB'
);

select is(
  (select count(*)::integer from public.permissions where code in (
    'commerce.read','commerce.catalog.manage','commerce.inventory.manage',
    'commerce.orders.manage','commerce.payments.read','commerce.settings.manage'
  )),
  6,
  'exactly six commerce permission codes'
);

select is(
  (select count(*)::integer
   from public.role_permissions rp
   join public.roles r on r.id = rp.role_id
   join public.permissions p on p.id = rp.permission_id
   where r.code = 'super_admin' and p.code like 'commerce.%'),
  6,
  'super_admin has all six commerce permissions'
);

select is(
  (select array_agg(p.code order by p.code)
   from public.role_permissions rp
   join public.roles r on r.id = rp.role_id
   join public.permissions p on p.id = rp.permission_id
   where r.code = 'sales_manager' and p.code like 'commerce.%'),
  array['commerce.orders.manage','commerce.payments.read','commerce.read']::text[],
  'sales_manager has exactly commerce.read, orders.manage, payments.read'
);

select is(
  (select count(*)::integer
   from public.role_permissions rp
   join public.roles r on r.id = rp.role_id
   join public.permissions p on p.id = rp.permission_id
   where r.code not in ('super_admin','sales_manager')
     and p.code like 'commerce.%'),
  0,
  'all other roles have no commerce permissions'
);

select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'commerce_categories','commerce_products','commerce_product_variants',
       'commerce_product_media','commerce_product_specifications','commerce_inventory',
       'commerce_related_products','commerce_pincodes','commerce_shipping_settings',
       'commerce_tax_rates','commerce_tax_settings'
     )),
  'FORCE RLS on all 9D-B commerce tables'
);

select is(
  (select count(*)::integer from public.commerce_tax_rates),
  0,
  'no statutory GST rate is seeded'
);

select is(
  (select gst_inclusive_display from public.commerce_tax_settings where id = 1),
  true,
  'initial gst_inclusive_display is true'
);

insert into auth.users (id, instance_id, email, aud, role) values
  ('9d111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_9d@onedecore.in', 'authenticated', 'authenticated'),
  ('9d222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm_9d@onedecore.in', 'authenticated', 'authenticated'),
  ('9d333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_9d@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 9D-B ' || id::text
where id in (
  '9d111111-1111-1111-1111-111111111111',
  '9d222222-2222-2222-2222-222222222222',
  '9d333333-3333-3333-3333-333333333333'
);

insert into public.user_roles (user_id, role_id)
select '9d111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9d222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9d333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;

select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$insert into public.commerce_categories (category_reference, name, slug, created_by)
    values ('OD-CC-2026-999999', 'Nope', 'nope', '9d111111-1111-1111-1111-111111111111')$$,
  '42501',
  NULL,
  'authenticated direct insert into commerce_categories denied'
);

select throws_ok(
  $$update public.commerce_inventory set reserved_qty = 1$$,
  '42501',
  NULL,
  'authenticated cannot alter reserved_qty via table DML'
);

select throws_ok(
  $$update public.commerce_tax_settings set gst_inclusive_display = false where id = 1$$,
  '42501',
  NULL,
  'authenticated DML cannot set gst_inclusive_display false'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$insert into public.commerce_products (product_reference, category_id, name, slug, created_by)
    values ('OD-P-2026-999999', '00000000-0000-0000-0000-000000000001', 'Nope', 'nope', '9d111111-1111-1111-1111-111111111111')$$,
  '42501',
  NULL,
  'anon writes to commerce_products denied'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"9d333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.upsert_commerce_category(null,'Sofas','sofas',null,null,null,null,0,null,null,null,'9d000000-0000-0000-0000-000000000001')$$,
  '42501',
  NULL,
  'sales_executive cannot mutate catalogue'
);

select throws_ok(
  $$select public.adjust_commerce_inventory('00000000-0000-0000-0000-000000000001', 1, 'count', '9d000000-0000-0000-0000-000000000002')$$,
  '42501',
  NULL,
  'sales_executive cannot adjust inventory'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"9d222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.upsert_commerce_category(null,'Sofas','sofas',null,null,null,null,0,null,null,null,'9d000000-0000-0000-0000-000000000003')$$,
  '42501',
  NULL,
  'sales_manager cannot manage catalogue'
);

select throws_ok(
  $$select public.update_commerce_tax_settings(true, '9d000000-0000-0000-0000-000000000004')$$,
  '42501',
  NULL,
  'sales_manager cannot mutate tax settings'
);

select throws_ok(
  $$select public.adjust_commerce_inventory('00000000-0000-0000-0000-000000000001', 1, 'count', '9d000000-0000-0000-0000-000000000005')$$,
  '42501',
  NULL,
  'sales_manager cannot manage inventory'
);

reset role;
select throws_ok(
  $$update public.commerce_tax_settings set gst_inclusive_display = false where id = 1$$,
  '23514',
  NULL,
  'gst_inclusive_display cannot be stored as false'
);
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.update_commerce_tax_settings(true, '9d000000-0000-0000-0000-000000000006')$$,
  'SA can update tax_required_for_publish without mutating GST-inclusive display'
);

select is(
  (select gst_inclusive_display from public.commerce_tax_settings where id = 1),
  true,
  'authorized tax settings RPC cannot make gst_inclusive_display false'
);

select throws_ok(
  $$select public.update_commerce_tax_settings(false, true, '9d000000-0000-0000-0000-000000000007')$$,
  '42883',
  NULL,
  'gst_inclusive_display is not a mutable update_commerce_tax_settings argument'
);

select ok(
  (select public.upsert_commerce_category(null,'Sofas','sofas',null,'Living seating',null,null,10,null,null,null,'9d000000-0000-0000-0000-000000000010')->>'category_reference')
    ~ '^OD-CC-[0-9]{4}-[0-9]{6}$',
  'SA creates category with OD-CC reference'
);

select is(
  public.upsert_commerce_category(null,'Sofas','sofas',null,'Living seating',null,null,10,null,null,null,'9d000000-0000-0000-0000-000000000010')->>'category_reference',
  (select category_reference from public.commerce_categories where slug = 'sofas'),
  'category upsert is idempotent on matching hash'
);

select throws_ok(
  $$select public.upsert_commerce_category(null,'Sofas Two','sofas',null,null,null,null,0,null,null,null,'9d000000-0000-0000-0000-000000000011')$$,
  '23505',
  NULL,
  'category slug is unique'
);

select lives_ok(
  $$select public.upsert_commerce_category(null,'Sectionals','sectionals',(select id from public.commerce_categories where slug='sofas'),null,null,null,1,null,null,null,'9d000000-0000-0000-0000-000000000012')$$,
  'subcategory may parent a root category'
);

select throws_ok(
  $$select public.upsert_commerce_category(null,'Too Deep','too-deep',(select id from public.commerce_categories where slug='sectionals'),null,null,null,0,null,null,null,'9d000000-0000-0000-0000-000000000013')$$,
  '22023',
  NULL,
  'deeper-than-MVP category nesting is rejected'
);

select throws_ok(
  $$select public.upsert_commerce_category(
      (select id from public.commerce_categories where slug='sofas'),
      'Sofas','sofas',
      (select id from public.commerce_categories where slug='sofas'),
      null,null,null,0,null,null,null,'9d000000-0000-0000-0000-000000000014')$$,
  '22023',
  NULL,
  'category cannot parent itself'
);

select lives_ok(
  $$select public.upsert_commerce_category(null,'Beds','beds',null,null,null,null,2,null,null,null,'9d000000-0000-0000-0000-000000000015')$$,
  'second root category can be created'
);

select throws_ok(
  $$select public.upsert_commerce_category(
      (select id from public.commerce_categories where slug='sofas'),
      'Sofas','sofas',
      (select id from public.commerce_categories where slug='beds'),
      'Living seating',null,null,10,null,null,null,'9d000000-0000-0000-0000-000000000016')$$,
  '22023',
  NULL,
  'root that already has a child cannot be reparented under another root'
);

select lives_ok(
  $$select public.upsert_commerce_category(
      (select id from public.commerce_categories where slug='sectionals'),
      'Sectionals','sectionals',
      null,null,null,null,1,null,null,null,'9d000000-0000-0000-0000-000000000017')$$,
  'child without descendants can be promoted back to a root'
);

select lives_ok(
  $$select public.upsert_commerce_category(
      (select id from public.commerce_categories where slug='sofas'),
      'Sofas','sofas',
      (select id from public.commerce_categories where slug='beds'),
      'Living seating',null,null,10,null,null,null,'9d000000-0000-0000-0000-000000000018')$$,
  'childless root may become a subcategory of another root'
);

select throws_ok(
  $$select public.upsert_commerce_category(
      (select id from public.commerce_categories where slug='beds'),
      'Beds','beds',
      (select id from public.commerce_categories where slug='sofas'),
      null,null,null,2,null,null,null,'9d000000-0000-0000-0000-000000000019')$$,
  '22023',
  NULL,
  'cycle via reparenting a parent under its child is rejected'
);

select ok(
  (select public.create_commerce_product(
    (select id from public.commerce_categories where slug='sofas'),
    'Linen Sofa','linen-sofa','Short linen sofa','Full linen sofa description',
    '9d000000-0000-0000-0000-000000000020'
  )->>'product_reference') ~ '^OD-P-[0-9]{4}-[0-9]{6}$',
  'SA creates product draft with OD-P reference'
);

select throws_ok(
  $$select public.publish_commerce_product(
      (select id from public.commerce_products where slug='linen-sofa'),
      1,
      '9d000000-0000-0000-0000-000000000021')$$,
  '22023',
  NULL,
  'publish fails closed without variant, tax, and primary image'
);

select lives_ok(
  $$select public.upsert_commerce_product_variant(
      null,
      (select id from public.commerce_products where slug='linen-sofa'),
      'od-sofa-linen-01',
      '{"color":"ivory","size":"3-seater"}'::jsonb,
      'Ivory 3-seater',
      2499900,
      2999900,
      'ready_stock',
      0,
      '9d000000-0000-0000-0000-000000000022')$$,
  'SA can create a simple-option variant in paise'
);

select throws_ok(
  $$select public.upsert_commerce_product_variant(
      null,
      (select id from public.commerce_products where slug='linen-sofa'),
      'od-sofa-bad-options',
      '{"material":"teak","color":["red"]}'::jsonb,
      'Bad',
      100,
      null,
      'ready_stock',
      1,
      '9d000000-0000-0000-0000-000000000023')$$,
  '22023',
  NULL,
  'unknown or nested option_values are denied'
);

select throws_ok(
  $$select public.upsert_commerce_product_variant(
      null,
      (select id from public.commerce_products where slug='linen-sofa'),
      'od-sofa-linen-01',
      '{}'::jsonb,
      'Dup',
      100,
      null,
      'made_to_order',
      2,
      '9d000000-0000-0000-0000-000000000024')$$,
  '23505',
  NULL,
  'SKU is unique'
);

select throws_ok(
  $$select public.upsert_commerce_product_variant(
      null,
      (select id from public.commerce_products where slug='linen-sofa'),
      'od-neg-price',
      '{}'::jsonb,
      'Neg',
      -1,
      null,
      'ready_stock',
      3,
      '9d000000-0000-0000-0000-000000000025')$$,
  '23514',
  NULL,
  'negative selling price paise is denied'
);

select is(
  (select count(*)::integer from public.commerce_inventory i
   join public.commerce_product_variants v on v.id = i.variant_id
   where v.sku = 'od-sofa-linen-01'),
  1,
  'each variant has exactly one inventory row'
);

select throws_ok(
  $$select public.adjust_commerce_inventory(
      (select id from public.commerce_product_variants where sku='od-sofa-linen-01'),
      -1,
      'underflow',
      '9d000000-0000-0000-0000-000000000026')$$,
  '22023',
  NULL,
  'inventory underflow is blocked'
);

select is(
  public.adjust_commerce_inventory(
    (select id from public.commerce_product_variants where sku='od-sofa-linen-01'),
    4,
    'opening-count',
    '9d000000-0000-0000-0000-000000000027'
  )->>'stock_on_hand',
  '4',
  'signed inventory delta updates stock_on_hand'
);

select lives_ok(
  $$select public.upsert_commerce_tax_rate(null,'standard','Staff configured rate',1800,'not a statutory seed',true,'9d000000-0000-0000-0000-000000000030')$$,
  'SA may create a staff-configured tax rate'
);

select lives_ok(
  $$select public.update_commerce_product(
      (select id from public.commerce_products where slug='linen-sofa'),
      (select id from public.commerce_categories where slug='sofas'),
      'Linen Sofa','linen-sofa','Short linen sofa','Full linen sofa description',
      (select id from public.commerce_tax_rates where code='standard'),
      '9403',null,null,null,null,null,false,1,'9d000000-0000-0000-0000-000000000031')$$,
  'SA can attach an active tax rate to a draft product'
);

select lives_ok(
  $$select public.authorize_commerce_product_media_upload(
      (select id from public.commerce_products where slug='linen-sofa'),
      null,'Primary sofa image',true,0,'9d000000-0000-0000-0000-000000000032')$$,
  'SA can authorize product media'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"9d333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select original_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      '9d000000-0000-0000-0000-000000000132')$$,
  '42501',
  NULL,
  'unauthorized staff cannot finalize product media'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select original_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      '9d000000-0000-0000-0000-000000000033')$$,
  '22023',
  NULL,
  'finalize without storage objects is rejected'
);

reset role;
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select 'commerce-product-originals', m.original_path, '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111', '{}'::jsonb
from public.commerce_product_media m
join public.commerce_products p on p.id = m.product_id
where p.slug = 'linen-sofa'
order by m.created_at
limit 1;
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select original_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      '9d000000-0000-0000-0000-000000000133')$$,
  '22023',
  NULL,
  'finalize with original object only is rejected'
);

reset role;
update storage.objects o
   set name = m.original_path || '.held-aside'
  from public.commerce_product_media m
  join public.commerce_products p on p.id = m.product_id
 where p.slug = 'linen-sofa'
   and o.bucket_id = 'commerce-product-originals'
   and o.name = m.original_path;
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select 'commerce-product-public', m.public_path, '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111', '{}'::jsonb
from public.commerce_product_media m
join public.commerce_products p on p.id = m.product_id
where p.slug = 'linen-sofa'
order by m.created_at
limit 1;
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select original_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      '9d000000-0000-0000-0000-000000000233')$$,
  '22023',
  NULL,
  'finalize with public object only is rejected'
);

select throws_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      'wrong/path/original',
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      '9d000000-0000-0000-0000-000000000333')$$,
  '22023',
  NULL,
  'finalize with mismatched paths is rejected'
);

reset role;
update storage.objects o
   set name = m.original_path
  from public.commerce_product_media m
  join public.commerce_products p on p.id = m.product_id
 where p.slug = 'linen-sofa'
   and o.bucket_id = 'commerce-product-originals'
   and o.name = m.original_path || '.held-aside';
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select original_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') order by created_at limit 1),
      '9d000000-0000-0000-0000-000000000034')$$,
  'finalize succeeds when both exact storage objects exist'
);

select is(
  (select count(*)::integer from public.commerce_product_media
   where product_id = (select id from public.commerce_products where slug='linen-sofa')
     and is_primary and status = 'active'),
  1,
  'exactly one active primary image per product'
);

select lives_ok(
  $$select public.authorize_commerce_product_media_upload(
      (select id from public.commerce_products where slug='linen-sofa'),
      null,'Replacement sofa image',true,1,'9d000000-0000-0000-0000-000000000035')$$,
  'SA can authorize a second primary candidate'
);

select throws_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') and status = 'archived' order by created_at desc limit 1),
      (select original_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') and status = 'archived' order by created_at desc limit 1),
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') and status = 'archived' order by created_at desc limit 1),
      '9d000000-0000-0000-0000-000000000036')$$,
  '22023',
  NULL,
  'failed replacement finalization does not activate the new row'
);

select is(
  (select count(*)::integer from public.commerce_product_media
   where product_id = (select id from public.commerce_products where slug='linen-sofa')
     and is_primary and status = 'active'),
  1,
  'existing active primary is preserved when replacement finalization fails'
);

reset role;
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select m.original_bucket, m.original_path, '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111', '{}'::jsonb
from public.commerce_product_media m
join public.commerce_products p on p.id = m.product_id
where p.slug = 'linen-sofa' and m.status = 'archived'
order by m.created_at desc
limit 1;
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
select m.public_bucket, m.public_path, '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111', '{}'::jsonb
from public.commerce_product_media m
join public.commerce_products p on p.id = m.product_id
where p.slug = 'linen-sofa' and m.status = 'archived'
order by m.created_at desc
limit 1;
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.finalize_commerce_product_media(
      (select id from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') and status = 'archived' order by created_at desc limit 1),
      (select original_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') and status = 'archived' order by created_at desc limit 1),
      (select public_path from public.commerce_product_media where product_id = (select id from public.commerce_products where slug='linen-sofa') and status = 'archived' order by created_at desc limit 1),
      '9d000000-0000-0000-0000-000000000037')$$,
  'successful replacement finalization activates the new primary'
);

select is(
  (select count(*)::integer from public.commerce_product_media
   where product_id = (select id from public.commerce_products where slug='linen-sofa')
     and is_primary and status = 'active'),
  1,
  'replacement primary demotes the previous primary'
);

select lives_ok(
  $$select public.publish_commerce_product(
      (select id from public.commerce_products where slug='linen-sofa'),
      2,
      '9d000000-0000-0000-0000-000000000034')$$,
  'publish succeeds when category, variant, tax, and primary image are ready'
);

select lives_ok(
  $$select public.create_commerce_product(
      (select id from public.commerce_categories where slug='sofas'),
      'Related Ottoman','related-ottoman','Short ottoman','Ottoman text',
      '9d000000-0000-0000-0000-000000000040')$$,
  'second product exists for related-product tests'
);

select throws_ok(
  $$select public.replace_commerce_related_products(
      (select id from public.commerce_products where slug='linen-sofa'),
      ARRAY[(select id from public.commerce_products where slug='linen-sofa')],
      '9d000000-0000-0000-0000-000000000041')$$,
  '22023',
  NULL,
  'related products cannot be self'
);

select lives_ok(
  $$select public.replace_commerce_related_products(
      (select id from public.commerce_products where slug='linen-sofa'),
      ARRAY[(select id from public.commerce_products where slug='related-ottoman')],
      '9d000000-0000-0000-0000-000000000042')$$,
  'manual related-product pair is accepted'
);

select throws_ok(
  $$insert into public.commerce_related_products (product_id, related_product_id, sort_order)
    values (
      (select id from public.commerce_products where slug='linen-sofa'),
      (select id from public.commerce_products where slug='related-ottoman'),
      9
    )$$,
  '42501',
  NULL,
  'direct related-product insert is denied'
);

select lives_ok(
  $$select public.upsert_commerce_pincode('411001', true, 'west', 3, 7, '9d000000-0000-0000-0000-000000000050')$$,
  'six-digit pincode upsert succeeds'
);

select throws_ok(
  $$select public.upsert_commerce_pincode('4110', true, 'west', 3, 7, '9d000000-0000-0000-0000-000000000051')$$,
  '23514',
  NULL,
  'non-six-digit pincode is rejected'
);

select throws_ok(
  $$select public.upsert_commerce_pincode('411002', true, 'west', 9, 2, '9d000000-0000-0000-0000-000000000052')$$,
  '23514',
  NULL,
  'ETA min greater than max is rejected'
);

select lives_ok(
  $$select public.update_commerce_shipping_settings(49900, 199900, true, 'Assembly on request', '9d000000-0000-0000-0000-000000000053')$$,
  'SA can update shipping settings in paise'
);

select throws_ok(
  $$select public.update_commerce_shipping_settings(-1, null, true, null, '9d000000-0000-0000-0000-000000000054')$$,
  '23514',
  NULL,
  'negative shipping charge is rejected'
);

select lives_ok(
  $$select public.set_commerce_category_status(
      (select id from public.commerce_categories where slug='sofas'),
      'archived',
      '9d000000-0000-0000-0000-000000000060')$$,
  'archiving a category does not delete products'
);

select is(
  (select count(*)::integer from public.commerce_products where slug = 'linen-sofa'),
  1,
  'archived category still referenced by products'
);

select lives_ok(
  $$select public.replace_commerce_product_specifications(
      (select id from public.commerce_products where slug='linen-sofa'),
      '[{"key":"width","value":"210 cm","sort_order":0}]'::jsonb,
      '9d000000-0000-0000-0000-000000000061')$$,
  'specifications are simple key/value rows'
);

select is(
  (select count(*)::integer from public.leads)
  + (select count(*)::integer from public.contacts)
  + (select count(*)::integer from public.projects)
  + (select count(*)::integer from public.campaigns)
  + (select count(*)::integer from public.consent_events),
  0,
  'commerce foundation mutations do not create CRM/project/campaign/consent rows'
);

reset role;
select * from finish();
rollback;
