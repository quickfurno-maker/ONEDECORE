-- ONEDECORE commerce automation control-plane pgTAP
begin;
select plan(39);

select has_table('public','commerce_automation_rules','automation rules table exists');
select has_table('public','commerce_automation_events','automation events table exists');
select has_table('public','commerce_automation_jobs','automation jobs table exists');
select has_table('public','commerce_automation_notification_outbox','notification outbox exists');
select has_table('public','commerce_automation_tasks','automation tasks table exists');
select has_table('public','commerce_automation_audit','automation audit exists');
select has_table('public','commerce_automation_settings','runtime settings table exists');

select ok(exists(select 1 from public.permissions where code='commerce.automation.manage' and is_active),
  'automation management permission exists');
select ok(exists(
  select 1 from public.role_permissions rp
  join public.roles r on r.id=rp.role_id
  join public.permissions p on p.id=rp.permission_id
  where r.code='super_admin' and p.code='commerce.automation.manage'
), 'super admin owns automation management permission');
select is((select runtime_enabled from public.commerce_automation_settings where scope='commerce'), true,
  'runtime automation gate defaults enabled');
select is((select adapter_status from public.commerce_automation_channels where channel_code='whatsapp'), 'not_connected',
  'WhatsApp adapter starts disconnected');
select is((select enabled from public.commerce_automation_channels where channel_code='whatsapp'), false,
  'WhatsApp sending starts disabled');
select is((select count(*)::integer from public.commerce_automation_rules), 13,
  'canonical commerce automation rules are seeded');
select is((select count(*)::integer from public.commerce_automation_rules where enabled), 12,
  'all canonical rules except delayed review request start enabled');
select is((select enabled from public.commerce_automation_rules where code='order-delivered-review-request'), false,
  'review request remains policy-gated and disabled');
select ok(not exists(
  select 1 from public.commerce_automation_rules
  where action_kind='notification' and channel_code is distinct from 'whatsapp'
), 'notification rules target the provisioned WhatsApp adapter only');

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.commerce_automation_rules'::regclass),
  'rules table has FORCE RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.commerce_automation_jobs'::regclass),
  'jobs table has FORCE RLS');
select is(has_table_privilege('authenticated','public.commerce_automation_rules','insert'), false,
  'authenticated cannot insert rules directly');
select is(has_table_privilege('authenticated','public.commerce_automation_rules','update'), false,
  'authenticated cannot update rules directly');
select is(has_table_privilege('authenticated','public.commerce_automation_jobs','insert'), false,
  'authenticated cannot insert jobs directly');
select is(has_table_privilege('anon','public.commerce_automation_events','select'), false,
  'anon cannot read automation events');

select is(has_function_privilege('authenticated','public.set_commerce_automation_rule_enabled(uuid,boolean)','execute'), true,
  'authenticated can invoke permission-checked rule toggle RPC');
select is(has_function_privilege('anon','public.set_commerce_automation_rule_enabled(uuid,boolean)','execute'), false,
  'anon cannot invoke rule toggle RPC');
select is(has_function_privilege('service_role','public.claim_commerce_automation_job(text,integer)','execute'), true,
  'service role can claim automation jobs');
select is(has_function_privilege('authenticated','public.claim_commerce_automation_job(text,integer)','execute'), false,
  'authenticated cannot claim worker jobs');

select has_function('public','set_commerce_automation_runtime_enabled','runtime pause RPC exists');
select has_function('public','upsert_commerce_automation_rule','rule create/edit RPC exists');
select has_function('public','set_commerce_automation_channel_enabled','channel enable RPC exists');
select has_function('public','archive_commerce_automation_rule','rule archive RPC exists');
select has_function('public','cancel_commerce_automation_job','job cancel RPC exists');
select has_function('public','replay_commerce_automation_event','event replay RPC exists');
select has_function('public','cancel_commerce_automation_notification','notification cancel RPC exists');
select has_function('public','cancel_commerce_automation_task','task cancel RPC exists');

insert into public.commerce_automation_events(
  event_key,source_kind,source_id,event_code,payload,occurred_at
) values (
  'pgtap-order-confirmed', 'order', gen_random_uuid(), 'order.confirmed',
  '{"orderReference":"OD-O-2099-000001"}'::jsonb, now()
);

select is((select count(*)::integer from public.commerce_automation_jobs j
  join public.commerce_automation_events e on e.id=j.event_id
  where e.event_key='pgtap-order-confirmed'), 2,
  'event fanout creates one durable job per enabled matching rule');
select ok(not exists(
  select 1 from public.commerce_automation_jobs j
  join public.commerce_automation_events e on e.id=j.event_id
  where e.event_key='pgtap-order-confirmed' and j.action_kind_snapshot is null
), 'fanout snapshots action kind into queued jobs');
select ok(not exists(
  select 1 from public.commerce_automation_jobs j
  join public.commerce_automation_events e on e.id=j.event_id
  where e.event_key='pgtap-order-confirmed' and jsonb_typeof(j.config_snapshot)<>'object'
), 'fanout snapshots rule config into queued jobs');
update public.commerce_automation_rules
set template_code='changed_for_test'
where code='order-confirmed-customer';

select is((
  select j.template_code_snapshot
  from public.commerce_automation_jobs j
  join public.commerce_automation_events e on e.id=j.event_id
  join public.commerce_automation_rules r on r.id=j.rule_id
  where e.event_key='pgtap-order-confirmed' and r.code='order-confirmed-customer'
), 'order_confirmed_cod',
  'queued job keeps immutable template snapshot after rule edit');

update public.commerce_automation_settings set runtime_enabled=false where scope='commerce';
select is((public.claim_commerce_automation_job('pgtap-worker',120)->>'outcome_code'), 'paused',
  'runtime pause stops worker claims without deleting queued work');

select * from finish();
rollback;
