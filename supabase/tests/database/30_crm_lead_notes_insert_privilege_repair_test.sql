-- ONEDECORE Phase 10 — CRM lead_notes INSERT privilege repair (final state)

begin;
select plan(20);

-- ---------------------------------------------------------------------------
-- Privilege matrix (final migration state)
-- ---------------------------------------------------------------------------

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_notes', 'SELECT')$$,
  array[true],
  'authenticated has SELECT on public.lead_notes'
);

select results_eq(
  $$select has_column_privilege('authenticated', 'public.lead_notes', 'lead_id', 'INSERT')
     and has_column_privilege('authenticated', 'public.lead_notes', 'body', 'INSERT')$$,
  array[true],
  'authenticated can INSERT required app columns lead_id and body'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_notes', 'UPDATE')$$,
  array[false],
  'authenticated does NOT have UPDATE on public.lead_notes'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_notes', 'DELETE')$$,
  array[false],
  'authenticated does NOT have DELETE on public.lead_notes'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.lead_notes', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.lead_notes', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.lead_notes', 'TRIGGER')$$,
  array[false],
  'authenticated does NOT receive TRUNCATE/REFERENCES/TRIGGER on lead_notes'
);

select results_eq(
  $$select has_column_privilege('authenticated', 'public.lead_notes', 'created_by', 'INSERT')
     or has_column_privilege('authenticated', 'public.lead_notes', 'created_at', 'INSERT')
     or has_column_privilege('authenticated', 'public.lead_notes', 'id', 'INSERT')$$,
  array[false],
  'authenticated cannot INSERT created_by, created_at, or id'
);

select results_eq(
  $$select relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'lead_notes'$$,
  array[true],
  'RLS enabled on public.lead_notes'
);

select results_eq(
  $$select count(*)::integer from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_notes'
      and policyname = 'lead_notes_insert'
      and roles @> array['authenticated']::name[]
      and cmd = 'INSERT'$$,
  array[1],
  'policy lead_notes_insert exists for authenticated INSERT'
);

select results_eq(
  $$select (with_check ilike '%crm.notes.manage%'
        and with_check ilike '%crm_can_mutate_lead%')
    from pg_policies
   where schemaname = 'public'
     and tablename = 'lead_notes'
     and policyname = 'lead_notes_insert'$$,
  array[true],
  'lead_notes_insert still requires crm.notes.manage + crm_can_mutate_lead'
);

select has_trigger(
  'public',
  'lead_notes',
  'trg_lead_notes_set_creator',
  'creator trigger trg_lead_notes_set_creator exists'
);

select has_trigger(
  'public',
  'lead_notes',
  'trg_lead_notes_after_insert_activity',
  'after-insert activity trigger exists'
);

select has_trigger(
  'public',
  'lead_notes',
  'trg_lead_notes_no_update',
  'append-only UPDATE trigger exists'
);

select has_trigger(
  'public',
  'lead_notes',
  'trg_lead_notes_no_delete',
  'append-only DELETE trigger exists'
);

-- ---------------------------------------------------------------------------
-- Behavioral fixtures (transaction-scoped)
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role) values
  ('d1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa-notes@example.test', 'authenticated', 'authenticated'),
  ('d2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'exec-notes@example.test', 'authenticated', 'authenticated'),
  ('d3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'des-notes@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333'
);

insert into public.user_roles (user_id, role_id)
select 'd1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'd2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'd3333333-3333-3333-3333-333333333333', id from public.roles where code = 'designer';

select * from public.submit_lead_intake(
  p_idempotency_key => 'd4444444-4444-4444-4444-444444444444'::uuid,
  p_request_hash => repeat('a', 64),
  p_network_fingerprint_hash => repeat('b', 64),
  p_phone_fingerprint_hash => repeat('c', 64),
  p_planner_version => 'home-r4-v1',
  p_submitted_name => 'Notes Repair Lead',
  p_phone_e164 => '+919700000001',
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

reset role;
select set_config(
  'test.notes_repair_lead_id',
  (select id::text from public.leads where submitted_name = 'Notes Repair Lead' limit 1),
  true
);

-- Assign lead to executive so mutate scope is established
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
select public.assign_lead(
  current_setting('test.notes_repair_lead_id')::uuid,
  'd2222222-2222-2222-2222-222222222222'::uuid,
  null
);

-- 13–15: authorized Super Admin inserts note; creator + activity owned by DB
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select lives_ok(
  $$insert into public.lead_notes (lead_id, body)
    values (current_setting('test.notes_repair_lead_id')::uuid, 'Privilege repair authorized note')$$,
  'authorized Super Admin can insert a note on a visible mutable lead'
);

select results_eq(
  $$select created_by::text from public.lead_notes
    where lead_id = current_setting('test.notes_repair_lead_id')::uuid
      and body = 'Privilege repair authorized note'$$,
  array['d1111111-1111-1111-1111-111111111111'],
  'resulting note created_by is auth.uid(), not client-controlled'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where lead_id = current_setting('test.notes_repair_lead_id')::uuid
      and activity_type = 'note.created'
      and actor_id = 'd1111111-1111-1111-1111-111111111111'::uuid$$,
  array[1],
  'lead activity is appended for authorized note insert'
);

-- 16: unauthorized / insufficient actor denied by RLS
select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$insert into public.lead_notes (lead_id, body)
    values (current_setting('test.notes_repair_lead_id')::uuid, 'designer denied note')$$,
  '42501',
  null,
  'unauthorized designer remains denied by RLS on lead_notes insert'
);

reset role;
select results_eq(
  $$select count(*)::integer from public.lead_notes where body = 'designer denied note'$$,
  array[0],
  'failed unauthorized note leaves no row'
);

-- 17–18: UPDATE / DELETE remain blocked (no table privilege; append-only triggers also present)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select throws_ok(
  $$update public.lead_notes
      set body = 'mutated'
    where lead_id = current_setting('test.notes_repair_lead_id')::uuid
      and body = 'Privilege repair authorized note'$$,
  '42501',
  null,
  'UPDATE remains blocked for authenticated'
);

select throws_ok(
  $$delete from public.lead_notes
    where lead_id = current_setting('test.notes_repair_lead_id')::uuid
      and body = 'Privilege repair authorized note'$$,
  '42501',
  null,
  'DELETE remains blocked for authenticated'
);

select * from finish();
rollback;
