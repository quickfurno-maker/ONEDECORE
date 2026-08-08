-- ONEDECORE Phase 6C — Kriti audit persistence foundation pgTAP tests

begin;
select plan(16);

select ok(to_regclass('public.kriti_runs') is not null, 'kriti_runs exists');
select ok(to_regclass('public.kriti_events') is not null, 'kriti_events exists');

select ok(
  (select relrowsecurity from pg_class where relname = 'kriti_runs'),
  'kriti_runs RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'kriti_events'),
  'kriti_events RLS enabled'
);

select results_eq(
  $$select has_function_privilege('anon', 'public.start_kriti_run(uuid,text,text,uuid,text,text,text,text,jsonb)', 'execute')$$,
  array[false],
  'anon cannot start kriti run'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'public.start_kriti_run(uuid,text,text,uuid,text,text,text,text,jsonb)', 'execute')$$,
  array[true],
  'authenticated can start kriti run'
);

insert into auth.users (id, instance_id, email, aud, role) values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sekriti@example.test', 'authenticated', 'authenticated'),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sekriti2@example.test', 'authenticated', 'authenticated'),
  ('e7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'inactivek@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in ('e1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222');
update public.profiles set status = 'suspended'
where id = 'e7777777-7777-7777-7777-777777777777';

insert into public.user_roles (user_id, role_id)
select 'e1111111-1111-1111-1111-111111111111', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'e2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_executive';

set local role authenticated;
set local request.jwt.claim.sub = 'e1111111-1111-1111-1111-111111111111';

select lives_ok(
  $$select public.start_kriti_run(
    'f1111111-1111-1111-1111-111111111111'::uuid,
    'conversation_summary',
    'whatsapp_conversation',
    null,
    'local-test',
    'fake',
    'fake-model',
    repeat('a', 64),
    '{"sources":["whatsapp_messages"]}'::jsonb
  )$$,
  'active staff can start kriti run'
);

select results_eq(
  $$select count(*)::integer from public.kriti_runs where id = 'f1111111-1111-1111-1111-111111111111'::uuid$$,
  array[1],
  'run row created'
);

select results_eq(
  $$select count(*)::integer from public.kriti_events where run_id = 'f1111111-1111-1111-1111-111111111111'::uuid$$,
  array[1],
  'request event created'
);

select lives_ok(
  $$select public.append_kriti_audit_event(
    'f1111111-1111-1111-1111-111111111111'::uuid,
    'kriti.suggestion',
    '{"schema":"kriti.conversation_summary.v1"}'::jsonb,
    null,
    '{"total_tokens":42}'::jsonb,
    'succeeded'
  )$$,
  'append suggestion event'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'e2222222-2222-2222-2222-222222222222';

select throws_ok(
  $$select public.append_kriti_audit_event(
    'f1111111-1111-1111-1111-111111111111'::uuid,
    'kriti.human_use',
    '{"action":"copy"}'::jsonb
  )$$,
  '42501',
  'kriti run outside actor scope',
  'other executive cannot append to foreign run'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'e7777777-7777-7777-7777-777777777777';

select throws_ok(
  $$select public.start_kriti_run(
    'f2222222-2222-2222-2222-222222222222'::uuid,
    'conversation_summary',
    null,
    null,
    'disabled',
    null,
    null,
    repeat('b', 64)
  )$$,
  '42501',
  'inactive or suspended staff',
  'inactive staff denied'
);

reset role;

select throws_ok(
  $$update public.kriti_events set details = '{"x":1}'::jsonb where run_id = 'f1111111-1111-1111-1111-111111111111'::uuid$$,
  '55000',
  'kriti_events is append-only',
  'append-only events cannot be updated'
);

select throws_ok(
  $$delete from public.kriti_events where run_id = 'f1111111-1111-1111-1111-111111111111'::uuid$$,
  '55000',
  'kriti_events is append-only',
  'append-only events cannot be deleted'
);

select is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'start_kriti_run'),
  array['search_path=""'],
  'start_kriti_run search_path hardened'
);

select results_eq(
  $$select count(*)::integer from public.kriti_runs$$,
  array[1],
  'no fake extra runs'
);

select * from finish();
rollback;
