begin;
select plan(18);

select ok(
  exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='whatsapp_phone_numbers'
      and column_name='production_sender_at'
  ),
  'phone registry carries the explicit production sender marker'
);

select ok(
  to_regclass('public.uq_whatsapp_phone_numbers_single_production_sender') is not null,
  'only one phone may hold the production sender marker'
);

select ok(
  to_regprocedure('public.configure_whatsapp_production_sender(text,text,text)') is not null,
  'service-only production sender cutover RPC exists'
);

select is(
  has_function_privilege(
    'service_role',
    'public.configure_whatsapp_production_sender(text,text,text)',
    'execute'
  ),
  true,
  'service role may perform the verified sender cutover'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.configure_whatsapp_production_sender(text,text,text)',
    'execute'
  ),
  false,
  'signed-in staff cannot call the service-role sender cutover RPC directly'
);

select is(
  has_function_privilege(
    'anon',
    'public.configure_whatsapp_production_sender(text,text,text)',
    'execute'
  ),
  false,
  'anonymous callers cannot configure the production sender'
);

select ok(
  to_regprocedure('public.get_whatsapp_production_sender_status()') is not null,
  'permission-gated production sender status RPC exists'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.get_whatsapp_production_sender_status()',
    'execute'
  ),
  true,
  'authenticated settings readers may call the sender status RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.get_whatsapp_production_sender_status()',
    'execute'
  ),
  false,
  'anonymous callers cannot inspect sender status'
);

select ok(
  position(
    'whatsapp_campaign_require_service_role' in pg_get_functiondef(
      'public.configure_whatsapp_production_sender(text,text,text)'::regprocedure
    )
  ) > 0,
  'sender cutover fails closed unless invoked with the service role'
);

select ok(
  position(
    'status = ''archived''' in pg_get_functiondef(
      'public.configure_whatsapp_production_sender(text,text,text)'::regprocedure
    )
  ) > 0,
  'sender cutover archives legacy/test phone and account rows'
);

select ok(
  exists(
    select 1 from pg_trigger
    where tgrelid='public.whatsapp_phone_numbers'::regclass
      and tgname='trg_whatsapp_production_phone_status_guard'
      and not tgisinternal
  ),
  'phone registry has the production status guard trigger'
);

select ok(
  exists(
    select 1 from pg_trigger
    where tgrelid='public.whatsapp_business_accounts'::regclass
      and tgname='trg_whatsapp_production_account_status_guard'
      and not tgisinternal
  ),
  'business account registry has the production status guard trigger'
);

select ok(
  position(
    'production_sender_at is null' in lower(pg_get_functiondef(
      'private.whatsapp_production_phone_status_guard()'::regprocedure
    ))
  ) > 0
  and position(
    'archived' in lower(pg_get_functiondef(
      'private.whatsapp_production_phone_status_guard()'::regprocedure
    ))
  ) > 0,
  'new or reactivated non-production phone identities are forced archived'
);


-- Installing the migration must not retire the currently active test/legacy sender.
insert into public.whatsapp_business_accounts(provider, waba_id, status)
values ('meta', '999000000000001', 'active');

insert into public.whatsapp_phone_numbers(
  business_account_id,
  phone_number_id,
  display_phone_number,
  status
)
select id, '999000000000101', '+919999999991', 'active'
from public.whatsapp_business_accounts
where waba_id = '999000000000001';

select is(
  (
    select status
    from public.whatsapp_phone_numbers
    where phone_number_id = '999000000000101'
  ),
  'active',
  'pre-cutover legacy/test sender remains active after migration install'
);

set local request.jwt.claim.role = 'service_role';

select lives_ok(
  $$select public.configure_whatsapp_production_sender(
      '999000000000002',
      '999000000000102',
      '+919999999992'
    )$$,
  'explicit verified cutover can lock the production sender'
);

select is(
  (
    select status
    from public.whatsapp_phone_numbers
    where phone_number_id = '999000000000101'
  ),
  'archived',
  'explicit cutover archives the previous legacy/test sender'
);

select ok(
  exists(
    select 1
    from public.whatsapp_phone_numbers p
    join public.whatsapp_business_accounts b on b.id = p.business_account_id
    where p.phone_number_id = '999000000000102'
      and b.waba_id = '999000000000002'
      and p.status = 'active'
      and b.status = 'active'
      and p.production_sender_at is not null
  ),
  'explicit cutover leaves exactly the verified production identity active and marked'
);

select * from finish();
rollback;
