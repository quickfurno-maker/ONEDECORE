-- ONEDECORE commerce vendor login authorization boundary pgTAP
begin;
select plan(8);

select has_function('private','current_commerce_vendor_id', array[]::text[],
  'vendor identity resolver exists');
select ok(position('commerce_vendor' in pg_get_functiondef(
  'private.current_commerce_vendor_id()'::regprocedure)) > 0,
  'vendor resolver requires the dedicated commerce_vendor role');
select ok(position('commerce.vendor.access' in pg_get_functiondef(
  'private.current_commerce_vendor_id()'::regprocedure)) > 0,
  'vendor resolver requires the dedicated vendor permission');
select ok(position('v.status = ''active''' in pg_get_functiondef(
  'private.current_commerce_vendor_id()'::regprocedure)) > 0,
  'vendor registry active status remains the lifecycle authority');
select is(position('private.has_permission' in pg_get_functiondef(
  'private.current_commerce_vendor_id()'::regprocedure)), 0,
  'vendor identity no longer depends on staff-profile authorization');
select ok(position('prof.status = ''active''' in pg_get_functiondef(
  'private.has_permission(text)'::regprocedure)) > 0,
  'staff permission hardening remains unchanged');
select is(has_function_privilege('anon','private.current_commerce_vendor_id()','execute'), false,
  'anon cannot execute the vendor identity resolver');
select is(has_function_privilege('authenticated','private.current_commerce_vendor_id()','execute'), true,
  'authenticated users may resolve their vendor identity through the guarded helper');

select * from finish();
rollback;
