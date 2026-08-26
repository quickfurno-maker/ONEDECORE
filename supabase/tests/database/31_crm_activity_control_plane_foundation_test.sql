-- CRM 2A-1 — Activity control-plane foundation pgTAP

begin;
select plan(69);

-- =============================================================================
-- Schema
-- =============================================================================

select has_table('public', 'lead_activity_outcome_codes', 'outcome catalogue exists');
select has_table('public', 'lead_follow_up_events', 'lead_follow_up_events exists');

select has_column('public', 'lead_follow_ups', 'activity_type', 'activity_type column');
select has_column('public', 'lead_follow_ups', 'title', 'title column');
select has_column('public', 'lead_follow_ups', 'priority', 'priority column');
select has_column('public', 'lead_follow_ups', 'is_primary_next_action', 'is_primary_next_action column');
select has_column('public', 'lead_follow_ups', 'duration_minutes', 'duration_minutes column');
select has_column('public', 'lead_follow_ups', 'reminder_at', 'reminder_at column');
select has_column('public', 'lead_follow_ups', 'outcome_code', 'outcome_code column');
select has_column('public', 'lead_follow_ups', 'completion_note', 'completion_note column');
select has_column('public', 'lead_follow_ups', 'quotation_id', 'quotation_id column');
select has_column('public', 'lead_follow_ups', 'source', 'source column');
select has_column('public', 'lead_follow_ups', 'updated_at', 'updated_at column');

select results_eq(
  $$select count(*)::integer from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name like 'next_action_%'$$,
  array[0],
  'leads has no next_action_* columns'
);

select results_eq(
  $$select closes_contact_attempt from public.lead_activity_outcome_codes where code = 'voicemail'$$,
  array[true],
  'voicemail closes_contact_attempt = true (later SLA attempt)'
);

select results_eq(
  $$select closes_contact_attempt from public.lead_activity_outcome_codes where code = 'whatsapp_sent'$$,
  array[false],
  'whatsapp_sent alone does not close contact attempt'
);

select results_eq(
  $$select count(*)::integer from public.lead_activity_outcome_codes where is_active$$,
  array[12],
  '12 seeded outcome codes'
);

select has_index(
  'public',
  'lead_follow_ups',
  'uq_lead_follow_ups_one_primary_open',
  'partial unique one open primary index'
);

select has_index(
  'public',
  'lead_follow_ups',
  'idx_lead_follow_ups_owner_primary_open_due',
  'owner primary open due index'
);

select has_index(
  'public',
  'lead_follow_up_events',
  'idx_lead_follow_up_events_lead_created',
  'events by lead + created_at index'
);

select has_index(
  'public',
  'lead_follow_up_events',
  'idx_lead_follow_up_events_follow_up_created',
  'events by follow_up + created_at index'
);

select has_function(
  'private',
  'crm_user_can_operate_lead',
  array['uuid', 'uuid', 'text'],
  'crm_user_can_operate_lead exists'
);

select results_eq(
  $$select has_function_privilege('anon', 'private.crm_user_can_operate_lead(uuid,uuid,text)', 'execute')$$,
  array[false],
  'anon cannot execute crm_user_can_operate_lead'
);

select results_eq(
  $$select has_function_privilege('public', 'private.crm_user_can_operate_lead(uuid,uuid,text)', 'execute')$$,
  array[false],
  'public role cannot execute crm_user_can_operate_lead'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_up_events', 'INSERT')$$,
  array[false],
  'authenticated cannot INSERT lead_follow_up_events'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_up_events', 'UPDATE')$$,
  array[false],
  'authenticated cannot UPDATE lead_follow_up_events'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_up_events', 'DELETE')$$,
  array[false],
  'authenticated cannot DELETE lead_follow_up_events'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_follow_up_events', 'SELECT')$$,
  array[true],
  'authenticated has SELECT on lead_follow_up_events'
);

-- =============================================================================
-- Fixtures
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa2a1@example.test', 'authenticated', 'authenticated'),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'mgr2a1@example.test', 'authenticated', 'authenticated'),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'execa2a1@example.test', 'authenticated', 'authenticated'),
  ('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'execb2a1@example.test', 'authenticated', 'authenticated'),
  ('e6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'notes2a1@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'e1111111-1111-1111-1111-111111111111',
  'e2222222-2222-2222-2222-222222222222',
  'e3333333-3333-3333-3333-333333333333',
  'e4444444-4444-4444-4444-444444444444',
  'e6666666-6666-6666-6666-666666666666'
);

insert into public.user_roles (user_id, role_id)
select 'e1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'e2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'e3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'e4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';

insert into public.roles (code, name, description, is_system) values
  ('crm_notes_only_2a1', 'CRM Notes Only 2A1', '2A-1 notes-only synthetic role', false)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'crm_notes_only_2a1'
  and p.code in (
    'leads.read_assigned', 'leads.transition', 'crm.notes.manage',
    'crm.activities.read', 'sources.read', 'consents.read'
  )
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select 'e6666666-6666-6666-6666-666666666666', id from public.roles where code = 'crm_notes_only_2a1'
on conflict do nothing;

select * from public.submit_lead_intake(
  p_idempotency_key => 'eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A1 Lead A',
  p_phone_e164 => '+919311111111',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select * from public.submit_lead_intake(
  p_idempotency_key => 'ebbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  p_request_hash => repeat('d', 64),
  p_network_fingerprint_hash => repeat('e', 64),
  p_phone_fingerprint_hash => repeat('f', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A1 Lead B',
  p_phone_e164 => '+919322222222',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['kitchen']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select * from public.submit_lead_intake(
  p_idempotency_key => 'eccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  p_request_hash => repeat('1', 64),
  p_network_fingerprint_hash => repeat('2', 64),
  p_phone_fingerprint_hash => repeat('3', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A1 Lead C',
  p_phone_e164 => '+919333333333',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['bedrooms']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select * from public.submit_lead_intake(
  p_idempotency_key => 'eddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  p_request_hash => repeat('4', 64),
  p_network_fingerprint_hash => repeat('5', 64),
  p_phone_fingerprint_hash => repeat('6', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => '2A1 Lead D',
  p_phone_e164 => '+919344444444',
  p_submitted_email => null,
  p_service_code => 'complete-home-interiors',
  p_property_code => 'apartment-2bhk',
  p_timeline_code => 'within-1-month',
  p_room_codes => array['living']::text[],
  p_budget_comfort_code => '6-12l',
  p_estimate_snapshot => null,
  p_locality => null,
  p_message => null,
  p_landing_path => '/',
  p_attribution => '{}'::jsonb,
  p_source => 'local-test',
  p_consent_service_enquiry => true,
  p_consent_service_phone => true,
  p_consent_service_email => false,
  p_consent_whatsapp => false,
  p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
  p_copy_service_communication => 'service-communication-v0.1-draft',
  p_copy_whatsapp => null,
  p_notice_version => 'privacy-notice-v0.1-draft'
);

select set_config('test.lead_a', (select id::text from public.leads where submitted_name = '2A1 Lead A' limit 1), true);
select set_config('test.lead_b', (select id::text from public.leads where submitted_name = '2A1 Lead B' limit 1), true);
select set_config('test.lead_c', (select id::text from public.leads where submitted_name = '2A1 Lead C' limit 1), true);
select set_config('test.lead_d', (select id::text from public.leads where submitted_name = '2A1 Lead D' limit 1), true);

-- =============================================================================
-- Deterministic backfill simulation (migration ranking rule)
-- =============================================================================

insert into public.lead_follow_ups (
  id, lead_id, owner_id, due_at, status, created_by, created_at, is_primary_next_action
) values
  (
    'f1000000-0000-4000-8000-000000000001',
    current_setting('test.lead_d')::uuid,
    'e3333333-3333-3333-3333-333333333333',
    now() + interval '3 days',
    'open',
    'e2222222-2222-2222-2222-222222222222',
    now() - interval '2 hours',
    false
  ),
  (
    'f1000000-0000-4000-8000-000000000002',
    current_setting('test.lead_d')::uuid,
    'e3333333-3333-3333-3333-333333333333',
    now() + interval '1 day',
    'open',
    'e2222222-2222-2222-2222-222222222222',
    now() - interval '1 hour',
    false
  ),
  (
    'f1000000-0000-4000-8000-000000000003',
    current_setting('test.lead_d')::uuid,
    'e3333333-3333-3333-3333-333333333333',
    now() + interval '1 day',
    'open',
    'e2222222-2222-2222-2222-222222222222',
    now() - interval '30 minutes',
    false
  );

with ranked as (
  select id, row_number() over (
    partition by lead_id
    order by due_at asc nulls last, created_at asc, id asc
  ) as rn
  from public.lead_follow_ups
  where lead_id = current_setting('test.lead_d')::uuid
    and status = 'open'
)
update public.lead_follow_ups f
set is_primary_next_action = (r.rn = 1),
    updated_at = now()
from ranked r
where f.id = r.id;

select results_eq(
  $$select id::text from public.lead_follow_ups
    where lead_id = current_setting('test.lead_d')::uuid
      and is_primary_next_action
    order by id$$,
  array['f1000000-0000-4000-8000-000000000002'],
  'deterministic ranking: earliest due then created_at then id is primary'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
    where lead_id = current_setting('test.lead_d')::uuid$$,
  array[3],
  'historical open rows preserved during ranking'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id in (
      'f1000000-0000-4000-8000-000000000001'::uuid,
      'f1000000-0000-4000-8000-000000000002'::uuid,
      'f1000000-0000-4000-8000-000000000003'::uuid
    )$$,
  array[0],
  'no fabricated lifecycle events for historical/direct rows'
);

select throws_ok(
  $$update public.lead_follow_ups
    set is_primary_next_action = true
    where id = 'f1000000-0000-4000-8000-000000000001'::uuid$$,
  '23505',
  null,
  'second open primary on same lead rejected'
);

-- =============================================================================
-- Legacy create / auto-primary / events (authenticated)
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select is_primary_next_action from public.create_lead_follow_up(
    current_setting('test.lead_a')::uuid, now() + interval '2 days', null)$$,
  array[false],
  'unassigned lead create stays secondary'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events e
    join public.lead_follow_ups f on f.id = e.follow_up_id
   where f.lead_id = current_setting('test.lead_a')::uuid
     and e.event_type = 'created'$$,
  array[1],
  'create emits created'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events e
    join public.lead_follow_ups f on f.id = e.follow_up_id
   where f.lead_id = current_setting('test.lead_a')::uuid
     and e.event_type = 'primary_designated'$$,
  array[0],
  'secondary create does not emit primary_designated'
);

select public.assign_lead(
  current_setting('test.lead_a')::uuid,
  'e3333333-3333-3333-3333-333333333333'::uuid,
  null
);

select results_eq(
  $$select is_primary_next_action from public.create_lead_follow_up(
    current_setting('test.lead_a')::uuid,
    now() + interval '3 days',
    'e3333333-3333-3333-3333-333333333333'::uuid)$$,
  array[true],
  'assigned active matching owner + no primary => primary'
);

select set_config('test.fu_primary_a', (
  select id::text from public.lead_follow_ups
  where lead_id = current_setting('test.lead_a')::uuid
    and is_primary_next_action = true
  order by created_at desc limit 1
), true);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.fu_primary_a')::uuid
      and event_type = 'primary_designated'$$,
  array[1],
  'auto-primary create emits primary_designated'
);

select results_eq(
  $$select is_primary_next_action from public.create_lead_follow_up(
    current_setting('test.lead_a')::uuid,
    now() + interval '4 days',
    'e3333333-3333-3333-3333-333333333333'::uuid)$$,
  array[false],
  'existing primary => new follow-up stays secondary'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
    where lead_id = current_setting('test.lead_a')::uuid
      and status = 'open'$$,
  array[3],
  'multiple open activities allowed on one lead'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_ups
    where lead_id = current_setting('test.lead_a')::uuid
      and status = 'open'
      and is_primary_next_action$$,
  array[1],
  'exactly one open primary with multiple open rows'
);

select results_eq(
  $$select is_primary_next_action from public.create_lead_follow_up(
    current_setting('test.lead_a')::uuid,
    now() + interval '5 days',
    'e4444444-4444-4444-4444-444444444444'::uuid)$$,
  array[false],
  'owner != assigned_to => secondary'
);

select public.assign_lead(
  current_setting('test.lead_b')::uuid,
  'e3333333-3333-3333-3333-333333333333'::uuid,
  null
);
select public.transition_lead_status(
  current_setting('test.lead_b')::uuid,
  'on_hold',
  'Hold for budget review cycle'
);

select results_eq(
  $$select is_primary_next_action from public.create_lead_follow_up(
    current_setting('test.lead_b')::uuid,
    now() + interval '1 day',
    'e3333333-3333-3333-3333-333333333333'::uuid)$$,
  array[false],
  'on_hold lead create stays secondary'
);

select public.assign_lead(
  current_setting('test.lead_c')::uuid,
  'e3333333-3333-3333-3333-333333333333'::uuid,
  null
);
select public.transition_lead_status(
  current_setting('test.lead_c')::uuid,
  'closed_lost',
  'Closed for test terminal auto-primary gate',
  'other'
);

select results_eq(
  $$select is_primary_next_action from public.create_lead_follow_up(
    current_setting('test.lead_c')::uuid,
    now() + interval '1 day',
    'e3333333-3333-3333-3333-333333333333'::uuid)$$,
  array[false],
  'terminal closed_lost create stays secondary'
);

select results_eq(
  $$select count(*)::integer from (
      select lead_id from public.lead_follow_ups
      where status = 'open' and is_primary_next_action
        and lead_id in (
          current_setting('test.lead_a')::uuid,
          current_setting('test.lead_d')::uuid
        )
      group by lead_id
    ) t$$,
  array[2],
  'different leads may each have their own primary'
);

select results_eq(
  $$select is_primary_next_action, status::text from public.complete_lead_follow_up(
    current_setting('test.fu_primary_a')::uuid, 'Reached client')$$,
  $$values (false, 'completed')$$,
  'completing primary clears flag and completes'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.fu_primary_a')::uuid
      and event_type = 'completed'$$,
  array[1],
  'complete emits completed'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.fu_primary_a')::uuid
      and event_type = 'outcome_recorded'$$,
  array[1],
  'complete with outcome emits outcome_recorded'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.fu_primary_a')::uuid
      and event_type = 'primary_cleared'$$,
  array[1],
  'completing primary emits primary_cleared'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where reference_id = current_setting('test.fu_primary_a')::uuid
      and activity_type = 'follow_up.completed'$$,
  array[1],
  'lead_activities summary still written on complete'
);

select set_config('test.fu_cancel', (
  select id::text from public.create_lead_follow_up(
    current_setting('test.lead_a')::uuid,
    now() + interval '6 days',
    'e3333333-3333-3333-3333-333333333333'::uuid
  )
), true);

select results_eq(
  $$select is_primary_next_action from public.lead_follow_ups
    where id = current_setting('test.fu_cancel')::uuid$$,
  array[true],
  'new primary after prior primary completed'
);

select results_eq(
  $$select is_primary_next_action, status::text from public.cancel_lead_follow_up(
    current_setting('test.fu_cancel')::uuid, 'client cancelled')$$,
  $$values (false, 'cancelled')$$,
  'cancelling primary clears flag and cancels'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.fu_cancel')::uuid
      and event_type = 'cancelled'$$,
  array[1],
  'cancel emits cancelled'
);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.fu_cancel')::uuid
      and event_type = 'primary_cleared'$$,
  array[1],
  'cancelling primary emits primary_cleared'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where reference_id = current_setting('test.fu_cancel')::uuid
      and activity_type = 'follow_up.cancelled'$$,
  array[1],
  'lead_activities summary still written on cancel'
);

select set_config('test.fu_no_outcome', (
  select id::text from public.create_lead_follow_up(
    current_setting('test.lead_a')::uuid,
    now() + interval '7 days',
    'e3333333-3333-3333-3333-333333333333'::uuid
  )
), true);

select public.complete_lead_follow_up(current_setting('test.fu_no_outcome')::uuid, null);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where follow_up_id = current_setting('test.fu_no_outcome')::uuid
      and event_type = 'outcome_recorded'$$,
  array[0],
  'complete without outcome does not emit outcome_recorded'
);

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select count(*)::integer > 0 from public.lead_follow_up_events
    where lead_id = current_setting('test.lead_a')::uuid$$,
  array[true],
  'assigned exec can SELECT events for own lead'
);

select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-4444-444444444444', true);

select results_eq(
  $$select count(*)::integer from public.lead_follow_up_events
    where lead_id = current_setting('test.lead_a')::uuid$$,
  array[0],
  'other exec cannot SELECT events for non-owned lead'
);

-- =============================================================================
-- Owner-aware auth helper
-- =============================================================================

reset role;
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select private.crm_user_can_operate_lead(
    'e3333333-3333-3333-3333-333333333333'::uuid,
    current_setting('test.lead_a')::uuid,
    'crm.follow_ups.manage')$$,
  array[true],
  'target assigned rep + own lead => true'
);

select results_eq(
  $$select private.crm_user_can_operate_lead(
    'e4444444-4444-4444-4444-444444444444'::uuid,
    current_setting('test.lead_a')::uuid,
    'crm.follow_ups.manage')$$,
  array[false],
  'target rep + another rep lead => false'
);

select results_eq(
  $$select private.crm_user_can_operate_lead(
    'e2222222-2222-2222-2222-222222222222'::uuid,
    current_setting('test.lead_a')::uuid,
    'crm.follow_ups.manage')$$,
  array[true],
  'broad manager + follow_ups.manage => true'
);

select results_eq(
  $$select private.crm_user_can_operate_lead(
    'e6666666-6666-6666-6666-666666666666'::uuid,
    current_setting('test.lead_a')::uuid,
    'crm.follow_ups.manage')$$,
  array[false],
  'missing crm.follow_ups.manage => false'
);

update public.profiles
set status = 'suspended'
where id = 'e3333333-3333-3333-3333-333333333333';

select results_eq(
  $$select private.crm_user_can_operate_lead(
    'e3333333-3333-3333-3333-333333333333'::uuid,
    current_setting('test.lead_a')::uuid,
    'crm.follow_ups.manage')$$,
  array[false],
  'inactive/ineligible target => false'
);

update public.profiles
set status = 'active'
where id = 'e3333333-3333-3333-3333-333333333333';

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select private.crm_user_can_operate_lead(
    'e4444444-4444-4444-4444-444444444444'::uuid,
    current_setting('test.lead_a')::uuid,
    'crm.follow_ups.manage')$$,
  array[false],
  'caller manager identity does not make unauthorized target true'
);

-- =============================================================================
-- Event integrity / append-only / quotation same-lead
-- =============================================================================

select throws_ok(
  $$update public.lead_follow_up_events set reason_note = 'tamper' where id = (
      select id from public.lead_follow_up_events limit 1
    )$$,
  '55000',
  null,
  'UPDATE on lead_follow_up_events forbidden'
);

select throws_ok(
  $$delete from public.lead_follow_up_events where id = (
      select id from public.lead_follow_up_events limit 1
    )$$,
  '55000',
  null,
  'DELETE on lead_follow_up_events forbidden'
);

select throws_ok(
  $$insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type
    ) values (
      current_setting('test.fu_primary_a')::uuid,
      current_setting('test.lead_b')::uuid,
      'e2222222-2222-2222-2222-222222222222'::uuid,
      'created'
    )$$,
  '23514',
  null,
  'follow_up_id / lead_id mismatch rejected'
);

select throws_ok(
  $$insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type, new_values
    ) values (
      current_setting('test.fu_primary_a')::uuid,
      current_setting('test.lead_a')::uuid,
      'e2222222-2222-2222-2222-222222222222'::uuid,
      'created',
      jsonb_build_object('pad', repeat('x', 3000))
    )$$,
  '23514',
  null,
  'oversized event JSON rejected'
);

-- Quotation same-lead integrity via direct rows (root quotations schema)
insert into public.quotations (
  id, lead_id, quotation_number, status, created_by
)
select
  'a1000000-0000-4000-8000-000000000001',
  current_setting('test.lead_a')::uuid,
  'OD-Q-2026-000201',
  'active',
  'e1111111-1111-1111-1111-111111111111'
where not exists (
  select 1 from public.quotations where lead_id = current_setting('test.lead_a')::uuid
);

insert into public.quotations (
  id, lead_id, quotation_number, status, created_by
)
select
  'a1000000-0000-4000-8000-000000000002',
  current_setting('test.lead_d')::uuid,
  'OD-Q-2026-000202',
  'active',
  'e1111111-1111-1111-1111-111111111111'
where not exists (
  select 1 from public.quotations where id = 'a1000000-0000-4000-8000-000000000002'::uuid
);

select throws_ok(
  $$update public.lead_follow_ups
    set quotation_id = 'a1000000-0000-4000-8000-000000000002'::uuid
    where id = current_setting('test.fu_primary_a')::uuid$$,
  '23514',
  null,
  'quotation_id from another lead rejected'
);

select lives_ok(
  $$update public.lead_follow_ups
    set quotation_id = (
      select id from public.quotations
      where lead_id = current_setting('test.lead_a')::uuid
      limit 1
    )
    where id = current_setting('test.fu_primary_a')::uuid$$,
  'same-lead quotation_id accepted'
);

select finish();
rollback;
