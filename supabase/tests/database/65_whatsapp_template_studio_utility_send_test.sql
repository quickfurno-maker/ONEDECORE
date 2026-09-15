-- ONEDECORE WM-2 — Template Studio, governed one-to-one UTILITY template sends
-- and the inbound media view seam, proved against the real database.
--
-- WHAT THIS SUITE HAS TO SETTLE
--
-- 1. The WM-0 permission matrix is granted exactly; legacy roles stay frozen.
-- 2. Provider truth (status, category, quality, message id) is written only by
--    service_role; unknown provider values stay raw and are never sendable.
-- 3. Evidence is append-only; send lifecycles move only along reviewed edges.
-- 4. Only APPROVED UTILITY snapshots whose registry row still matches may be
--    sent, one-to-one, by someone who can use that exact conversation NOW.
-- 5. Reassignment, tombstone, approval loss and content drift are re-proved at
--    claim time; ambiguous provider outcomes reconcile and are never retried.

begin;
select plan(139);

-- =============================================================================
-- Fixtures — a65 / b65 / c65 / d65 / e65 / f65 prefixes, unique to this file
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('a6500001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', '65-sa@example.test', 'authenticated', 'authenticated'),
  ('a6500001-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', '65-sm@example.test', 'authenticated', 'authenticated'),
  ('a6500001-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', '65-mgmt@example.test', 'authenticated', 'authenticated'),
  ('a6500001-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', '65-se-a@example.test', 'authenticated', 'authenticated'),
  ('a6500001-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', '65-se-b@example.test', 'authenticated', 'authenticated'),
  ('a6500001-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', '65-sales@example.test', 'authenticated', 'authenticated'),
  ('a6500001-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', '65-pm@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id::text like 'a6500001-%';

insert into public.user_roles (user_id, role_id)
select v.user_id::uuid, r.id
from (values
  ('a6500001-0000-4000-8000-000000000001', 'super_admin'),
  ('a6500001-0000-4000-8000-000000000002', 'sales_manager'),
  ('a6500001-0000-4000-8000-000000000003', 'management'),
  ('a6500001-0000-4000-8000-000000000004', 'sales_executive'),
  ('a6500001-0000-4000-8000-000000000005', 'sales_executive'),
  ('a6500001-0000-4000-8000-000000000006', 'sales'),
  ('a6500001-0000-4000-8000-000000000007', 'project_manager')
) as v(user_id, role_code)
join public.roles r on r.code = v.role_code;

insert into public.contacts (id, display_name, status) values
  ('c6500000-0000-4000-8000-000000000001', 'WM2 Live', 'active'),
  ('c6500000-0000-4000-8000-000000000002', 'WM2 Tombstone', 'active'),
  ('c6500000-0000-4000-8000-000000000003', 'WM2 No Consent', 'active'),
  ('c6500000-0000-4000-8000-000000000004', 'WM2 Legacy Sales', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary, status) values
  ('c6500000-0000-4000-8000-000000000001', 'whatsapp', '+919765000001', true, 'active'),
  ('c6500000-0000-4000-8000-000000000002', 'whatsapp', '+919765000002', true, 'active'),
  ('c6500000-0000-4000-8000-000000000003', 'whatsapp', '+919765000003', true, 'active'),
  ('c6500000-0000-4000-8000-000000000004', 'whatsapp', '+919765000004', true, 'active');

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code,
  planner_version, landing_path, assigned_to
)
select
  v.lead_id::uuid, v.lead_id::uuid, v.contact_id::uuid, v.name, 'assigned', 'website-planner',
  (select id from public.lead_sources where code = 'website_planner'), 'public_intake',
  'complete-home-interiors', 'apartment-3bhk', 'immediate', 'v1', '/planner',
  v.assignee::uuid
from (values
  ('b6500000-0000-4000-8000-000000000001', 'c6500000-0000-4000-8000-000000000001', 'WM2 Live', 'a6500001-0000-4000-8000-000000000004'),
  ('b6500000-0000-4000-8000-000000000002', 'c6500000-0000-4000-8000-000000000002', 'WM2 Tombstone', 'a6500001-0000-4000-8000-000000000004'),
  ('b6500000-0000-4000-8000-000000000003', 'c6500000-0000-4000-8000-000000000003', 'WM2 No Consent', 'a6500001-0000-4000-8000-000000000004'),
  ('b6500000-0000-4000-8000-000000000004', 'c6500000-0000-4000-8000-000000000004', 'WM2 Legacy Sales', 'a6500001-0000-4000-8000-000000000006')
) as v(lead_id, contact_id, name, assignee);

insert into public.consent_events (
  contact_id, lead_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type
)
select v.contact_id::uuid, v.lead_id::uuid, 'WHATSAPP_SERVICE', 'whatsapp', 'granted',
  'whatsapp-service-v0.1-draft', 'privacy-notice-v0.1-draft', 'local-test', 'staff'
from (values
  ('c6500000-0000-4000-8000-000000000001', 'b6500000-0000-4000-8000-000000000001'),
  ('c6500000-0000-4000-8000-000000000002', 'b6500000-0000-4000-8000-000000000002'),
  ('c6500000-0000-4000-8000-000000000004', 'b6500000-0000-4000-8000-000000000004')
) as v(contact_id, lead_id);

insert into public.whatsapp_business_accounts (id, waba_id, status) values
  ('d6500000-0000-4000-8000-000000000001', '900000000000651', 'active');

insert into public.whatsapp_phone_numbers (id, business_account_id, phone_number_id, display_phone_number, status) values
  ('d6500000-0000-4000-8000-000000000002', 'd6500000-0000-4000-8000-000000000001', '900000000000652', '+91 97650 00099', 'active');

insert into public.whatsapp_conversations (
  id, phone_number_id, customer_e164, contact_id, lead_id, display_name_snapshot, last_message_at, last_inbound_at
)
values
  ('e6500000-0000-4000-8000-000000000001', 'd6500000-0000-4000-8000-000000000002', '+919765000001',
   'c6500000-0000-4000-8000-000000000001', 'b6500000-0000-4000-8000-000000000001', 'WM2 Live', now() - interval '3 days', now() - interval '3 days'),
  ('e6500000-0000-4000-8000-000000000002', 'd6500000-0000-4000-8000-000000000002', '+919765000002',
   'c6500000-0000-4000-8000-000000000002', 'b6500000-0000-4000-8000-000000000002', 'WM2 Tombstone', now() - interval '3 days', now() - interval '3 days'),
  ('e6500000-0000-4000-8000-000000000003', 'd6500000-0000-4000-8000-000000000002', '+919765000003',
   'c6500000-0000-4000-8000-000000000003', 'b6500000-0000-4000-8000-000000000003', 'WM2 No Consent', now() - interval '3 days', now() - interval '3 days'),
  ('e6500000-0000-4000-8000-000000000004', 'd6500000-0000-4000-8000-000000000002', '+919765000004',
   'c6500000-0000-4000-8000-000000000004', 'b6500000-0000-4000-8000-000000000004', 'WM2 Legacy Sales', now() - interval '3 days', now() - interval '3 days');

insert into public.whatsapp_messages (
  id, conversation_id, provider_message_id, direction, provider_message_type,
  normalized_message_type, sender_e164, recipient_e164, body_text, content, provider_timestamp
)
values
  ('f6500000-0000-4000-8000-000000000001', 'e6500000-0000-4000-8000-000000000001', 'wamid.WM2.IMG', 'inbound', 'image', 'image',
   '+919765000001', '+919765000099', null,
   '{"id":"1650000000000001","mime_type":"image/jpeg","sha256":"c2hhMjU2","caption":"Living room"}'::jsonb,
   now() - interval '3 days'),
  ('f6500000-0000-4000-8000-000000000002', 'e6500000-0000-4000-8000-000000000001', 'wamid.WM2.TXT', 'inbound', 'text', 'text',
   '+919765000001', '+919765000099', 'Hello', '{}'::jsonb,
   now() - interval '3 days' + interval '1 minute');

-- =============================================================================
-- 1. Permission matrix and legacy freeze
-- =============================================================================

select results_eq(
  $$select r.code || ':' || p.code
      from public.role_permissions rp
      join public.roles r on r.id = rp.role_id
      join public.permissions p on p.id = rp.permission_id
     where p.code like 'whatsapp.templates.%'
     order by 1$$,
  array[
    'sales_executive:whatsapp.templates.use',
    'sales_manager:whatsapp.templates.manage',
    'sales_manager:whatsapp.templates.read',
    'sales_manager:whatsapp.templates.use',
    'super_admin:whatsapp.templates.manage',
    'super_admin:whatsapp.templates.read',
    'super_admin:whatsapp.templates.use'
  ],
  'MATRIX: template codes are granted exactly per WM-0'
);

select results_eq(
  $$select r.code || ':' || p.code
      from public.role_permissions rp
      join public.roles r on r.id = rp.role_id
      join public.permissions p on p.id = rp.permission_id
     where r.code in ('management', 'sales') and p.code like 'whatsapp.%'
     order by 1$$,
  array[
    'management:whatsapp.inbox.manage',
    'management:whatsapp.inbox.read',
    'management:whatsapp.inbox.use',
    'sales:whatsapp.inbox.read',
    'sales:whatsapp.inbox.use'
  ],
  'LEGACY FREEZE: management and sales keep only their M19 inbox grants'
);

select is(
  (select count(*)::integer from public.permissions where code like 'whatsapp.templates.%' and is_system and is_active),
  3, 'MATRIX: three active system template permissions exist'
);

-- =============================================================================
-- 2. Catalogue: RLS, grants, function hygiene
-- =============================================================================

select ok(
  (select bool_and(c.relrowsecurity and c.relforcerowsecurity)
     from pg_class c
    where c.oid in (
      'public.whatsapp_template_snapshots'::regclass,
      'public.whatsapp_template_sync_runs'::regclass,
      'public.whatsapp_template_submissions'::regclass,
      'public.whatsapp_template_status_events'::regclass,
      'public.whatsapp_media_access_events'::regclass,
      'public.whatsapp_template_send_intents'::regclass,
      'public.whatsapp_template_dispatch_attempts'::regclass
    )),
  'CATALOGUE: every WM-2 table has RLS enabled and forced'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.whatsapp_templates', 'public.whatsapp_template_snapshots', 'public.whatsapp_template_sync_runs',
      'public.whatsapp_template_submissions', 'public.whatsapp_template_status_events',
      'public.whatsapp_media_access_events', 'public.whatsapp_template_send_intents',
      'public.whatsapp_template_dispatch_attempts'
    ]) t(name)
    where has_table_privilege('authenticated', t.name, 'INSERT')
       or has_table_privilege('authenticated', t.name, 'UPDATE')
       or has_table_privilege('authenticated', t.name, 'DELETE')
       or has_table_privilege('anon', t.name, 'SELECT')
  ),
  'CATALOGUE: no direct write for authenticated and no read for anon'
);

select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_templates', 'SELECT'),
  'CATALOGUE: whatsapp_templates stays service-only (read through RPCs)'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'list_whatsapp_template_registry', 'list_whatsapp_sendable_utility_templates',
        'create_whatsapp_utility_template_send_intent', 'request_whatsapp_template_sync',
        'request_whatsapp_template_submission', 'authorize_whatsapp_inbound_media_view',
        'ensure_whatsapp_business_account', 'apply_whatsapp_template_sync_item',
        'record_whatsapp_template_submission_outcome', 'claim_whatsapp_template_send_intent',
        'complete_whatsapp_template_send_intent', 'reconcile_whatsapp_template_dispatch_attempt'
      )
      and p.prosecdef
      and 'search_path=""' = any(p.proconfig)
      and not has_function_privilege('anon', p.oid, 'EXECUTE')),
  12, 'CATALOGUE: all twelve WM-2 RPCs are definer, search_path empty, closed to anon'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'ensure_whatsapp_business_account', 'apply_whatsapp_template_sync_item',
        'record_whatsapp_template_submission_outcome', 'claim_whatsapp_template_send_intent',
        'complete_whatsapp_template_send_intent', 'reconcile_whatsapp_template_dispatch_attempt'
      )
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  6, 'CATALOGUE: provider-truth RPCs are service_role only'
);

select ok(
  not has_function_privilege('authenticated', 'private.whatsapp_template_send_gate(uuid, uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.whatsapp_actor_holds_permission(uuid, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.whatsapp_bind_template_dispatch_attempt(uuid, text, timestamp with time zone)', 'EXECUTE'),
  'CATALOGUE: the private gate, actor permission check and binder are closed to authenticated'
);

select matches(
  pg_get_functiondef('private.whatsapp_inbox_actor_can_use_conversation(uuid, uuid)'::regprocedure),
  'from public\.leads where deleted_at is null',
  'CATALOGUE: the dispatch use predicate the gate relies on is still tombstone-hardened'
);

select matches(
  pg_get_functiondef('private.create_whatsapp_service_send_intent_impl_v2(uuid, text, text, text, uuid, text, uuid)'::regprocedure),
  'denied_purpose: only WHATSAPP_SERVICE is allowed',
  'SERVICE PATH: the text send-intent authority still refuses non-service purposes'
);

-- =============================================================================
-- 3. Sync: human request, provider-truth apply
-- =============================================================================

set local role authenticated;

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.request_whatsapp_template_sync('900000000000651')$$,
  '42501', 'denied_templates_manage',
  'SYNC: a Sales Executive cannot request a sync'
);
select throws_ok(
  $$select public.apply_whatsapp_template_sync_item(gen_random_uuid(), '1', 'x', 'en', 'APPROVED', 'UTILITY', null, null, '[]'::jsonb)$$,
  '42501', NULL,
  'SYNC: authenticated cannot write provider truth directly'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.request_whatsapp_template_sync('900000000000651')$$,
  '42501', 'denied_templates_manage',
  'SYNC: legacy management cannot request a sync'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.request_whatsapp_template_sync('900000000000999')$$,
  'P0002', 'whatsapp_business_account_not_registered',
  'SYNC: an unregistered WABA is refused'
);
select lives_ok(
  $$select set_config('test.run1', (public.request_whatsapp_template_sync('900000000000651') ->> 'sync_run_id'), true)$$,
  'SYNC: Sales Manager requests a sync'
);

reset role;
select is(
  (select requested_by::text from public.whatsapp_template_sync_runs where id = current_setting('test.run1')::uuid),
  'a6500001-0000-4000-8000-000000000002',
  'SYNC: the run records auth.uid() as requester'
);

set local role service_role;

select lives_ok($$
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000001', 'order_update', 'en', 'APPROVED', 'UTILITY', 'GREEN', 'POSITIONAL',
    '[{"type":"BODY","text":"Hi {{1}}, your site visit is confirmed for {{2}}."},{"type":"FOOTER","text":"ONEDECORE"}]'::jsonb);
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000002', 'festive_offer', 'en', 'APPROVED', 'MARKETING', 'GREEN', 'POSITIONAL',
    '[{"type":"BODY","text":"Hi {{1}}, festive offers are live."}]'::jsonb);
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000003', 'pending_util', 'en', 'PENDING', 'UTILITY', null, 'POSITIONAL',
    '[{"type":"BODY","text":"Pending body {{1}}"}]'::jsonb);
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000004', 'future_status', 'en', 'SOMETHING_NEW', 'UTILITY', 'PURPLE', 'POSITIONAL',
    '[{"type":"BODY","text":"Future body"}]'::jsonb);
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000005', 'auth_code', 'en', 'APPROVED', 'AUTHENTICATION', null, 'POSITIONAL',
    '[{"type":"BODY","text":"{{1}} is your code"}]'::jsonb);
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000006', 'media_header', 'en', 'APPROVED', 'UTILITY', null, 'POSITIONAL',
    '[{"type":"HEADER","format":"IMAGE"},{"type":"BODY","text":"See the attached plan"}]'::jsonb);
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000007', 'visit_named', 'en_US', 'approved', 'utility', null, 'NAMED',
    '[{"type":"HEADER","format":"TEXT","text":"Visit for {{customer_name}}"},{"type":"BODY","text":"Dear {{customer_name}}, we arrive at {{visit_time}}."}]'::jsonb);
$$, 'SYNC: service role applies seven provider observations');

reset role;

select results_eq(
  $$select name || ':' || status || ':' || category || ':' || coalesce(raw_status, '-') || ':' || coalesce(quality_rating, '-')
      from public.whatsapp_templates
     where business_account_id = 'd6500000-0000-4000-8000-000000000001'
     order by name$$,
  array[
    'auth_code:APPROVED:AUTHENTICATION:APPROVED:-',
    'festive_offer:APPROVED:MARKETING:APPROVED:GREEN',
    'future_status:unknown:UTILITY:SOMETHING_NEW:unknown',
    'media_header:APPROVED:UTILITY:APPROVED:-',
    'order_update:APPROVED:UTILITY:APPROVED:GREEN',
    'pending_util:PENDING:UTILITY:PENDING:-',
    'visit_named:APPROVED:UTILITY:approved:-'
  ],
  'SYNC: status/category normalised, raw provider values preserved, unknown stays unknown'
);

select is(
  (select raw_quality_rating from public.whatsapp_templates where name = 'future_status'),
  'PURPLE', 'SYNC: an unknown quality rating is kept raw'
);

select results_eq(
  $$select t.name from public.whatsapp_template_snapshots s
      join public.whatsapp_templates t on t.id = s.template_id
     where t.business_account_id = 'd6500000-0000-4000-8000-000000000001'
     order by t.name$$,
  array['auth_code', 'festive_offer', 'media_header', 'order_update', 'visit_named'],
  'SYNC: snapshots are captured only for provider-APPROVED templates'
);

select is(
  (select count(*)::integer from public.whatsapp_template_status_events
    where sync_run_id = current_setting('test.run1')::uuid and event_kind = 'observed'),
  7, 'SYNC: each first observation is evidenced'
);

select is(
  (select s.content_hash from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'order_update'),
  (select content_hash from public.whatsapp_templates where name = 'order_update'),
  'SYNC: snapshot hash equals the registry content hash'
);

select set_config('test.snap_order', (select s.id::text from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'order_update'), true);
select set_config('test.snap_marketing', (select s.id::text from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'festive_offer'), true);
select set_config('test.snap_auth', (select s.id::text from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'auth_code'), true);
select set_config('test.snap_media', (select s.id::text from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'media_header'), true);
select set_config('test.snap_named', (select s.id::text from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'visit_named'), true);

-- Re-applying the identical observation is quiet: no event, no new snapshot.
set local role service_role;
select lives_ok($$
  select public.apply_whatsapp_template_sync_item(current_setting('test.run1')::uuid,
    '165000000000001', 'order_update', 'en', 'APPROVED', 'UTILITY', 'GREEN', 'POSITIONAL',
    '[{"type":"BODY","text":"Hi {{1}}, your site visit is confirmed for {{2}}."},{"type":"FOOTER","text":"ONEDECORE"}]'::jsonb)
$$, 'SYNC: identical re-apply succeeds');
reset role;
select is(
  (select count(*)::integer from public.whatsapp_template_status_events e join public.whatsapp_templates t on t.id = e.template_id where t.name = 'order_update'),
  1, 'SYNC: an unchanged observation adds no evidence row'
);

-- =============================================================================
-- 4. Append-only evidence
-- =============================================================================

select throws_ok(
  $$update public.whatsapp_template_snapshots set name = 'tampered' where id = current_setting('test.snap_order')::uuid$$,
  '55000', NULL, 'APPEND-ONLY: snapshots cannot be updated'
);
select throws_ok(
  $$delete from public.whatsapp_template_snapshots where id = current_setting('test.snap_order')::uuid$$,
  '55000', NULL, 'APPEND-ONLY: snapshots cannot be deleted'
);
select throws_ok(
  $$update public.whatsapp_template_status_events set status = 'APPROVED'$$,
  '55000', NULL, 'APPEND-ONLY: status events cannot be updated'
);
select throws_ok(
  $$delete from public.whatsapp_template_sync_runs$$,
  '55000', NULL, 'APPEND-ONLY: sync runs cannot be deleted'
);
select throws_ok(
  $$insert into public.whatsapp_template_snapshots (
      template_id, business_account_id, provider_template_id, name, language, category,
      components, content_hash, observed_status)
    select id, business_account_id, provider_template_id, name, language, category,
      components, repeat('0', 64), 'PENDING'
    from public.whatsapp_templates where name = 'pending_util'$$,
  '23514', NULL, 'APPEND-ONLY: a snapshot of a non-APPROVED observation is refused by CHECK'
);

-- =============================================================================
-- 5. Staff read models
-- =============================================================================

set local role authenticated;

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000002', true);
select is(
  (select (public.list_whatsapp_template_registry() ->> 'total_count')::integer),
  7, 'REGISTRY: Sales Manager reads every registry row'
);
select is(
  (select (public.list_whatsapp_template_registry('unknown') ->> 'total_count')::integer),
  1, 'REGISTRY: unknown provider status is filterable'
);
select results_eq(
  $$select i ->> 'name'
      from jsonb_array_elements(public.list_whatsapp_template_registry() -> 'items') i
     where (i ->> 'one_to_one_sendable')::boolean
     order by 1$$,
  array['order_update', 'visit_named'],
  'REGISTRY: only APPROVED UTILITY templates with supported parameters are one-to-one sendable'
);
select is(
  (select i ->> 'send_problem' from jsonb_array_elements(public.list_whatsapp_template_registry() -> 'items') i where i ->> 'name' = 'media_header'),
  'header_media_unsupported', 'REGISTRY: the unsupported reason is explicit'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000001', true);
select is(
  (select (public.list_whatsapp_template_registry() ->> 'total_count')::integer),
  7, 'REGISTRY: Super Admin reads every registry row'
);
select is(
  (select count(*)::integer from public.whatsapp_template_status_events),
  7, 'REGISTRY: Super Admin reads status evidence through RLS'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select throws_ok($$select public.list_whatsapp_template_registry()$$, '42501', 'denied_templates_read',
  'REGISTRY: Sales Executive cannot read the Studio registry');
select is(
  (select count(*)::integer from public.whatsapp_template_snapshots) + (select count(*)::integer from public.whatsapp_template_status_events),
  0, 'REGISTRY: Sales Executive sees no snapshot or status evidence rows'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000003', true);
select throws_ok($$select public.list_whatsapp_template_registry()$$, '42501', 'denied_templates_read',
  'REGISTRY: legacy management cannot read the Studio registry');

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000006', true);
select throws_ok($$select public.list_whatsapp_template_registry()$$, '42501', 'denied_templates_read',
  'REGISTRY: legacy sales cannot read the Studio registry');

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000007', true);
select throws_ok($$select public.list_whatsapp_template_registry()$$, '42501', 'denied_templates_read',
  'REGISTRY: project manager cannot read the Studio registry');

-- Sendable selector.
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select results_eq(
  $$select i ->> 'name' from jsonb_array_elements(
      public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000001') -> 'items') i order by 1$$,
  array['order_update', 'visit_named'],
  'SELECTOR: assigned Sales Executive sees only sendable APPROVED UTILITY templates'
);
select is(
  (select public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000001') -> 'items' -> 1 -> 'variables'),
  '[{"key":"customer_name","component":"header","max_length":60},{"key":"customer_name","component":"body","max_length":1024},{"key":"visit_time","component":"body","max_length":1024}]'::jsonb,
  'SELECTOR: variables are listed header first, in placeholder order'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000001')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'SELECTOR: an unassigned Sales Executive gets not-found'
);
select throws_ok(
  $$select public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-0000000000ff')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'SELECTOR: a nonexistent conversation gets the identical signal'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000006', true);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6500000-0000-4000-8000-000000000004', 'use'),
  'LEGACY: legacy sales still uses its assigned conversation for text (M19 unchanged)'
);
select throws_ok(
  $$select public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000004')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'LEGACY: legacy sales gets no template selector even on its own assigned lead'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000001')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'LEGACY: legacy management gets no template selector despite inbox manage scope'
);

-- =============================================================================
-- 6. Intent creation
-- =============================================================================

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);

select lives_ok(
  $$select set_config('test.i1', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001',
      current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Monday 11am"}}'::jsonb,
      'a6500002-0000-4000-8000-000000000001') ->> 'intent_id'), true)$$,
  'INTENT: assigned Sales Executive records a UTILITY template intent'
);
select is(
  (select (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001',
      current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Monday 11am"}}'::jsonb,
      'a6500002-0000-4000-8000-000000000001') ->> 'reused')::boolean),
  true, 'INTENT: replaying the same key returns the same intent'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Ravi","2":"Monday 11am"}}'::jsonb, 'a6500002-0000-4000-8000-000000000001')$$,
  '23505', 'idempotency_conflict',
  'INTENT: the same key with different parameters is a conflict'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_marketing')::uuid,
      '{"body":{"1":"Asha"}}'::jsonb, 'a6500002-0000-4000-8000-000000000002')$$,
  '22023', 'template_not_sendable: template_category_not_utility',
  'INTENT: a MARKETING template can never enter the one-to-one lane'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_auth')::uuid,
      '{"body":{"1":"123456"}}'::jsonb, 'a6500002-0000-4000-8000-000000000003')$$,
  '22023', 'template_not_sendable: template_category_not_utility',
  'INTENT: an AUTHENTICATION template is not staff-sendable'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_media')::uuid,
      '{}'::jsonb, 'a6500002-0000-4000-8000-000000000004')$$,
  '22023', 'template_not_sendable: template_parameters_unsupported',
  'INTENT: a media-header template fails closed'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', gen_random_uuid(),
      '{}'::jsonb, 'a6500002-0000-4000-8000-000000000005')$$,
  '22023', 'template_not_sendable: template_snapshot_missing',
  'INTENT: a pending/unknown template has no approved snapshot to bind'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha"}}'::jsonb, 'a6500002-0000-4000-8000-000000000006')$$,
  '22023', 'validation: template_parameters (parameters_missing)',
  'INTENT: a missing variable fails closed'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Mon","3":"x"}}'::jsonb, 'a6500002-0000-4000-8000-000000000007')$$,
  '22023', 'validation: template_parameters (parameters_unexpected_key)',
  'INTENT: an unexpected variable fails closed'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      jsonb_build_object('body', jsonb_build_object('1', E'Asha\nInjected', '2', 'Mon')), 'a6500002-0000-4000-8000-000000000008')$$,
  '22023', 'validation: template_parameters (parameters_invalid)',
  'INTENT: a newline inside a variable fails closed'
);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000003', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Mon"}}'::jsonb, 'a6500002-0000-4000-8000-000000000009')$$,
  '22023', 'denied_missing_consent',
  'INTENT: missing WHATSAPP_SERVICE consent refuses a template too'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Mon"}}'::jsonb, 'a6500002-0000-4000-8000-000000000010')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'INTENT: an unassigned Sales Executive gets not-found'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000006', true);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000004', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Mon"}}'::jsonb, 'a6500002-0000-4000-8000-000000000011')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'LEGACY: legacy sales cannot send a template on its own assigned lead'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Mon"}}'::jsonb, 'a6500002-0000-4000-8000-000000000012')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'LEGACY: legacy management cannot send a template'
);

reset role;
select is(
  (select preview_text from public.whatsapp_template_send_intents where id = current_setting('test.i1')::uuid),
  E'Hi Asha, your site visit is confirmed for Monday 11am.\n\nONEDECORE',
  'INTENT: the history preview is rendered server-side from the snapshot'
);
select is(
  (select requested_by::text || ':' || lifecycle_status from public.whatsapp_template_send_intents where id = current_setting('test.i1')::uuid),
  'a6500001-0000-4000-8000-000000000004:eligible',
  'INTENT: actor is auth.uid() and the intent starts eligible'
);
select is(
  (select count(*)::integer from public.whatsapp_template_send_intents where conversation_id = 'e6500000-0000-4000-8000-000000000001'),
  1, 'INTENT: refused attempts left no rows'
);

-- =============================================================================
-- 7. Claim, bind, idempotency
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select * from public.claim_whatsapp_template_send_intent(current_setting('test.i1')::uuid, 'fake', 'k1')$$,
  '42501', NULL, 'CLAIM: authenticated cannot claim a dispatch'
);
select is(
  (select count(*)::integer from public.whatsapp_template_send_intents where id = current_setting('test.i1')::uuid),
  1, 'CLAIM: the requester can read their own intent through conversation scope'
);

set local role service_role;
create temporary table _claim1 on commit drop as
select * from public.claim_whatsapp_template_send_intent(current_setting('test.i1')::uuid, 'fake', current_setting('test.i1') || ':fake');

select is((select outcome_code from _claim1), 'claimed', 'CLAIM: an eligible intent is claimed');
select is(
  (select send_components from _claim1),
  '[{"type":"body","parameters":[{"type":"text","text":"Asha"},{"type":"text","text":"Monday 11am"}]}]'::jsonb,
  'CLAIM: type=template components are built from validated parameters, positional order'
);
select is(
  (select phone_number_id || ':' || customer_e164 || ':' || template_name || ':' || template_language from _claim1),
  '900000000000652:+919765000001:order_update:en',
  'CLAIM: provider routing fields come from the conversation and the snapshot'
);
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i1')::uuid, 'fake', current_setting('test.i1') || ':fake')),
  'in_flight', 'CLAIM: a second claim of a pending intent yields no second provider call'
);
select is(
  (select count(*)::integer from public.whatsapp_template_dispatch_attempts where template_send_intent_id = current_setting('test.i1')::uuid),
  1, 'CLAIM: exactly one attempt exists'
);

select is(
  (select public.complete_whatsapp_template_send_intent((select dispatch_attempt_id from _claim1), 'success',
     'wamid.WM2.T1', now(), null, null, 200, '{"provider":"fake"}'::jsonb) ->> 'outcome'),
  'bound', 'BIND: provider acceptance binds the intent'
);
select is(
  (select public.complete_whatsapp_template_send_intent((select dispatch_attempt_id from _claim1), 'success',
     'wamid.WM2.T1', now(), null, null, 200, '{}'::jsonb) ->> 'outcome'),
  'already_bound', 'BIND: completing again is idempotent'
);

reset role;
select is(
  (select direction || ':' || provider_message_type || ':' || normalized_message_type || ':' || sender_e164 || ':' || coalesce(latest_status, 'null')
     from public.whatsapp_messages where provider_message_id = 'wamid.WM2.T1'),
  'outbound:template:text:+919765000099:null',
  'BIND: canonical outbound message is template/text with no fabricated delivery status'
);
select is(
  (select content -> 'template' ->> 'name' || ':' || (content -> 'parameters' -> 'body' ->> '1') from public.whatsapp_messages where provider_message_id = 'wamid.WM2.T1'),
  'order_update:Asha',
  'BIND: message content carries template identity and parameters'
);
select ok(
  (select pg_column_size(content) <= 8192 and content::text !~* 'token|bearer|authorization' from public.whatsapp_messages where provider_message_id = 'wamid.WM2.T1'),
  'BIND: content is bounded and carries no credential'
);
select is(
  (select lifecycle_status from public.whatsapp_template_send_intents where id = current_setting('test.i1')::uuid),
  'dispatch_bound', 'BIND: the intent is dispatch_bound'
);

-- =============================================================================
-- 8. Named parameters
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select lives_ok(
  $$select set_config('test.i_named', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_named')::uuid,
      '{"header":{"customer_name":"Asha"},"body":{"customer_name":"Asha","visit_time":"5 pm"}}'::jsonb,
      'a6500002-0000-4000-8000-000000000020') ->> 'intent_id'), true)$$,
  'NAMED: a NAMED-format template intent is recorded'
);
set local role service_role;
select is(
  (select send_components from public.claim_whatsapp_template_send_intent(current_setting('test.i_named')::uuid, 'fake', current_setting('test.i_named') || ':fake')),
  '[{"type":"header","parameters":[{"text":"Asha","type":"text","parameter_name":"customer_name"}]},{"type":"body","parameters":[{"text":"Asha","type":"text","parameter_name":"customer_name"},{"text":"5 pm","type":"text","parameter_name":"visit_time"}]}]'::jsonb,
  'NAMED: components carry parameter_name, header before body'
);

-- =============================================================================
-- 9. Failed, ambiguous, reconcile — never retried
-- =============================================================================

select is(
  (select public.complete_whatsapp_template_send_intent(
     (select id from public.whatsapp_template_dispatch_attempts where template_send_intent_id = current_setting('test.i_named')::uuid),
     'ambiguous', null, null, null, 'timeout', null, '{"provider":"fake"}'::jsonb) ->> 'outcome'),
  'ambiguous', 'AMBIGUOUS: an unclear provider result is recorded'
);
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i_named')::uuid, 'fake', 'retry-key')),
  'needs_reconcile', 'AMBIGUOUS: claiming again returns needs_reconcile, not a retry'
);
select is(
  (select public.complete_whatsapp_template_send_intent(
     (select id from public.whatsapp_template_dispatch_attempts where template_send_intent_id = current_setting('test.i_named')::uuid),
     'failed', null, null, 'terminal', 'late', 400, '{}'::jsonb) ->> 'outcome'),
  'already_finalized', 'AMBIGUOUS: a later failure report cannot rewrite the ambiguous evidence'
);
select is(
  (select count(*)::integer from public.whatsapp_template_dispatch_attempts where template_send_intent_id = current_setting('test.i_named')::uuid),
  1, 'AMBIGUOUS: still exactly one attempt'
);
select is(
  (select public.reconcile_whatsapp_template_dispatch_attempt(
     (select id from public.whatsapp_template_dispatch_attempts where template_send_intent_id = current_setting('test.i_named')::uuid),
     'wamid.WM2.NAMED') ->> 'outcome'),
  'bound', 'RECONCILE: provider evidence binds the ambiguous attempt'
);
reset role;
select is(
  (select lifecycle_status || ':' || (outbound_message_id is not null)::text from public.whatsapp_template_send_intents where id = current_setting('test.i_named')::uuid),
  'dispatch_bound:true', 'RECONCILE: the intent is bound to a canonical message'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select lives_ok(
  $$select set_config('test.i_fail', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Tuesday"}}'::jsonb, 'a6500002-0000-4000-8000-000000000030') ->> 'intent_id'), true)$$,
  'FAILED: a further intent is recorded'
);
set local role service_role;
select is(
  (select public.complete_whatsapp_template_send_intent(
     (select dispatch_attempt_id from public.claim_whatsapp_template_send_intent(current_setting('test.i_fail')::uuid, 'fake', current_setting('test.i_fail') || ':fake')),
     'failed', null, null, 'terminal', 'template_param_mismatch', 400, '{"errorCode":132000}'::jsonb) ->> 'outcome'),
  'failed', 'FAILED: a terminal provider rejection is recorded'
);
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i_fail')::uuid, 'fake', 'again')),
  'not_claimable', 'FAILED: a failed intent is not claimable again'
);
reset role;
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6500000-0000-4000-8000-000000000001' and provider_message_type = 'template'),
  2, 'FAILED: no canonical message exists for the failed send'
);

-- =============================================================================
-- 10. Lifecycle guards
-- =============================================================================

select throws_ok(
  $$update public.whatsapp_template_send_intents set lifecycle_status = 'eligible' where id = current_setting('test.i_fail')::uuid$$,
  '23514', NULL, 'GUARD: failed -> eligible is refused (no silent retry)'
);
select throws_ok(
  $$update public.whatsapp_template_send_intents set preview_text = 'rewritten' where id = current_setting('test.i1')::uuid$$,
  '42501', NULL, 'GUARD: the recorded preview is immutable'
);
select throws_ok(
  $$delete from public.whatsapp_template_send_intents where id = current_setting('test.i1')::uuid$$,
  '55000', NULL, 'GUARD: intents cannot be deleted'
);
select throws_ok(
  $$update public.whatsapp_template_dispatch_attempts set provider_message_id = 'wamid.other' where template_send_intent_id = current_setting('test.i1')::uuid$$,
  '23514', NULL, 'GUARD: a succeeded attempt is final'
);

-- =============================================================================
-- 11. Send-time re-checks: reassignment, tombstone, approval, content drift
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select lives_ok(
  $$select set_config('test.i_reassign', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Wednesday"}}'::jsonb, 'a6500002-0000-4000-8000-000000000040') ->> 'intent_id'), true)$$,
  'REASSIGN: Sales Executive A records an intent while assigned'
);
select lives_ok(
  $$select set_config('test.i_tomb', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000002', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Neha","2":"Friday"}}'::jsonb, 'a6500002-0000-4000-8000-000000000041') ->> 'intent_id'), true)$$,
  'TOMBSTONE: Sales Executive A records an intent while the lead is live'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.assign_lead('b6500000-0000-4000-8000-000000000001'::uuid, 'a6500001-0000-4000-8000-000000000005'::uuid, 'WM-2 reassignment proof')$$,
  'REASSIGN: Sales Manager reassigns the lead to B before dispatch'
);

reset role;
select set_config('test.l2_updated_at', (select updated_at::text from public.leads where id = 'b6500000-0000-4000-8000-000000000002'), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.delete_lead_tombstone('b6500000-0000-4000-8000-000000000002'::uuid, 'WM-2 tombstone send proof',
      current_setting('test.l2_updated_at')::timestamptz, 'DELETE')$$,
  'TOMBSTONE: Super Admin tombstones the lead before dispatch'
);

set local role service_role;
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i_reassign')::uuid, 'fake', current_setting('test.i_reassign') || ':fake')),
  'denied_scope', 'REASSIGN: the former assignee''s intent is refused at send time'
);
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i_tomb')::uuid, 'fake', current_setting('test.i_tomb') || ':fake')),
  'denied_scope', 'TOMBSTONE: an intent on a now-tombstoned lead is refused at send time'
);
reset role;
select results_eq(
  $$select lifecycle_status || ':' || outcome_code from public.whatsapp_template_send_intents
     where id in (current_setting('test.i_reassign')::uuid, current_setting('test.i_tomb')::uuid) order by created_at$$,
  array['ineligible:denied_scope', 'ineligible:denied_scope'],
  'SEND-TIME: refusals are durable evidence, not silent drops'
);
select is(
  (select count(*)::integer from public.whatsapp_template_dispatch_attempts
    where template_send_intent_id in (current_setting('test.i_reassign')::uuid, current_setting('test.i_tomb')::uuid)),
  0, 'SEND-TIME: no provider attempt was created for a refused intent'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000001')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'REASSIGN: the former assignee loses the selector immediately'
);
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000005', true);
select is(
  (select jsonb_array_length(public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000001') -> 'items')),
  2, 'REASSIGN: the new assignee gains the selector immediately'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000002', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Neha","2":"Friday"}}'::jsonb, 'a6500002-0000-4000-8000-000000000042')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'TOMBSTONE: nobody sends — not even the Sales Manager'
);
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000002')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'TOMBSTONE: nobody sends — not even the Super Admin'
);

-- Approval loss between intent and dispatch (new assignee B).
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000005', true);
select lives_ok(
  $$select set_config('test.i_paused', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Thursday"}}'::jsonb, 'a6500002-0000-4000-8000-000000000050') ->> 'intent_id'), true)$$,
  'APPROVAL: Sales Executive B records an intent'
);
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select set_config('test.run2', (public.request_whatsapp_template_sync('900000000000651') ->> 'sync_run_id'), true)$$,
  'APPROVAL: Sales Manager requests another sync'
);
set local role service_role;
select is(
  (select public.apply_whatsapp_template_sync_item(current_setting('test.run2')::uuid,
    '165000000000001', 'order_update', 'en', 'PAUSED', 'UTILITY', 'RED', 'POSITIONAL',
    '[{"type":"BODY","text":"Hi {{1}}, your site visit is confirmed for {{2}}."},{"type":"FOOTER","text":"ONEDECORE"}]'::jsonb) ->> 'changed'),
  'true', 'APPROVAL: Meta pauses the template'
);
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i_paused')::uuid, 'fake', current_setting('test.i_paused') || ':fake')),
  'template_not_approved', 'APPROVAL: a paused template is refused at send time'
);
select is(
  (select public.apply_whatsapp_template_sync_item(current_setting('test.run2')::uuid,
    '165000000000001', 'order_update', 'en', 'APPROVED', 'UTILITY', 'GREEN', 'POSITIONAL',
    '[{"type":"BODY","text":"Hi {{1}}, your site visit is confirmed for {{2}}."},{"type":"FOOTER","text":"ONEDECORE"}]'::jsonb) ->> 'approved_snapshot_id'),
  current_setting('test.snap_order'),
  'APPROVAL: re-approval of identical content reuses the same immutable snapshot'
);
reset role;
select is(
  (select count(*)::integer from public.whatsapp_template_status_events e join public.whatsapp_templates t on t.id = e.template_id
    where t.name = 'order_update' and e.event_kind = 'changed'),
  2, 'APPROVAL: pause and re-approval are both evidenced'
);

-- Content drift: Meta edits the approved body.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000005', true);
select lives_ok(
  $$select set_config('test.i_drift', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001', current_setting('test.snap_order')::uuid,
      '{"body":{"1":"Asha","2":"Saturday"}}'::jsonb, 'a6500002-0000-4000-8000-000000000060') ->> 'intent_id'), true)$$,
  'DRIFT: an intent binds to the current snapshot'
);
set local role service_role;
select lives_ok($$
  select public.apply_whatsapp_template_sync_item(current_setting('test.run2')::uuid,
    '165000000000001', 'order_update', 'en', 'APPROVED', 'UTILITY', 'GREEN', 'POSITIONAL',
    '[{"type":"BODY","text":"Hello {{1}}, your visit is on {{2}}."}]'::jsonb)
$$, 'DRIFT: the provider reports edited approved content');
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i_drift')::uuid, 'fake', current_setting('test.i_drift') || ':fake')),
  'template_content_changed', 'DRIFT: an intent bound to superseded content is refused at send time'
);
reset role;
select is(
  (select count(*)::integer from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'order_update'),
  2, 'DRIFT: the edited content has its own snapshot; the old one is retained'
);

-- Consent withdrawal between intent and dispatch.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000005', true);
select lives_ok(
  $$select set_config('test.i_dnc', (public.create_whatsapp_utility_template_send_intent(
      'e6500000-0000-4000-8000-000000000001',
      (select (i ->> 'snapshot_id')::uuid from jsonb_array_elements(public.list_whatsapp_sendable_utility_templates('e6500000-0000-4000-8000-000000000001') -> 'items') i where i ->> 'name' = 'order_update'),
      '{"body":{"1":"Asha","2":"Sunday"}}'::jsonb, 'a6500002-0000-4000-8000-000000000070') ->> 'intent_id'), true)$$,
  'DNC: an intent on the new snapshot is recorded'
);
reset role;
update public.contacts set status = 'do_not_contact' where id = 'c6500000-0000-4000-8000-000000000001';
set local role service_role;
select is(
  (select outcome_code from public.claim_whatsapp_template_send_intent(current_setting('test.i_dnc')::uuid, 'fake', current_setting('test.i_dnc') || ':fake')),
  'denied_dnc', 'DNC: a do-not-contact change is honoured at send time'
);
reset role;
update public.contacts set status = 'active' where id = 'c6500000-0000-4000-8000-000000000001';

-- =============================================================================
-- 12. Template Studio submissions
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000001',
      'se_attempt', 'en', 'UTILITY', 'POSITIONAL', '[{"type":"BODY","text":"Hello"}]'::jsonb)$$,
  '42501', 'denied_templates_manage',
  'SUBMIT: a Sales Executive cannot submit templates'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000002',
      'otp_code', 'en', 'AUTHENTICATION', 'POSITIONAL', '[{"type":"BODY","text":"{{1}} is your code"}]'::jsonb)$$,
  '22023', 'validation: components (category_not_submittable)',
  'SUBMIT: AUTHENTICATION templates are not created from the Studio'
);
select throws_ok(
  $$select public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000003',
      'bad_positions', 'en', 'UTILITY', 'POSITIONAL', '[{"type":"BODY","text":"Hi {{2}}"}]'::jsonb)$$,
  '22023', 'validation: components (parameter_positions_not_sequential)',
  'SUBMIT: non-sequential placeholders are refused'
);
select throws_ok(
  $$select public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000004',
      'pending_util', 'en', 'UTILITY', 'POSITIONAL', '[{"type":"BODY","text":"Pending body {{1}}"}]'::jsonb)$$,
  '23505', 'template_name_language_exists',
  'SUBMIT: a live name/language cannot be resubmitted'
);
select lives_ok(
  $$select set_config('test.sub1', (public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000005',
      'visit_reminder', 'en', 'UTILITY', 'POSITIONAL',
      '[{"type":"BODY","text":"Hi {{1}}, reminder for {{2}}.","example":{"body_text":[["Asha","Monday"]]}},{"type":"FOOTER","text":"ONEDECORE"}]'::jsonb) ->> 'submission_id'), true)$$,
  'SUBMIT: Sales Manager records a submission before any provider call'
);
select is(
  (select public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000005',
      'visit_reminder', 'en', 'UTILITY', 'POSITIONAL',
      '[{"type":"BODY","text":"Hi {{1}}, reminder for {{2}}.","example":{"body_text":[["Asha","Monday"]]}},{"type":"FOOTER","text":"ONEDECORE"}]'::jsonb) ->> 'reused'),
  'true', 'SUBMIT: a replayed key returns the recorded request, not a second submission'
);
select throws_ok(
  $$select public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000006',
      'visit_reminder', 'en', 'UTILITY', 'POSITIONAL', '[{"type":"BODY","text":"Different body"}]'::jsonb)$$,
  '23505', 'template_submission_unresolved',
  'SUBMIT: an unresolved submission for the same name/language blocks a blind resubmit'
);

set local role service_role;
select is(
  (select public.record_whatsapp_template_submission_outcome(current_setting('test.sub1')::uuid, 'accepted', '165000000000099', 'PENDING', 'UTILITY', 200, null) ->> 'status'),
  'PENDING', 'SUBMIT: an accepted submission carries the provider status, not an invented approval'
);
select is(
  (select public.record_whatsapp_template_submission_outcome(current_setting('test.sub1')::uuid, 'accepted', '165000000000099', 'APPROVED', 'UTILITY', 200, null) ->> 'outcome'),
  'already_recorded', 'SUBMIT: the outcome is recorded once'
);
reset role;
select is(
  (select status || ':' || origin || ':' || provider_template_id from public.whatsapp_templates where name = 'visit_reminder'),
  'PENDING:studio_submission:165000000000099',
  'SUBMIT: the registry reflects the submission outcome'
);
select is(
  (select count(*)::integer from public.whatsapp_template_snapshots s join public.whatsapp_templates t on t.id = s.template_id where t.name = 'visit_reminder'),
  0, 'SUBMIT: a pending template has no sendable snapshot'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select set_config('test.sub2', (public.request_whatsapp_template_submission('900000000000651', 'a6500003-0000-4000-8000-000000000007',
      'no_status_back', 'en', 'UTILITY', 'POSITIONAL', '[{"type":"BODY","text":"Your order is ready."}]'::jsonb) ->> 'submission_id'), true)$$,
  'SUBMIT: Super Admin records a submission'
);
set local role service_role;
select is(
  (select public.record_whatsapp_template_submission_outcome(current_setting('test.sub2')::uuid, 'accepted', '165000000000098', null, null, 200, null) ->> 'status'),
  'unknown', 'SUBMIT: a provider response without status stays unknown, never APPROVED'
);
reset role;
select is(
  (select count(*)::integer from public.whatsapp_template_status_events where submission_id in (current_setting('test.sub1')::uuid, current_setting('test.sub2')::uuid)),
  2, 'SUBMIT: one outcome event per submission'
);
select throws_ok(
  $$update public.whatsapp_template_submissions set name = 'renamed'$$,
  '55000', NULL, 'SUBMIT: submissions are append-only'
);

-- =============================================================================
-- 13. Inbound media view seam
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000005', true);
select is(
  (select public.authorize_whatsapp_inbound_media_view('f6500000-0000-4000-8000-000000000001') ->> 'media_id'),
  '1650000000000001', 'MEDIA: the current assignee is authorised and receives only the provider media id'
);
select is(
  (select public.authorize_whatsapp_inbound_media_view('f6500000-0000-4000-8000-000000000001') ->> 'declared_mime_type'),
  'image/jpeg', 'MEDIA: declared MIME type is returned for server-side validation'
);
select is(
  (select count(*)::integer from public.whatsapp_media_access_events where message_id = 'f6500000-0000-4000-8000-000000000001'),
  2, 'MEDIA: every authorised view is evidenced and visible to its actor'
);
select throws_ok(
  $$select public.authorize_whatsapp_inbound_media_view('f6500000-0000-4000-8000-000000000002')$$,
  'P0002', 'whatsapp_media_not_found', 'MEDIA: a text message is not media'
);

select set_config('request.jwt.claim.sub', 'a6500001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.authorize_whatsapp_inbound_media_view('f6500000-0000-4000-8000-000000000001')$$,
  'P0002', 'whatsapp_media_not_found', 'MEDIA: the reassigned-away executive is refused like a missing message'
);
select is(
  (select count(*)::integer from public.whatsapp_media_access_events),
  0, 'MEDIA: an actor cannot read another staff member''s access evidence'
);

select * from finish();
rollback;
