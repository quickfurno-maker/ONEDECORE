-- ONEDECORE commerce vendor operational controls pgTAP
begin;
select plan(17);

select has_column('public','commerce_products','vendor_sales_enabled',
  'products expose vendor sales availability');
select is((select column_default from information_schema.columns
  where table_schema='public' and table_name='commerce_products'
    and column_name='vendor_sales_enabled'), 'true',
  'vendor sales availability defaults enabled');

select has_function('public','set_commerce_vendor_status','admin vendor status RPC exists');
select has_function('public','set_my_vendor_product_sales_state','vendor sales-state RPC exists');
select has_function('public','set_my_vendor_inventory_quantity','vendor quantity RPC exists');

select is(has_function_privilege('anon','public.set_commerce_vendor_status(uuid,text,uuid)','execute'), false,
  'anon cannot manage vendor lifecycle');
select is(has_function_privilege('authenticated','public.set_commerce_vendor_status(uuid,text,uuid)','execute'), true,
  'authenticated may invoke permission-checked admin lifecycle RPC');
select is(has_function_privilege('anon','public.set_my_vendor_product_sales_state(uuid,boolean,text,uuid)','execute'), false,
  'anon cannot alter vendor sales state');
select is(has_function_privilege('authenticated','public.set_my_vendor_product_sales_state(uuid,boolean,text,uuid)','execute'), true,
  'authenticated vendor may invoke ownership-checked sales-state RPC');
select is(has_function_privilege('anon','public.set_my_vendor_inventory_quantity(uuid,integer,uuid)','execute'), false,
  'anon cannot alter vendor inventory');
select is(has_function_privilege('authenticated','public.set_my_vendor_inventory_quantity(uuid,integer,uuid)','execute'), true,
  'authenticated vendor may invoke ownership-checked inventory RPC');

select ok(position('private.commerce_require_actor' in pg_get_functiondef(
  'public.set_commerce_vendor_status(uuid,text,uuid)'::regprocedure)) > 0,
  'vendor lifecycle RPC requires admin commerce authority');
select ok(position('private.commerce_require_vendor' in pg_get_functiondef(
  'public.set_my_vendor_product_sales_state(uuid,boolean,text,uuid)'::regprocedure)) > 0,
  'sales-state RPC resolves the active current vendor');
select ok(position('private.commerce_require_vendor' in pg_get_functiondef(
  'public.set_my_vendor_inventory_quantity(uuid,integer,uuid)'::regprocedure)) > 0,
  'inventory RPC resolves the active current vendor');
select is(has_table_privilege('authenticated','public.commerce_products','update'), false,
  'vendors cannot directly update product rows');
select ok(position('vendor_sales_enabled' in pg_get_functiondef(
  'public.search_public_commerce_products(text,text,text,bigint,bigint,text,boolean,integer,integer)'::regprocedure)) > 0,
  'public product search respects vendor sales availability');
select ok(position('vendor_sales_enabled' in pg_get_functiondef(
  'private.commerce_build_quote(jsonb,text,boolean)'::regprocedure)) > 0,
  'checkout quote rejects vendor-paused products');

select * from finish();
rollback;
