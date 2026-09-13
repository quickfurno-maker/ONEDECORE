-- ONEDECORE WM-1 — CRM-owned WhatsApp inbox: tombstone read policy, reassignment,
-- per-staff read state and attention queues, proved against the real database.
--
-- WHAT THIS SUITE HAS TO SETTLE
--
-- 1. Access follows `leads.assigned_to` live. Reassigning the lead moves the
--    conversation with no WhatsApp row changing.
-- 2. A conversation on a tombstoned lead is invisible to every salesperson —
--    the former assignee included — and readable, never sendable, by manage
--    scope.
-- 3. Denial looks exactly like absence.
-- 4. Staff read state is private to its owner, cannot be forged, and only moves
--    forward.
-- 5. Every attention queue is derived in SQL from evidence, inside scope.

begin;
select plan(126);

-- =============================================================================
-- Fixtures — a64 / b64 / c64 / d64 / e64 / f64 prefixes, unique to this file
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('a6400001-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', '64-sa@example.test', 'authenticated', 'authenticated'),
  ('a6400001-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', '64-sm@example.test', 'authenticated', 'authenticated'),
  ('a6400001-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', '64-mgmt@example.test', 'authenticated', 'authenticated'),
  ('a6400001-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', '64-se-a@example.test', 'authenticated', 'authenticated'),
  ('a6400001-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', '64-se-b@example.test', 'authenticated', 'authenticated'),
  ('a6400001-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', '64-sales@example.test', 'authenticated', 'authenticated'),
  ('a6400001-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', '64-pm@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'a6400001-0000-4000-8000-000000000001',
  'a6400001-0000-4000-8000-000000000002',
  'a6400001-0000-4000-8000-000000000003',
  'a6400001-0000-4000-8000-000000000004',
  'a6400001-0000-4000-8000-000000000005',
  'a6400001-0000-4000-8000-000000000006',
  'a6400001-0000-4000-8000-000000000007'
);

insert into public.user_roles (user_id, role_id)
select v.user_id::uuid, r.id
from (values
  ('a6400001-0000-4000-8000-000000000001', 'super_admin'),
  ('a6400001-0000-4000-8000-000000000002', 'sales_manager'),
  ('a6400001-0000-4000-8000-000000000003', 'management'),
  ('a6400001-0000-4000-8000-000000000004', 'sales_executive'),
  ('a6400001-0000-4000-8000-000000000005', 'sales_executive'),
  ('a6400001-0000-4000-8000-000000000006', 'sales'),
  ('a6400001-0000-4000-8000-000000000007', 'project_manager')
) as v(user_id, role_code)
join public.roles r on r.code = v.role_code;

insert into public.contacts (id, display_name, status) values
  ('c6400000-0000-4000-8000-000000000001', 'WM1 Probe Live', 'active'),
  ('c6400000-0000-4000-8000-000000000002', 'WM1 Probe Tombstone', 'active'),
  ('c6400000-0000-4000-8000-000000000003', 'WM1 Probe Old', 'active'),
  ('c6400000-0000-4000-8000-000000000004', 'WM1 Probe FollowUp Due', 'active'),
  ('c6400000-0000-4000-8000-000000000005', 'WM1 Probe FollowUp Future', 'active');

-- Every lead starts assigned to Sales Executive A.
insert into public.leads (
  id, submission_reference, contact_id, submitted_name, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code,
  planner_version, landing_path, assigned_to
)
select
  v.lead_id::uuid, v.lead_id::uuid, v.contact_id::uuid, v.name, 'assigned', 'website-planner',
  (select id from public.lead_sources where code = 'website_planner'), 'public_intake',
  'complete-home-interiors', 'apartment-3bhk', 'immediate', 'v1', '/planner',
  'a6400001-0000-4000-8000-000000000004'::uuid
from (values
  ('b6400000-0000-4000-8000-000000000001', 'c6400000-0000-4000-8000-000000000001', 'WM1 Probe Live'),
  ('b6400000-0000-4000-8000-000000000002', 'c6400000-0000-4000-8000-000000000002', 'WM1 Probe Tombstone'),
  ('b6400000-0000-4000-8000-000000000003', 'c6400000-0000-4000-8000-000000000003', 'WM1 Probe Old'),
  ('b6400000-0000-4000-8000-000000000004', 'c6400000-0000-4000-8000-000000000004', 'WM1 Probe FollowUp Due'),
  ('b6400000-0000-4000-8000-000000000005', 'c6400000-0000-4000-8000-000000000005', 'WM1 Probe FollowUp Future')
) as v(lead_id, contact_id, name);

-- Follow-ups: open + overdue on L4; open + future and completed + overdue on L5.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000001', true);

insert into public.lead_follow_ups (lead_id, owner_id, due_at, status, created_by)
values
  ('b6400000-0000-4000-8000-000000000004', 'a6400001-0000-4000-8000-000000000004',
   now() - interval '1 day', 'open', 'a6400001-0000-4000-8000-000000000001'),
  ('b6400000-0000-4000-8000-000000000005', 'a6400001-0000-4000-8000-000000000004',
   now() + interval '2 days', 'open', 'a6400001-0000-4000-8000-000000000001');

insert into public.lead_follow_ups (
  lead_id, owner_id, due_at, status, created_by, completed_by, completed_at
)
values (
  'b6400000-0000-4000-8000-000000000005', 'a6400001-0000-4000-8000-000000000004',
  now() - interval '3 days', 'completed', 'a6400001-0000-4000-8000-000000000001',
  'a6400001-0000-4000-8000-000000000004', now() - interval '2 days'
);

insert into public.whatsapp_business_accounts (id, waba_id, status)
values ('d6400000-0000-4000-8000-000000000001', '900000000000064', 'active');

insert into public.whatsapp_phone_numbers (
  id, business_account_id, phone_number_id, display_phone_number, status
)
values (
  'd6400000-0000-4000-8000-000000000002',
  'd6400000-0000-4000-8000-000000000001',
  '900000000000065',
  '+919764000099',
  'active'
);

insert into public.whatsapp_conversations (
  id, phone_number_id, customer_e164, contact_id, lead_id, display_name_snapshot,
  last_message_at, last_inbound_at
)
values
  -- C1 live, assigned
  ('e6400000-0000-4000-8000-000000000001', 'd6400000-0000-4000-8000-000000000002', '+919764000001',
   'c6400000-0000-4000-8000-000000000001', 'b6400000-0000-4000-8000-000000000001', 'WM1 Probe Live',
   now() - interval '2 hours', now() - interval '2 hours'),
  -- C2 will be tombstoned
  ('e6400000-0000-4000-8000-000000000002', 'd6400000-0000-4000-8000-000000000002', '+919764000002',
   'c6400000-0000-4000-8000-000000000002', 'b6400000-0000-4000-8000-000000000002', 'WM1 Probe Tombstone',
   now() - interval '4 hours', now() - interval '4 hours'),
  -- C3 unlinked
  ('e6400000-0000-4000-8000-000000000003', 'd6400000-0000-4000-8000-000000000002', '+919764000003',
   null, null, 'WM1 Probe Unlinked',
   now() - interval '6 hours', now() - interval '6 hours'),
  -- C4 old, outbound only
  ('e6400000-0000-4000-8000-000000000004', 'd6400000-0000-4000-8000-000000000002', '+919764000004',
   'c6400000-0000-4000-8000-000000000003', 'b6400000-0000-4000-8000-000000000003', 'WM1 Probe Old',
   now() - interval '30 days', null),
  -- C5 follow-up due
  ('e6400000-0000-4000-8000-000000000005', 'd6400000-0000-4000-8000-000000000002', '+919764000005',
   'c6400000-0000-4000-8000-000000000004', 'b6400000-0000-4000-8000-000000000004', 'WM1 Probe FollowUp Due',
   now() - interval '5 hours', now() - interval '5 hours'),
  -- C6 follow-up future, equal inbound/outbound timestamps
  ('e6400000-0000-4000-8000-000000000006', 'd6400000-0000-4000-8000-000000000002', '+919764000006',
   'c6400000-0000-4000-8000-000000000005', 'b6400000-0000-4000-8000-000000000005', 'WM1 Probe FollowUp Future',
   now() - interval '7 hours', now() - interval '7 hours');

insert into public.whatsapp_messages (
  id, conversation_id, provider_message_id, direction, provider_message_type,
  normalized_message_type, sender_e164, recipient_e164, body_text, provider_timestamp
)
values
  ('f6400000-0000-4000-8000-000000000001', 'e6400000-0000-4000-8000-000000000001', 'wamid.WM1.01', 'outbound', 'text', 'text',
   '+919764000099', '+919764000001', 'We sent the brochure', now() - interval '3 hours'),
  ('f6400000-0000-4000-8000-000000000002', 'e6400000-0000-4000-8000-000000000001', 'wamid.WM1.02', 'inbound', 'text', 'text',
   '+919764000001', '+919764000099', 'Thanks, what about pricing?', now() - interval '2 hours'),
  ('f6400000-0000-4000-8000-000000000003', 'e6400000-0000-4000-8000-000000000002', 'wamid.WM1.03', 'inbound', 'text', 'text',
   '+919764000002', '+919764000099', 'Tombstone history message', now() - interval '4 hours'),
  ('f6400000-0000-4000-8000-000000000004', 'e6400000-0000-4000-8000-000000000003', 'wamid.WM1.04', 'inbound', 'text', 'text',
   '+919764000003', '+919764000099', 'Unknown sender hello', now() - interval '6 hours'),
  ('f6400000-0000-4000-8000-000000000005', 'e6400000-0000-4000-8000-000000000004', 'wamid.WM1.05', 'outbound', 'text', 'text',
   '+919764000099', '+919764000004', 'Checking in after a month', now() - interval '30 days'),
  ('f6400000-0000-4000-8000-000000000006', 'e6400000-0000-4000-8000-000000000005', 'wamid.WM1.06', 'inbound', 'text', 'text',
   '+919764000005', '+919764000099', 'Please call me back', now() - interval '5 hours'),
  ('f6400000-0000-4000-8000-000000000007', 'e6400000-0000-4000-8000-000000000006', 'wamid.WM1.07', 'inbound', 'text', 'text',
   '+919764000006', '+919764000099', 'Same second inbound', now() - interval '7 hours'),
  ('f6400000-0000-4000-8000-000000000008', 'e6400000-0000-4000-8000-000000000006', 'wamid.WM1.08', 'outbound', 'text', 'text',
   '+919764000099', '+919764000006', 'Same second outbound', now() - interval '7 hours');

-- =============================================================================
-- 9. RLS / grants / function hygiene (asserted first: they frame everything)
-- =============================================================================

select has_table('public', 'whatsapp_conversation_staff_state', 'staff state table exists');
select col_is_pk(
  'public', 'whatsapp_conversation_staff_state', array['conversation_id', 'staff_user_id'],
  'staff state PK is (conversation_id, staff_user_id)'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.whatsapp_conversation_staff_state'::regclass),
  'staff state has RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.whatsapp_conversation_staff_state'::regclass),
  'staff state has RLS forced'
);
select ok(
  not has_table_privilege('anon', 'public.whatsapp_conversation_staff_state', 'SELECT'),
  'anon cannot select staff state'
);
select ok(
  has_table_privilege('authenticated', 'public.whatsapp_conversation_staff_state', 'SELECT'),
  'authenticated may select staff state (RLS decides which rows)'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_conversation_staff_state', 'INSERT')
  and not has_table_privilege('authenticated', 'public.whatsapp_conversation_staff_state', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.whatsapp_conversation_staff_state', 'DELETE')
  and not has_table_privilege('authenticated', 'public.whatsapp_conversation_staff_state', 'TRUNCATE'),
  'authenticated has no direct write on staff state'
);
select ok(
  not has_function_privilege('anon', 'public.mark_whatsapp_conversation_read(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.mark_whatsapp_conversation_read_impl(uuid)', 'EXECUTE'),
  'anon cannot execute the WM-1 RPCs'
);
select ok(
  not exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid in (
      'public.mark_whatsapp_conversation_read(uuid)'::regprocedure,
      'public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid)'::regprocedure,
      'private.mark_whatsapp_conversation_read_impl(uuid)'::regprocedure
    )
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC holds no EXECUTE on the WM-1 RPCs'
);
select ok(
  has_function_privilege('authenticated', 'public.mark_whatsapp_conversation_read(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid)', 'EXECUTE'),
  'authenticated may execute the WM-1 RPCs'
);
select ok(
  not has_function_privilege('authenticated', 'private.whatsapp_conversation_staff_state_guard()', 'EXECUTE'),
  'authenticated cannot execute the guard trigger function'
);
select is(
  (select count(*)::integer
     from pg_proc p
    where p.oid in (
      'private.whatsapp_inbox_can_view_conversation(uuid)'::regprocedure,
      'private.mark_whatsapp_conversation_read_impl(uuid)'::regprocedure,
      'public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid)'::regprocedure
    )
      and p.prosecdef
      and 'search_path=""' = any(p.proconfig)),
  3,
  'view predicate, mark-read impl and list RPC are SECURITY DEFINER with search_path = empty'
);
select ok(
  exists (
    select 1 from pg_proc p
    where p.oid = 'public.mark_whatsapp_conversation_read(uuid)'::regprocedure
      and not p.prosecdef
      and 'search_path=""' = any(p.proconfig)
  ),
  'public mark-read wrapper is SECURITY INVOKER with search_path = empty'
);
select matches(
  pg_get_functiondef('private.whatsapp_inbox_can_use_conversation(uuid)'::regprocedure),
  'from public\.leads where deleted_at is null',
  'use predicate still filters tombstoned leads (unchanged by WM-1)'
);
select matches(
  pg_get_functiondef('private.whatsapp_inbox_actor_can_use_conversation(uuid, uuid)'::regprocedure),
  'from public\.leads where deleted_at is null',
  'dispatch use predicate still filters tombstoned leads (unchanged by WM-1)'
);

-- =============================================================================
-- 1. LIVE ASSIGNMENT
-- =============================================================================

set local role authenticated;

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000001'),
  1, 'LIVE: Sales A reads the assigned conversation'
);
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  2, 'LIVE: Sales A reads its messages'
);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'read')
  and public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'use'),
  'LIVE: Sales A may read and use'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000005', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000001'),
  0, 'LIVE: Sales B cannot read A''s conversation'
);
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  0, 'LIVE: Sales B cannot read A''s messages'
);
select ok(
  not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'read')
  and not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'use'),
  'LIVE: Sales B may neither read nor use'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000001'),
  1, 'LIVE: Sales Manager reads the conversation'
);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'read')
  and public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'use'),
  'LIVE: Sales Manager may read and use'
);

-- =============================================================================
-- 2. REASSIGNMENT — through the canonical CRM RPC, no WhatsApp row touched
-- =============================================================================

reset role;
select set_config(
  'test.wm1_c1_before',
  (select c.lead_id::text || '|' || c.updated_at::text || '|' ||
          (select count(*) from public.whatsapp_messages m where m.conversation_id = c.id)::text
     from public.whatsapp_conversations c where c.id = 'e6400000-0000-4000-8000-000000000001'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000005', true);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 50, 7, 'e6400000-0000-4000-8000-000000000001')->>'total_count')::integer),
  0, 'REASSIGN before: Sales B cannot discover the conversation through the read model'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.assign_lead(
      'b6400000-0000-4000-8000-000000000001'::uuid,
      'a6400001-0000-4000-8000-000000000005'::uuid,
      'WM-1 reassignment proof')$$,
  'REASSIGN: Sales Manager reassigns the lead from A to B'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000001'),
  0, 'REASSIGN after: A immediately loses the conversation'
);
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  0, 'REASSIGN after: A immediately loses the messages'
);
select ok(
  not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'read')
  and not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'use'),
  'REASSIGN after: A may neither read nor use'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 50, 7, 'e6400000-0000-4000-8000-000000000001')->>'total_count')::integer),
  0, 'REASSIGN after: A cannot discover it through the read model'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000005', true);
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  2, 'REASSIGN after: B immediately reads the full history'
);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'read')
  and public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'use'),
  'REASSIGN after: B may read and use'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 50, 7, 'e6400000-0000-4000-8000-000000000001')->>'total_count')::integer),
  1, 'REASSIGN after: B finds it through the read model'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'read')
  and public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000001', 'use'),
  'REASSIGN after: manage scope unaffected'
);

reset role;
select is(
  (select c.lead_id::text || '|' || c.updated_at::text || '|' ||
          (select count(*) from public.whatsapp_messages m where m.conversation_id = c.id)::text
     from public.whatsapp_conversations c where c.id = 'e6400000-0000-4000-8000-000000000001'),
  current_setting('test.wm1_c1_before'),
  'REASSIGN: conversation lead_id, updated_at and message history are unchanged'
);

-- Back to A, so the attention section below runs as one salesperson.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.assign_lead(
      'b6400000-0000-4000-8000-000000000001'::uuid,
      'a6400001-0000-4000-8000-000000000004'::uuid,
      'WM-1 reassignment back')$$,
  'REASSIGN: lead handed back to A'
);

-- =============================================================================
-- 3. TOMBSTONE — former assignee invisible, manage scope historical read only
-- =============================================================================

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000002'),
  1, 'TOMBSTONE before: A reads the conversation of the still-live lead'
);

reset role;
select set_config(
  'test.wm1_l2_updated_at',
  (select updated_at::text from public.leads where id = 'b6400000-0000-4000-8000-000000000002'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.delete_lead_tombstone(
      'b6400000-0000-4000-8000-000000000002'::uuid,
      'WM-1 tombstone read policy proof',
      current_setting('test.wm1_l2_updated_at')::timestamptz,
      'DELETE')$$,
  'TOMBSTONE: Super Admin tombstones the lead through the canonical RPC'
);

-- Former assignee A.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000002'),
  0, 'TOMBSTONE: former assignee cannot SELECT the conversation'
);
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000002'),
  0, 'TOMBSTONE: former assignee cannot SELECT its messages'
);
select is(
  private.whatsapp_inbox_can_view_conversation('e6400000-0000-4000-8000-000000000002'),
  false, 'TOMBSTONE: former assignee fails the view predicate'
);
select ok(
  not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'read')
  and not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'use'),
  'TOMBSTONE: former assignee may neither read nor use'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 50, 7, 'e6400000-0000-4000-8000-000000000002')->>'total_count')::integer),
  0, 'TOMBSTONE: former assignee does not find it in the read model'
);
select throws_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000002')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'TOMBSTONE: former assignee mark-read gets the not-found signal'
);
select throws_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-0000000000ff')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'NO LEAK: a conversation that never existed gets the identical signal'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 50, 7, 'e6400000-0000-4000-8000-0000000000ff')->>'total_count')::integer),
  0, 'NO LEAK: the read model answers a nonexistent id exactly as a refused one'
);
select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
      'e6400000-0000-4000-8000-000000000002'::uuid, 'wm1-tomb-a', 'WHATSAPP_SERVICE', 'After deletion', null)$$,
  NULL, NULL,
  'TOMBSTONE: former assignee cannot send'
);

-- Sales B, who never held it.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000005', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000002'),
  0, 'TOMBSTONE: Sales B cannot SELECT the conversation'
);
select ok(
  not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'read')
  and not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'use'),
  'TOMBSTONE: Sales B may neither read nor use'
);

-- Legacy sales.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000006', true);
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000002'),
  0, 'TOMBSTONE: legacy sales cannot SELECT its messages'
);

-- Sales Manager — historical read, no send.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000002'),
  1, 'TOMBSTONE: Sales Manager reads the historical conversation'
);
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000002'),
  1, 'TOMBSTONE: Sales Manager reads the historical messages'
);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'read')
  and not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'use'),
  'TOMBSTONE: Sales Manager may read but not use'
);
select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
      'e6400000-0000-4000-8000-000000000002'::uuid, 'wm1-tomb-sm', 'WHATSAPP_SERVICE', 'After deletion', null)$$,
  NULL, NULL,
  'TOMBSTONE: Sales Manager cannot send'
);
select is(
  (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 50, 7, 'e6400000-0000-4000-8000-000000000002')->'items'->0->>'link_state'),
  'tombstoned', 'TOMBSTONE: the read model labels it tombstoned for manage scope'
);
select is(
  (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 50, 7, 'e6400000-0000-4000-8000-000000000002')->'items'->0->>'linked_lead_name'),
  null, 'TOMBSTONE: the deleted lead''s name does not cross, matching CRM visibility'
);

-- Legacy management through existing M19 manage.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000003', true);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'read')
  and not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'use'),
  'TOMBSTONE: legacy management may read but not use'
);

-- Super Admin.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000001', true);
select ok(
  public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'read')
  and not public.whatsapp_inbox_check_conversation_access('e6400000-0000-4000-8000-000000000002', 'use'),
  'TOMBSTONE: Super Admin may read but not use'
);

reset role;
select is(
  (select count(*)::integer from public.whatsapp_messages where conversation_id = 'e6400000-0000-4000-8000-000000000002'),
  1, 'TOMBSTONE: evidence retained on disk'
);

-- =============================================================================
-- 4. UNLINKED
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000003'),
  0, 'UNLINKED: a salesperson cannot discover it'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'unlinked', null, 1, 50, 7, null)->>'total_count')::integer),
  0, 'UNLINKED: the unlinked filter gives a salesperson nothing'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.whatsapp_conversations where id = 'e6400000-0000-4000-8000-000000000003'),
  1, 'UNLINKED: manage scope can read it'
);
select is(
  (select public.list_whatsapp_inbox_conversations('all_assigned', 'unlinked', 'WM1 Probe', 1, 50, 7, null)->'items'->0->>'id'),
  'e6400000-0000-4000-8000-000000000003', 'UNLINKED: manage scope triages it through the unlinked filter'
);

-- =============================================================================
-- 6. MARK READ
-- =============================================================================

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000001')->>'last_read_message_at')::timestamptz,
  now() - interval '2 hours',
  'MARK: watermark is the latest message timestamp'
);
select is(
  (select last_read_message_id from public.whatsapp_conversation_staff_state
    where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  'f6400000-0000-4000-8000-000000000002'::uuid,
  'MARK: cursor is the latest message of the same conversation'
);
select lives_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000001')$$,
  'MARK: a second call succeeds'
);
select is(
  (select count(*)::integer || '|' || max(last_read_message_at)::text
     from public.whatsapp_conversation_staff_state
    where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  '1|' || (now() - interval '2 hours')::text,
  'MARK: idempotent — one row, same watermark'
);

-- An older message arriving late must not drag the watermark back.
reset role;
insert into public.whatsapp_messages (
  id, conversation_id, provider_message_id, direction, provider_message_type,
  normalized_message_type, sender_e164, recipient_e164, body_text, provider_timestamp
)
values (
  'f6400000-0000-4000-8000-000000000009', 'e6400000-0000-4000-8000-000000000001', 'wamid.WM1.09', 'outbound', 'text', 'text',
  '+919764000099', '+919764000001', 'Backdated evidence', now() - interval '10 hours'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000001');
select is(
  (select last_read_message_id from public.whatsapp_conversation_staff_state
    where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  'f6400000-0000-4000-8000-000000000002'::uuid,
  'MARK: watermark is monotonic — a backdated message does not move it'
);

-- Unauthorized: Sales B.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000001')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'MARK: an actor who cannot view it gets not-found'
);
select throws_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000003')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'MARK: a salesperson on an unlinked conversation gets not-found'
);

reset role;
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where staff_user_id = 'a6400001-0000-4000-8000-000000000005'),
  0, 'MARK: refused calls create no state'
);

-- Provider evidence is untouched by marking read.
select is(
  (select count(*)::integer from public.whatsapp_messages
    where conversation_id = 'e6400000-0000-4000-8000-000000000001' and latest_status is not null),
  0, 'MARK: provider message status is not written'
);

-- =============================================================================
-- 7. TOMBSTONE + MARK READ
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select lives_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000002')$$,
  'TOMBSTONE+MARK: manage-scope historical reader may mark their own cursor'
);
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where conversation_id = 'e6400000-0000-4000-8000-000000000002'
      and staff_user_id = 'a6400001-0000-4000-8000-000000000002'),
  1, 'TOMBSTONE+MARK: the manager''s own row exists'
);

reset role;
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where conversation_id = 'e6400000-0000-4000-8000-000000000002'
      and staff_user_id = 'a6400001-0000-4000-8000-000000000004'),
  0, 'TOMBSTONE+MARK: the former assignee wrote nothing'
);

-- =============================================================================
-- 5. STAFF STATE ISOLATION
-- =============================================================================

-- Manager marks C1 too, so there are two cursors on the same conversation.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state),
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where staff_user_id = 'a6400001-0000-4000-8000-000000000004'),
  'ISOLATION: A sees only A''s rows'
);
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where staff_user_id = 'a6400001-0000-4000-8000-000000000004'),
  1, 'ISOLATION: A sees A''s cursor'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000005', true);
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state),
  0, 'ISOLATION: B sees no cursor at all'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where staff_user_id = 'a6400001-0000-4000-8000-000000000004'),
  0, 'ISOLATION: manage scope does not reveal A''s cursor'
);
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where staff_user_id <> 'a6400001-0000-4000-8000-000000000002'),
  0, 'ISOLATION: the manager sees only their own rows'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$insert into public.whatsapp_conversation_staff_state (conversation_id, staff_user_id)
    values ('e6400000-0000-4000-8000-000000000001', 'a6400001-0000-4000-8000-000000000005')$$,
  '42501', NULL,
  'ISOLATION: a browser session cannot write another staff member''s row'
);
select throws_ok(
  $$update public.whatsapp_conversation_staff_state
       set last_read_message_id = null
     where staff_user_id = 'a6400001-0000-4000-8000-000000000004'$$,
  '42501', NULL,
  'ISOLATION: a browser session cannot update even its own row directly'
);

-- Integrity holds for privileged writers too.
reset role;
select throws_ok(
  $$insert into public.whatsapp_conversation_staff_state (conversation_id, staff_user_id, last_read_message_id)
    values ('e6400000-0000-4000-8000-000000000005', 'a6400001-0000-4000-8000-000000000005',
            'f6400000-0000-4000-8000-000000000002')$$,
  '23514', 'whatsapp_staff_state_cursor_conversation_mismatch',
  'INTEGRITY: a cursor from another conversation is refused'
);
insert into public.whatsapp_conversation_staff_state (
  conversation_id, staff_user_id, last_read_message_id, last_read_message_at
)
values (
  'e6400000-0000-4000-8000-000000000005', 'a6400001-0000-4000-8000-000000000001',
  'f6400000-0000-4000-8000-000000000006', now() + interval '10 years'
);
select is(
  (select last_read_message_at from public.whatsapp_conversation_staff_state
    where conversation_id = 'e6400000-0000-4000-8000-000000000005'
      and staff_user_id = 'a6400001-0000-4000-8000-000000000001'),
  now() - interval '5 hours',
  'INTEGRITY: a forged watermark timestamp is replaced by the message''s own'
);
select throws_ok(
  $$update public.whatsapp_conversation_staff_state
       set last_read_message_id = null
     where conversation_id = 'e6400000-0000-4000-8000-000000000001'
       and staff_user_id = 'a6400001-0000-4000-8000-000000000004'$$,
  '23514', 'whatsapp_staff_state_watermark_regression',
  'INTEGRITY: the watermark cannot be cleared'
);
select throws_ok(
  $$update public.whatsapp_conversation_staff_state
       set last_read_message_id = 'f6400000-0000-4000-8000-000000000001'
     where conversation_id = 'e6400000-0000-4000-8000-000000000001'
       and staff_user_id = 'a6400001-0000-4000-8000-000000000004'$$,
  '23514', 'whatsapp_staff_state_watermark_regression',
  'INTEGRITY: the watermark cannot move to an older message'
);
select throws_ok(
  $$update public.whatsapp_conversation_staff_state
       set staff_user_id = 'a6400001-0000-4000-8000-000000000005'
     where conversation_id = 'e6400000-0000-4000-8000-000000000001'
       and staff_user_id = 'a6400001-0000-4000-8000-000000000004'$$,
  '42501', 'whatsapp_staff_state_identity_immutable',
  'INTEGRITY: a cursor cannot be re-owned by another staff member'
);

-- Reassignment hides the old owner's cursor from them without deleting it.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select public.assign_lead(
  'b6400000-0000-4000-8000-000000000001'::uuid,
  'a6400001-0000-4000-8000-000000000005'::uuid,
  'WM-1 cursor visibility proof'
);
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select is(
  (select count(*)::integer from public.whatsapp_conversation_staff_state
    where conversation_id = 'e6400000-0000-4000-8000-000000000001'),
  0, 'ISOLATION: after reassignment A can no longer read even their own old cursor'
);
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select public.assign_lead(
  'b6400000-0000-4000-8000-000000000001'::uuid,
  'a6400001-0000-4000-8000-000000000004'::uuid,
  'WM-1 cursor visibility proof back'
);

-- =============================================================================
-- 8. ATTENTION — every queue derived in SQL, inside scope
-- =============================================================================
--
-- As Sales A, the live probe conversations are C1, C4, C5, C6.
-- C1 was marked read above at its latest inbound (-2h).

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);

select is(
  (select array_agg(i->>'id' order by ord)
     from jsonb_array_elements(
       public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, null)->'items'
     ) with ordinality as t(i, ord)),
  array[
    'e6400000-0000-4000-8000-000000000001',
    'e6400000-0000-4000-8000-000000000005',
    'e6400000-0000-4000-8000-000000000006',
    'e6400000-0000-4000-8000-000000000004'
  ],
  'ALL: a salesperson sees exactly their live assigned chats, newest first'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, null)->>'total_count')::integer),
  (select count(*)::integer from public.whatsapp_conversations where display_name_snapshot like 'WM1 Probe%'),
  'ALL: the read model agrees with RLS for a salesperson'
);

-- Unread.
select ok(
  not exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('unread', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'UNREAD: read after mark — C1 is not unread'
);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('unread', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000005'),
  'UNREAD: before read — C5 with no watermark and an inbound is unread'
);
select ok(
  not exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('unread', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000004'),
  'UNREAD: an outbound-only conversation is never unread'
);
select is(
  (select i->>'unread' from jsonb_array_elements(
     public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'false', 'UNREAD: the row flag agrees with the queue'
);

-- A new inbound after the watermark makes C1 unread again and needing a reply.
reset role;
insert into public.whatsapp_messages (
  id, conversation_id, provider_message_id, direction, provider_message_type,
  normalized_message_type, sender_e164, recipient_e164, body_text, provider_timestamp
)
values (
  'f6400000-0000-4000-8000-000000000010', 'e6400000-0000-4000-8000-000000000001', 'wamid.WM1.10', 'inbound', 'text', 'text',
  '+919764000001', '+919764000099', 'Hello again?', now() - interval '1 hour'
);
update public.whatsapp_conversations
   set last_message_at = now() - interval '1 hour', last_inbound_at = now() - interval '1 hour'
 where id = 'e6400000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('unread', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'UNREAD: a new inbound after the watermark is unread again'
);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('needs_reply', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'NEEDS REPLY: latest inbound after latest outbound'
);
select ok(
  not exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('waiting_on_customer', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'WAITING: not while the customer has the last word'
);
select is(
  (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, 'e6400000-0000-4000-8000-000000000001')->'items'->0->>'staff_last_read_message_at')::timestamptz,
  now() - interval '2 hours',
  'UNREAD: the row carries the actor''s own watermark'
);

-- An outbound reply after it flips needs_reply -> waiting.
reset role;
insert into public.whatsapp_messages (
  id, conversation_id, provider_message_id, direction, provider_message_type,
  normalized_message_type, sender_e164, recipient_e164, body_text, provider_timestamp
)
values (
  'f6400000-0000-4000-8000-000000000011', 'e6400000-0000-4000-8000-000000000001', 'wamid.WM1.11', 'outbound', 'text', 'text',
  '+919764000099', '+919764000001', 'Pricing attached', now() - interval '30 minutes'
);
update public.whatsapp_conversations
   set last_message_at = now() - interval '30 minutes'
 where id = 'e6400000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('waiting_on_customer', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'WAITING: latest outbound after latest inbound'
);
select ok(
  not exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('needs_reply', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'NEEDS REPLY: cleared by the reply'
);
select is(
  (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, 'e6400000-0000-4000-8000-000000000001')->'items'->0->>'last_outbound_at')::timestamptz,
  now() - interval '30 minutes',
  'WAITING: the row carries the latest outbound timestamp'
);
select is(
  (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, 'e6400000-0000-4000-8000-000000000001')->'items'->0->>'preview_body_text'),
  'Pricing attached',
  'PREVIEW: the latest message body, from the database'
);

-- Equal inbound and outbound timestamps are deterministic: waiting, not needs reply.
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('waiting_on_customer', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000006')
  and not exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('needs_reply', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000006'),
  'EQUAL TIMESTAMPS: outbound >= inbound is waiting, and never also needs reply'
);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('waiting_on_customer', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000004'),
  'WAITING: outbound with no inbound at all'
);

-- Follow-up due.
select is(
  (select array_agg(i->>'id' order by i->>'id')
     from jsonb_array_elements(
       public.list_whatsapp_inbox_conversations('follow_up_due', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i),
  array['e6400000-0000-4000-8000-000000000005'],
  'FOLLOW-UP: only the open, overdue CRM follow-up qualifies; future and completed do not'
);

-- Recently active.
select ok(
  not exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('recently_active', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000004'),
  'RECENT: a 30-day-old conversation is outside the 7-day window'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('recently_active', 'all', 'WM1 Probe', 1, 50, 7, null)->>'total_count')::integer),
  3, 'RECENT: the three conversations active this week are in'
);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('recently_active', 'all', 'WM1 Probe', 1, 50, 60, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000004'),
  'RECENT: the window is a parameter — 60 days includes it'
);

-- Search and paging compose with attention.
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', '%', 1, 50, 7, null)->>'total_count')::integer),
  0, 'SEARCH: a literal % is escaped, not a wildcard'
);
select is(
  (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', '+919764000005', 1, 50, 7, null)->'items'->0->>'id'),
  'e6400000-0000-4000-8000-000000000005', 'SEARCH: matches E.164'
);
select is(
  (select jsonb_array_length(r->'items') || '|' || (r->>'total_count') || '|' || (r->'items'->0->>'id')
     from (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 2, 1, 7, null) as r) x),
  '1|4|e6400000-0000-4000-8000-000000000005',
  'PAGING: page 2 of size 1 is the second row, with the full total'
);
select is(
  (select jsonb_array_length(r->'items') || '|' || (r->>'total_count')
     from (select public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 99, 25, 7, null) as r) x),
  '0|4',
  'PAGING: a page past the end is empty but still reports the true total'
);

-- Scope still bounds every queue.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000005', true);
select is(
  (select string_agg(q || '=' || (public.list_whatsapp_inbox_conversations(q, 'all', 'WM1 Probe', 1, 50, 60, null)->>'total_count'), ',' order by q)
     from unnest(array['all_assigned', 'follow_up_due', 'needs_reply', 'recently_active', 'unread', 'waiting_on_customer']) q),
  'all_assigned=0,follow_up_due=0,needs_reply=0,recently_active=0,unread=0,waiting_on_customer=0',
  'SCOPE: Sales B, assigned none of these, gets nothing from any queue'
);

select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000002', true);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, null)->>'total_count')::integer),
  6, 'SCOPE: manage scope sees live, unlinked and tombstoned-history conversations'
);
select is(
  (select (public.list_whatsapp_inbox_conversations('all_assigned', 'all', 'WM1 Probe', 1, 50, 7, null)->>'total_count')::integer),
  (select count(*)::integer from public.whatsapp_conversations where display_name_snapshot like 'WM1 Probe%'),
  'SCOPE: the read model agrees with RLS for manage scope'
);
select ok(
  not exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('follow_up_due', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000002'),
  'FOLLOW-UP: a tombstoned history conversation is never actionable'
);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('unread', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000005'),
  'UNREAD: per staff member — A''s cursor does not mark C5 read for the manager'
);
select ok(
  exists (
    select 1 from jsonb_array_elements(
      public.list_whatsapp_inbox_conversations('unread', 'all', 'WM1 Probe', 1, 50, 7, null)->'items') i
    where i->>'id' = 'e6400000-0000-4000-8000-000000000001'),
  'UNREAD: the manager''s own cursor on C1 predates the new inbound'
);

-- Project manager: no inbox permission at all.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000007', true);
select throws_ok(
  $$select public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 25, 7, null)$$,
  '42501', 'denied_inbox_read',
  'SCOPE: an actor without whatsapp.inbox.read is refused the read model'
);
select throws_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000001')$$,
  'P0002', 'whatsapp_conversation_not_found',
  'SCOPE: and mark-read reveals nothing to them either'
);

-- Validation.
select set_config('request.jwt.claim.sub', 'a6400001-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.list_whatsapp_inbox_conversations('everything', 'all', null, 1, 25, 7, null)$$,
  '22023', 'validation: attention',
  'VALIDATION: unknown attention filter is refused'
);
select throws_ok(
  $$select public.list_whatsapp_inbox_conversations('all_assigned', 'mine', null, 1, 25, 7, null)$$,
  '22023', 'validation: link_filter',
  'VALIDATION: unknown link filter is refused'
);
select throws_ok(
  $$select public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 51, 7, null)$$,
  '22023', 'validation: page_size',
  'VALIDATION: page size is bounded'
);
select throws_ok(
  $$select public.list_whatsapp_inbox_conversations('recently_active', 'all', null, 1, 25, 0, null)$$,
  '22023', 'validation: recent_window_days',
  'VALIDATION: the recent window is bounded'
);

-- Unauthenticated and anon.
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.mark_whatsapp_conversation_read('e6400000-0000-4000-8000-000000000001')$$,
  '28000', NULL,
  'AUTH: mark-read requires an authenticated actor'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.list_whatsapp_inbox_conversations('all_assigned', 'all', null, 1, 25, 7, null)$$,
  '42501', NULL,
  'ANON: cannot execute the read model'
);
select throws_ok(
  $$select count(*) from public.whatsapp_conversation_staff_state$$,
  '42501', NULL,
  'ANON: cannot read staff state'
);

reset role;
select * from finish();
rollback;
