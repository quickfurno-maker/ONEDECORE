-- ONEDECORE vendor-safe order read model pgTAP
begin;
select plan(13);

select has_function('public','list_my_vendor_commerce_orders','vendor order read RPC exists');
select is(has_function_privilege('anon','public.list_my_vendor_commerce_orders(integer)','execute'), false,
  'anonymous users cannot read vendor orders');
select is(has_function_privilege('authenticated','public.list_my_vendor_commerce_orders(integer)','execute'), true,
  'authenticated users may invoke the vendor-gated order RPC');

select ok(position('private.commerce_require_vendor' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)) > 0,
  'RPC resolves the active current vendor');
select ok(position('p.vendor_id = v_vendor' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)) > 0,
  'RPC filters order lines by vendor ownership');

select ok(position('quantity' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)) > 0,
  'RPC exposes ordered quantity');
select ok(position('event_code' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)) > 0,
  'RPC exposes lifecycle event codes');
select ok(position('line_total_paise' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)) > 0,
  'RPC exposes only vendor-owned line value');
select is(position('customer_name' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)), 0,
  'customer name never enters vendor order payload');
select is(position('customer_mobile_e164' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)), 0,
  'customer mobile never enters vendor order payload');
select is(position('customer_email' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)), 0,
  'customer email never enters vendor order payload');
select is(position('commerce_order_delivery' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)), 0,
  'delivery identity and address are never joined');
select is(position('actor_profile_id' in pg_get_functiondef(
  'public.list_my_vendor_commerce_orders(integer)'::regprocedure)), 0,
  'staff actor identity never enters vendor timeline');

select * from finish();
rollback;
