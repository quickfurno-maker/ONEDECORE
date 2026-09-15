-- ONEDECORE e-commerce checkout policy acceptance pgTAP
begin;
select plan(16);

select has_table('public', 'commerce_order_policy_acceptances', 'policy acceptance table exists');
select has_function('public', 'create_public_commerce_cod_order_v2', 'COD v2 policy-aware RPC exists');

select ok(
  (select c.relrowsecurity and c.relforcerowsecurity
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='commerce_order_policy_acceptances'),
  'policy acceptance table has FORCE RLS'
);

select is(has_table_privilege('anon','public.commerce_order_policy_acceptances','select'), false,
  'anon cannot read policy acceptance');
select is(has_table_privilege('service_role','public.commerce_order_policy_acceptances','insert'), false,
  'service_role cannot insert policy acceptance directly');
select is(has_table_privilege('authenticated','public.commerce_order_policy_acceptances','insert'), false,
  'authenticated cannot insert policy acceptance directly');
select is(has_table_privilege('authenticated','public.commerce_order_policy_acceptances','update'), false,
  'authenticated cannot update policy acceptance');
select is(has_table_privilege('authenticated','public.commerce_order_policy_acceptances','delete'), false,
  'authenticated cannot delete policy acceptance');

select is(
  has_function_privilege('anon','public.create_public_commerce_cod_order_v2(jsonb,jsonb,jsonb,jsonb,uuid)','execute'),
  false,
  'anon cannot execute COD v2'
);
select is(
  has_function_privilege('authenticated','public.create_public_commerce_cod_order_v2(jsonb,jsonb,jsonb,jsonb,uuid)','execute'),
  false,
  'authenticated cannot execute COD v2'
);
select is(
  has_function_privilege('service_role','public.create_public_commerce_cod_order_v2(jsonb,jsonb,jsonb,jsonb,uuid)','execute'),
  true,
  'service_role can execute COD v2'
);

select ok(
  exists(
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='commerce_order_policy_acceptances'
      and t.tgname='trg_commerce_order_policy_acceptances_immutable'
      and not t.tgisinternal
  ),
  'immutable trigger exists'
);

select ok(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='create_public_commerce_cod_order_v2'),
  'COD v2 is SECURITY DEFINER'
);
select is(
  (select pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='create_public_commerce_cod_order_v2'),
  'postgres',
  'COD v2 is postgres-owned'
);

select throws_ok(
  $$select public.create_public_commerce_cod_order_v2(
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{"accepted":false,"bundle_version":"commerce-policy-bundle-v1.0"}'::jsonb,
      gen_random_uuid()
    )$$,
  '22023',
  'COMMERCE_ORDER_VALIDATION',
  'COD v2 rejects checkout without affirmative policy acceptance'
);

select throws_ok(
  $$select public.create_public_commerce_cod_order_v2(
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '{"accepted":true,"bundle_version":"stale","terms_version":"terms-of-use-v1.0","shipping_delivery_version":"commerce-shipping-delivery-v1.0","cancellation_version":"commerce-cancellation-v1.0","returns_refunds_version":"commerce-returns-refunds-v1.0","product_warranty_version":"commerce-product-warranty-v1.0"}'::jsonb,
      gen_random_uuid()
    )$$,
  '22023',
  'COMMERCE_ORDER_VALIDATION',
  'COD v2 rejects stale policy bundle'
);

select * from finish();
rollback;
