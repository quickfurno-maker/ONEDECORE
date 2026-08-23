-- ONEDECORE Phase 9D-D1 COD order engine pgTAP

begin;
select plan(90);

select has_table('public', 'commerce_orders', 'commerce_orders exists');
select has_table('public', 'commerce_order_items', 'commerce_order_items exists');
select has_table('public', 'commerce_order_delivery', 'commerce_order_delivery exists');
select has_table('public', 'commerce_order_events', 'commerce_order_events exists');
select hasnt_table('public', 'commerce_payments', 'no commerce_payments in D1');
select hasnt_table('public', 'commerce_payment_events', 'no commerce_payment_events in D1');

select has_function('public', 'quote_public_commerce_cart', 'quote rpc exists');
select has_function('public', 'create_public_commerce_cod_order', 'cod create rpc exists');
select has_function('public', 'verify_public_commerce_order_tracking_identity', 'tracking verify exists');
select has_function('public', 'get_public_commerce_order_tracking_snapshot', 'tracking snapshot exists');
select has_function('public', 'consume_commerce_public_rate_limit', 'rate limit rpc exists');
select has_function('public', 'transition_commerce_order_fulfilment', 'fulfilment rpc exists');
select has_function('public', 'cancel_commerce_order', 'cancel rpc exists');

select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'commerce_orders','commerce_order_items','commerce_order_delivery','commerce_order_events'
     )),
  'FORCE RLS on D1 order tables'
);

select is(
  (select has_table_privilege('anon', 'public.commerce_orders', 'select')),
  false,
  'anon has no raw SELECT on commerce_orders'
);

select is(
  (select has_function_privilege('anon', 'quote_public_commerce_cart(jsonb,text,text)', 'execute')),
  false,
  'anon cannot execute quote rpc'
);
select is(
  (select has_function_privilege('authenticated', 'create_public_commerce_cod_order(jsonb,jsonb,jsonb,uuid)', 'execute')),
  false,
  'authenticated cannot execute guest COD create'
);
select is(
  (select has_function_privilege('service_role', 'create_public_commerce_cod_order(jsonb,jsonb,jsonb,uuid)', 'execute')),
  true,
  'service_role can execute guest COD create'
);
select is(
  (select has_function_privilege('anon', 'verify_public_commerce_order_tracking_identity(text,text)', 'execute')),
  false,
  'anon cannot execute tracking verify'
);
select is(
  (select has_function_privilege('authenticated', 'transition_commerce_order_fulfilment(uuid,text,text,uuid)', 'execute')),
  true,
  'authenticated can execute fulfilment rpc'
);

select has_function(
  'private',
  'commerce_public_rate_limit_xact_lock',
  'rate-limit advisory lock helper exists'
);
select is(
  (select has_function_privilege(
     'anon',
     'private.commerce_public_rate_limit_xact_lock(text,text,text)',
     'execute'
   )),
  false,
  'anon cannot execute rate-limit lock helper'
);
select is(
  (select has_function_privilege(
     'authenticated',
     'private.commerce_public_rate_limit_xact_lock(text,text,text)',
     'execute'
   )),
  false,
  'authenticated cannot execute rate-limit lock helper'
);
select is(
  (select has_function_privilege('anon', 'consume_commerce_public_rate_limit(text,text,text)', 'execute')),
  false,
  'anon cannot execute rate-limit rpc'
);
select is(
  (select has_function_privilege('authenticated', 'consume_commerce_public_rate_limit(text,text,text)', 'execute')),
  false,
  'authenticated cannot execute rate-limit rpc'
);
select is(
  (select has_function_privilege('service_role', 'consume_commerce_public_rate_limit(text,text,text)', 'execute')),
  true,
  'service_role can execute rate-limit rpc'
);

select ok(
  (
    select bool_and(not has_table_privilege('service_role', format('public.%I', t), 'insert'))
    from unnest(array[
      'commerce_orders','commerce_order_items','commerce_order_delivery','commerce_order_events'
    ]) as t
  ),
  'service_role has no INSERT on order tables'
);
select ok(
  (
    select bool_and(not has_table_privilege('service_role', format('public.%I', t), 'update'))
    from unnest(array[
      'commerce_orders','commerce_order_items','commerce_order_delivery','commerce_order_events'
    ]) as t
  ),
  'service_role has no UPDATE on order tables'
);
select ok(
  (
    select bool_and(not has_table_privilege('service_role', format('public.%I', t), 'delete'))
    from unnest(array[
      'commerce_orders','commerce_order_items','commerce_order_delivery','commerce_order_events'
    ]) as t
  ),
  'service_role has no DELETE on order tables'
);

select ok(
  (
    select bool_and(pg_get_userbyid(p.proowner) = 'postgres')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'quote_public_commerce_cart',
        'create_public_commerce_cod_order',
        'verify_public_commerce_order_tracking_identity',
        'get_public_commerce_order_tracking_snapshot',
        'consume_commerce_public_rate_limit',
        'transition_commerce_order_fulfilment',
        'cancel_commerce_order'
      )
  ),
  'all seven public M37 RPCs are owned by postgres'
);
select ok(
  (
    select bool_and(p.prosecdef)
      and count(*) = 7
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'quote_public_commerce_cart',
        'create_public_commerce_cod_order',
        'verify_public_commerce_order_tracking_identity',
        'get_public_commerce_order_tracking_snapshot',
        'consume_commerce_public_rate_limit',
        'transition_commerce_order_fulfilment',
        'cancel_commerce_order'
      )
  ),
  'all seven public M37 RPCs are SECURITY DEFINER'
);
select ok(
  (
    select bool_and(
      pg_get_functiondef(p.oid) like '%SET search_path TO ''''%'
      or pg_get_functiondef(p.oid) like '%SET search_path = ''''%'
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'quote_public_commerce_cart',
        'create_public_commerce_cod_order',
        'verify_public_commerce_order_tracking_identity',
        'get_public_commerce_order_tracking_snapshot',
        'consume_commerce_public_rate_limit',
        'transition_commerce_order_fulfilment',
        'cancel_commerce_order'
      )
  ),
  'all seven public M37 RPCs use empty search_path'
);

select ok(
  (
    select pg_get_constraintdef(oid) ilike '%commerce_option_values_valid%'
       and pg_get_constraintdef(oid) ilike '%pg_column_size%'
    from pg_constraint
    where conrelid = 'public.commerce_order_items'::regclass
      and conname = 'chk_commerce_order_items_options'
  ),
  'order item option_values are structurally bounded'
);
select ok(
  (
    select pg_get_constraintdef(oid) ilike '%eta_min_days >= 0%'
       and pg_get_constraintdef(oid) ilike '%eta_max_days >= eta_min_days%'
    from pg_constraint
    where conrelid = 'public.commerce_order_delivery'::regclass
      and conname = 'chk_commerce_order_delivery_eta'
  ),
  'delivery ETA requires nonnegative min and max >= min'
);

-- Seed staff identities first so catalogue created_by FKs resolve
insert into auth.users (id, instance_id, email, aud, role) values
  ('9d111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_9d@onedecore.in', 'authenticated', 'authenticated'),
  ('9d222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm_9d@onedecore.in', 'authenticated', 'authenticated'),
  ('9d333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_9d@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;
update public.profiles set status = 'active' where id in (
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

-- Seed catalogue as postgres
insert into public.commerce_tax_rates (id, code, name, rate_basis_points, is_active, created_by, updated_by)
values ('a1111111-1111-4111-8111-111111111111', 'GST18', 'GST 18', 1800, true,
  '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111')
on conflict do nothing;

insert into public.commerce_categories (
  id, category_reference, name, slug, status, created_by, updated_by
) values (
  'b1111111-1111-4111-8111-111111111111', 'OD-CC-2026-900001', 'Beds D1', 'beds-d1', 'active',
  '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111'
) on conflict do nothing;

insert into public.commerce_products (
  id, product_reference, category_id, name, slug, status, tax_rate_id, hsn_sac_code,
  created_by, updated_by, published_at
) values (
  'c1111111-1111-4111-8111-111111111111', 'OD-P-2026-900001',
  'b1111111-1111-4111-8111-111111111111', 'Oak Bed', 'oak-bed-d1', 'published',
  'a1111111-1111-4111-8111-111111111111', '9403',
  '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111', now()
), (
  'c2222222-2222-4222-8222-222222222222', 'OD-P-2026-900002',
  'b1111111-1111-4111-8111-111111111111', 'MTO Sofa', 'mto-sofa-d1', 'published',
  'a1111111-1111-4111-8111-111111111111', '9403',
  '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111', now()
)
on conflict do nothing;

insert into public.commerce_product_variants (
  id, product_id, sku, option_values, display_name, selling_price_paise, compare_at_price_paise,
  availability_mode, status, created_by, updated_by
) values (
  'd1111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111',
  'd1-bed-oak', '{"color":"oak"}'::jsonb, 'Oak', 118000, 130000, 'ready_stock', 'active',
  '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111'
), (
  'd2222222-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222',
  'd1-sofa-mto', '{"color":"sand"}'::jsonb, 'Sand', 200000, null, 'made_to_order', 'active',
  '9d111111-1111-1111-1111-111111111111', '9d111111-1111-1111-1111-111111111111'
)
on conflict do nothing;

insert into public.commerce_inventory (variant_id, stock_on_hand, reserved_qty)
values
  ('d1111111-1111-4111-8111-111111111111', 2, 0),
  ('d2222222-2222-4222-8222-222222222222', 7, 1)
on conflict (variant_id) do update
set stock_on_hand = excluded.stock_on_hand, reserved_qty = excluded.reserved_qty;

insert into public.commerce_product_media (
  id, product_id, original_bucket, original_path, public_bucket, public_path,
  status, is_primary, sort_order, created_by
) values (
  'e1111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111',
  'commerce-product-originals', 'orig/bed.webp', 'commerce-product-public', 'pub/bed.webp',
  'active', true, 0, '9d111111-1111-1111-1111-111111111111'
) on conflict do nothing;

insert into public.commerce_pincodes (pincode, serviceable, zone_code, eta_min_days, eta_max_days)
values ('411001', true, 'PUNE', 3, 7)
on conflict (pincode) do update
set serviceable = true, eta_min_days = 3, eta_max_days = 7;

update public.commerce_shipping_settings
set default_shipping_charge_paise = 5000,
    free_shipping_threshold_paise = 500000,
    cod_enabled_global = true,
    assembly_install_note = 'Assembly on request'
where id = 1;

select is(
  private.commerce_inclusive_tax_paise(118000, 1800),
  18000::bigint,
  'GST-inclusive tax uses numeric half-up: 118000 * 1800 / 11800 = 18000'
);

select ok(
  (select quote_public_commerce_cart(
     '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '411001', 'cod'
   )->>'total_paise')::bigint = 123000,
  'quote merchandise + default shipping'
);

select ok(
  (select quote_public_commerce_cart(
     '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '411001', null
   )::text not like '%stock_on_hand%'
   and quote_public_commerce_cart(
     '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '411001', null
   )::text not like '%available_qty%'
   and quote_public_commerce_cart(
     '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '411001', null
   )::text not like '%variant_id%'),
  'quote does not expose stock or internal ids'
);

select is(
  (select stock_on_hand from public.commerce_inventory where variant_id = 'd1111111-1111-4111-8111-111111111111'),
  2,
  'quote does not reserve or decrement inventory'
);

select throws_ok(
  $$select quote_public_commerce_cart('[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '000000', 'cod')$$,
  '22023',
  'COMMERCE_ORDER_NOT_SERVICEABLE',
  'unknown pincode is not serviceable'
);

select throws_ok(
  $$select quote_public_commerce_cart('[{"sku":"missing-sku","quantity":1}]'::jsonb, '411001', 'cod')$$,
  '22023',
  'COMMERCE_ORDER_UNAVAILABLE',
  'unknown sku is unavailable'
);

-- Product override shipping
update public.commerce_products
set shipping_charge_paise_override = 900
where id = 'c1111111-1111-4111-8111-111111111111';

select is(
  (select quote_public_commerce_cart(
     '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '411001', 'cod'
   )->>'shipping_paise')::bigint,
  900::bigint,
  'product shipping override wins over global'
);

update public.commerce_products set shipping_charge_paise_override = null
where id = 'c1111111-1111-4111-8111-111111111111';
update public.commerce_categories set shipping_charge_paise_override = 1200
where id = 'b1111111-1111-4111-8111-111111111111';

select is(
  (select quote_public_commerce_cart(
     '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '411001', 'cod'
   )->>'shipping_paise')::bigint,
  1200::bigint,
  'category shipping override wins over global when product override is null'
);

update public.commerce_categories set shipping_charge_paise_override = null
where id = 'b1111111-1111-4111-8111-111111111111';

update public.commerce_products set cod_allowed_override = false
where id = 'c1111111-1111-4111-8111-111111111111';
select throws_ok(
  $$select quote_public_commerce_cart('[{"sku":"d1-bed-oak","quantity":1}]'::jsonb, '411001', 'cod')$$,
  '22023',
  'COMMERCE_COD_UNAVAILABLE',
  'product COD override false fails COD quote'
);
update public.commerce_products set cod_allowed_override = null
where id = 'c1111111-1111-4111-8111-111111111111';

-- COD create ready-stock
select lives_ok(
  $$select create_public_commerce_cod_order(
      '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb,
      '{"name":"Guest Buyer","mobile":"+919811112222"}'::jsonb,
      '{"recipient_name":"Guest Buyer","mobile":"+919811112222","address_line_1":"12 FC Road","locality":"Shivajinagar","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
      '11111111-1111-4111-8111-111111111111'
    )$$,
  'COD create succeeds for ready-stock'
);

select is(
  (select stock_on_hand from public.commerce_inventory where variant_id = 'd1111111-1111-4111-8111-111111111111'),
  1,
  'ready-stock stock_on_hand decrements by qty'
);
select is(
  (select reserved_qty from public.commerce_inventory where variant_id = 'd1111111-1111-4111-8111-111111111111'),
  0,
  'COD leaves reserved_qty unchanged'
);
select is(
  (select count(*)::integer from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
  1,
  'exactly one order after first COD'
);
select is(
  (select status from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
  'confirmed',
  'COD order starts confirmed'
);
select is(
  (select contact_id is null from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
  true,
  'D1 does not create or attach a contact'
);
select is(
  (select count(*)::integer
   from public.commerce_order_events e
   join public.commerce_orders o on o.id = e.order_id
   where e.event_code = 'order_confirmed_cod'
     and o.customer_mobile_e164 = '+919811112222'),
  1,
  'order_confirmed_cod event appended'
);

select is(
  (select create_public_commerce_cod_order(
      '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb,
      '{"name":"Guest Buyer","mobile":"+919811112222"}'::jsonb,
      '{"recipient_name":"Guest Buyer","mobile":"+919811112222","address_line_1":"12 FC Road","locality":"Shivajinagar","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
      '11111111-1111-4111-8111-111111111111'
    )->>'order_reference'),
  (select order_reference from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
  'same idempotency key replays the same order'
);
select is(
  (select count(*)::integer from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
  1,
  'replay does not create a second order'
);

select throws_ok(
  $$select create_public_commerce_cod_order(
      '[{"sku":"d1-sofa-mto","quantity":1}]'::jsonb,
      '{"name":"Guest Buyer","mobile":"+919811112222"}'::jsonb,
      '{"recipient_name":"Guest Buyer","mobile":"+919811112222","address_line_1":"12 FC Road","locality":"Shivajinagar","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
      '11111111-1111-4111-8111-111111111111'
    )$$,
  '22023',
  'IDEMPOTENCY_KEY_REUSED',
  'same key different request is rejected'
);

-- Insufficient remaining stock
select throws_ok(
  $$select create_public_commerce_cod_order(
      '[{"sku":"d1-bed-oak","quantity":2}]'::jsonb,
      '{"name":"Second Guest","mobile":"+919822223333"}'::jsonb,
      '{"recipient_name":"Second Guest","mobile":"+919822223333","address_line_1":"14 JM Road","locality":"Deccan","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
      '22222222-2222-4222-8222-222222222222'
    )$$,
  '22023',
  'COMMERCE_INVENTORY_UNAVAILABLE',
  'qty above available_qty is rejected'
);

-- Multi-line atomic rollback: second sku qty exceeds remaining ready-stock
select throws_ok(
  $$select create_public_commerce_cod_order(
      '[{"sku":"d1-sofa-mto","quantity":1},{"sku":"d1-bed-oak","quantity":2}]'::jsonb,
      '{"name":"Third Guest","mobile":"+919833334444"}'::jsonb,
      '{"recipient_name":"Third Guest","mobile":"+919833334444","address_line_1":"16 Baner Road","locality":"Baner","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
      '33333333-3333-4333-8333-333333333333'
    )$$,
  '22023',
  'COMMERCE_INVENTORY_UNAVAILABLE',
  'multi-line failure rolls back'
);
select is(
  (select stock_on_hand from public.commerce_inventory where variant_id = 'd2222222-2222-4222-8222-222222222222'),
  7,
  'failed multi-line order does not mutate MTO stock'
);
select is(
  (select stock_on_hand from public.commerce_inventory where variant_id = 'd1111111-1111-4111-8111-111111111111'),
  1,
  'failed multi-line order does not further decrement ready-stock'
);

-- MTO success, no decrement
select lives_ok(
  $$select create_public_commerce_cod_order(
      '[{"sku":"d1-sofa-mto","quantity":1}]'::jsonb,
      '{"name":"MTO Guest","mobile":"+919844445555"}'::jsonb,
      '{"recipient_name":"MTO Guest","mobile":"+919844445555","address_line_1":"18 Koregaon","locality":"Koregaon Park","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
      '44444444-4444-4444-8444-444444444444'
    )$$,
  'MTO COD succeeds'
);
select is(
  (select stock_on_hand from public.commerce_inventory where variant_id = 'd2222222-2222-4222-8222-222222222222'),
  7,
  'MTO does not decrement stock_on_hand'
);
select is(
  (select reserved_qty from public.commerce_inventory where variant_id = 'd2222222-2222-4222-8222-222222222222'),
  1,
  'MTO does not change reserved_qty'
);

select ok(
  (select order_reference ~ '^OD-O-[0-9]{4}-[0-9]{6}$' from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
  'order_reference matches OD-O-YYYY-SEQ6'
);

-- Snapshot immutability
select throws_ok(
  $$update public.commerce_order_items set product_name = 'Mutated'$$,
  '22023',
  'COMMERCE_ORDER_VALIDATION',
  'order items reject UPDATE'
);
select throws_ok(
  $$delete from public.commerce_order_delivery$$,
  '22023',
  'COMMERCE_ORDER_VALIDATION',
  'delivery rejects DELETE'
);
select throws_ok(
  $$update public.commerce_order_events set event_code = 'order_shipped'$$,
  '22023',
  'COMMERCE_ORDER_VALIDATION',
  'events reject UPDATE'
);

update public.commerce_products set name = 'Renamed after order' where id = 'c1111111-1111-4111-8111-111111111111';
select is(
  (select product_name from public.commerce_order_items where sku = 'd1-bed-oak' limit 1),
  'Oak Bed',
  'later product rename does not change item snapshot'
);

-- Tracking
select is(
  (select verify_public_commerce_order_tracking_identity(
     (select order_reference from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
     '+919811112222'
   )->>'matched')::boolean,
  true,
  'combined order+mobile match succeeds'
);
select is(
  (select verify_public_commerce_order_tracking_identity(
     (select order_reference from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
     '+919800000000'
   )->>'matched')::boolean,
  false,
  'wrong mobile is a non-enumerating miss'
);
select is(
  (select verify_public_commerce_order_tracking_identity('OD-O-2099-000000', '+919811112222')->>'matched')::boolean,
  false,
  'unknown reference is a non-enumerating miss'
);

-- No CRM / marketing / project side effects
select is((select count(*)::integer from public.leads), 0, 'COD create does not insert leads');
select is((select count(*)::integer from public.consent_events), 0, 'COD create does not insert consent_events');
select ok(
  not exists (select 1 from public.projects),
  'COD create does not insert projects'
);

-- RLS: unauthorized auth sees zero
select set_config('request.jwt.claims', '{"sub":"9d333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.commerce_orders), 0, 'sales_executive sees zero orders');
reset role;

select set_config('request.jwt.claims', '{"sub":"9d222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*)::integer from public.commerce_orders) >= 1, 'commerce.read staff can select orders');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select * from public.commerce_orders$$,
  '42501',
  NULL,
  'anon raw SELECT on orders denied'
);
select throws_ok(
  $$select create_public_commerce_cod_order(
      '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb,
      '{"name":"X","mobile":"+919811112222"}'::jsonb,
      '{"recipient_name":"X","mobile":"+919811112222","address_line_1":"12 FC Road","locality":"A","city":"Pune","state":"MH","pincode":"411001"}'::jsonb,
      '55555555-5555-4555-8555-555555555555'
    )$$,
  '42501',
  NULL,
  'anon cannot execute COD create'
);
reset role;

-- Fulfilment + cancel
select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select transition_commerce_order_fulfilment(
      (select id from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
      'processing', null, '66666666-6666-4666-8666-666666666666'
    )$$,
  'confirmed -> processing'
);
select throws_ok(
  $$select transition_commerce_order_fulfilment(
      (select id from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
      'delivered', null, '77777777-7777-4777-8777-777777777777'
    )$$,
  '22023',
  'COMMERCE_ORDER_TRANSITION_INVALID',
  'skipping to delivered is rejected'
);
select lives_ok(
  $$select transition_commerce_order_fulfilment(
      (select id from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
      'shipped', 'TRK-1', '88888888-8888-4888-8888-888888888888'
    )$$,
  'processing -> shipped'
);
select throws_ok(
  $$select cancel_commerce_order(
      (select id from public.commerce_orders where customer_mobile_e164 = '+919811112222'),
      'customer_request', '99999999-9999-4999-8999-999999999999'
    )$$,
  '22023',
  'COMMERCE_ORDER_TRANSITION_INVALID',
  'shipped order cannot be cancelled'
);

select lives_ok(
  $$select cancel_commerce_order(
      (select id from public.commerce_orders where customer_mobile_e164 = '+919844445555'),
      'customer_request', 'aaaaaaa1-aaa1-4aa1-8aa1-aaaaaaaaaaa1'
    )$$,
  'MTO confirmed order can cancel'
);
reset role;

select is(
  (select stock_on_hand from public.commerce_inventory where variant_id = 'd2222222-2222-4222-8222-222222222222'),
  7,
  'MTO cancel does not restock'
);

-- Ready-stock cancel + single restock
select lives_ok(
  $$select create_public_commerce_cod_order(
      '[{"sku":"d1-bed-oak","quantity":1}]'::jsonb,
      '{"name":"Cancel Guest","mobile":"+919855556666"}'::jsonb,
      '{"recipient_name":"Cancel Guest","mobile":"+919855556666","address_line_1":"20 Law College","locality":"Erandwane","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
      'bbbbbbb1-bbb1-4bb1-8bb1-bbbbbbbbbbb1'
    )$$,
  'second ready-stock order for cancel restock'
);

select set_config('request.jwt.claims', '{"sub":"9d111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select cancel_commerce_order(
      (select id from public.commerce_orders where customer_mobile_e164 = '+919855556666'),
      'out_of_stock', 'ccccccc1-ccc1-4cc1-8cc1-ccccccccccc1'
    )$$,
  'ready-stock cancel restocks'
);
select is(
  (select cancel_commerce_order(
      (select id from public.commerce_orders where customer_mobile_e164 = '+919855556666'),
      'out_of_stock', 'ccccccc1-ccc1-4cc1-8cc1-ccccccccccc1'
    )->>'status'),
  'cancelled',
  'cancel replay returns same snapshot'
);
reset role;

select is(
  (select stock_on_hand from public.commerce_inventory where variant_id = 'd1111111-1111-4111-8111-111111111111'),
  1,
  'ready-stock cancel restocks once even after replay'
);

-- Rate limit
select is(
  (select consume_commerce_public_rate_limit(
     'track',
     repeat('a', 64),
     repeat('b', 64)
   )->>'allowed')::boolean,
  true,
  'first hashed track attempt is allowed'
);

select ok(
  (
    select bool_and((consume_commerce_public_rate_limit('quote', repeat('c', 64), null)->>'allowed')::boolean)
    from generate_series(1, 60)
  ),
  'quote stays allowed under the 60 / 15-minute network cap'
);
select is(
  (select consume_commerce_public_rate_limit('quote', repeat('c', 64), null)->>'allowed')::boolean,
  false,
  '61st quote attempt is rate limited'
);
select ok(
  (select (consume_commerce_public_rate_limit('quote', repeat('c', 64), null)->>'retry_after_seconds')::integer > 0),
  'blocked quote returns retry_after_seconds'
);

select throws_ok(
  $$select consume_commerce_public_rate_limit('track', 'not-a-hash', null)$$,
  '22023',
  'COMMERCE_ORDER_VALIDATION',
  'rate-limit hash format is validated'
);

select * from finish();
rollback;
