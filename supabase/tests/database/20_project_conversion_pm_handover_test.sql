begin;
select no_plan();

-- ----------------------------------------------------------------------------
-- Foundation
-- ----------------------------------------------------------------------------
select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'project_manager_assignments', 'project_manager_assignments table exists');
select has_table('public', 'project_events', 'project_events table exists');
select has_table('private', 'project_idempotency_requests', 'private project idempotency ledger exists');

select results_eq(
  $$select relrowsecurity from pg_class where relname = 'projects' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on projects'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_manager_assignments' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_manager_assignments'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_events' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_events'
);

select ok(
  exists (select 1 from public.permissions where code = 'projects.read'),
  'projects.read permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'projects.assign_pm'),
  'projects.assign_pm permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'projects.accept_handover'),
  'projects.accept_handover permission exists'
);
select ok(
  not exists (select 1 from public.permissions where code = 'projects.admin'),
  'projects.admin is not created'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'projects.read'
      and r.code in ('super_admin', 'sales_manager', 'sales_executive', 'project_manager')
  ),
  4,
  'projects.read granted to SA/SM/SE/PM only among canonical roles'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code like 'projects.%'
      and r.code in ('management', 'sales', 'project_operations', 'designer')
  ),
  0,
  'No Phase 8A project grants to designer or legacy roles'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'projects.assign_pm'
      and r.code in ('super_admin', 'sales_manager')
  ),
  2,
  'projects.assign_pm granted to SA/SM only'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'projects.accept_handover' and r.code = 'project_manager'
  ),
  1,
  'projects.accept_handover granted to project_manager only'
);

select is(
  has_function_privilege('anon', 'public.materialize_closed_won_project_internal(uuid,text)', 'execute'),
  false,
  'anon cannot execute internal materializer'
);
select is(
  has_function_privilege('authenticated', 'public.materialize_closed_won_project_internal(uuid,text)', 'execute'),
  false,
  'authenticated cannot execute internal materializer'
);
select is(
  has_function_privilege('public', 'public.materialize_closed_won_project_internal(uuid,text)', 'execute'),
  false,
  'PUBLIC cannot execute internal materializer'
);
select is(
  has_function_privilege('service_role', 'public.materialize_closed_won_project_internal(uuid,text)', 'execute'),
  true,
  'service_role can execute internal materializer'
);

select is(
  has_function_privilege('anon', 'private.generate_project_number()', 'execute'),
  false,
  'anon cannot execute project number generator'
);
select is(
  has_function_privilege('authenticated', 'private.generate_project_number()', 'execute'),
  false,
  'authenticated cannot execute project number generator'
);
select is(
  has_function_privilege('anon', 'private.enforce_project_acceptance_identity()', 'execute'),
  false,
  'anon cannot execute identity trigger helper'
);
select is(
  has_function_privilege('authenticated', 'private.enforce_project_acceptance_identity()', 'execute'),
  false,
  'authenticated cannot execute identity trigger helper'
);
select is(
  has_function_privilege('anon', 'private.prevent_project_identity_mutation()', 'execute'),
  false,
  'anon cannot execute identity mutation helper'
);
select is(
  has_function_privilege('authenticated', 'private.prevent_project_identity_mutation()', 'execute'),
  false,
  'authenticated cannot execute identity mutation helper'
);
select is(
  has_function_privilege('anon', 'private.materialize_closed_won_project_impl(uuid,text,uuid,text)', 'execute'),
  false,
  'anon cannot execute private materializer impl'
);
select is(
  has_function_privilege('authenticated', 'private.materialize_closed_won_project_impl(uuid,text,uuid,text)', 'execute'),
  false,
  'authenticated cannot execute private materializer impl'
);
select is(
  has_function_privilege('anon', 'private.project_idempotency_xact_lock(text,uuid,text,text)', 'execute'),
  false,
  'anon cannot execute project idempotency lock helper'
);
select is(
  has_function_privilege('authenticated', 'private.project_idempotency_xact_lock(text,uuid,text,text)', 'execute'),
  false,
  'authenticated cannot execute project idempotency lock helper'
);

select ok(
  (
    select bool_and(coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (
        (n.nspname = 'public' and p.proname in (
          'materialize_closed_won_project_internal',
          'repair_closed_won_project_materialization',
          'list_pending_closed_won_project_materializations',
          'list_assignable_project_managers',
          'can_view_project_handover_baseline',
          'assign_project_manager',
          'accept_project_handover'
        ))
        or (n.nspname = 'private' and p.proname in (
          'generate_project_number',
          'project_is_assignable_pm',
          'project_can_view',
          'project_can_view_handover_baseline',
          'project_sha256',
          'project_idempotency_xact_lock',
          'enforce_project_acceptance_identity',
          'prevent_project_identity_mutation',
          'prevent_project_assignment_mutation',
          'materialize_closed_won_project_impl'
        ))
      )
  ),
  'Phase 8A SECURITY DEFINER helpers set search_path'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name in ('project_value_paise', 'revenue_paise', 'editable_value_paise')
  ),
  'projects has no editable revenue field'
);

select ok(
  not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name in ('designer_assignments', 'project_design_states', 'project_execution_states')
  ),
  'No Phase 8B/8C persistence tables'
);

-- ----------------------------------------------------------------------------
-- Fixture: users, lead, quotation, accept Closed-Won
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);

insert into auth.users (id, instance_id, email, aud, role) values
  ('8a111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_8a@onedecore.in', 'authenticated', 'authenticated'),
  ('8a222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm_8a@onedecore.in', 'authenticated', 'authenticated'),
  ('8a333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_8a@onedecore.in', 'authenticated', 'authenticated'),
  ('8a444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'se2_8a@onedecore.in', 'authenticated', 'authenticated'),
  ('8a555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'designer_8a@onedecore.in', 'authenticated', 'authenticated'),
  ('8a666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'pm1_8a@onedecore.in', 'authenticated', 'authenticated'),
  ('8a777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'pm2_8a@onedecore.in', 'authenticated', 'authenticated'),
  ('8a888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'pm_inactive_8a@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 8A ' || id::text
where id in (
  '8a111111-1111-1111-1111-111111111111',
  '8a222222-2222-2222-2222-222222222222',
  '8a333333-3333-3333-3333-333333333333',
  '8a444444-4444-4444-4444-444444444444',
  '8a555555-5555-5555-5555-555555555555',
  '8a666666-6666-6666-6666-666666666666',
  '8a777777-7777-7777-7777-777777777777',
  '8a888888-8888-8888-8888-888888888888'
);

update public.profiles set status = 'suspended' where id = '8a888888-8888-8888-8888-888888888888';

insert into public.user_roles (user_id, role_id)
select '8a111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8a222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8a333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8a444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8a555555-5555-5555-5555-555555555555', id from public.roles where code = 'designer' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8a666666-6666-6666-6666-666666666666', id from public.roles where code = 'project_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8a777777-7777-7777-7777-777777777777', id from public.roles where code = 'project_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8a888888-8888-8888-8888-888888888888', id from public.roles where code = 'project_manager' on conflict do nothing;

insert into public.contacts (id, display_name, status)
values ('8aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Phase 8A Client', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values
  ('8aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'phone', '+919811122233', true),
  ('8aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'client8a@example.com', true)
on conflict do nothing;

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, assigned_to
) values (
  '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '8aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Phase 8A Client',
  'client8a@example.com',
  'assigned',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'public_intake',
  'complete-home-interiors',
  'apartment-3bhk',
  'ready-now',
  'v1',
  '/planner',
  '8a333333-3333-3333-3333-333333333333'
) on conflict (id) do nothing;

insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
values ('8acccccc-cccc-cccc-cccc-cccccccccccc', 'gst_18_8a', 'GST 18 8A', 18.00, true, '8a111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '8a111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select public.set_quotation_max_discount(25.00);

select set_config('request.jwt.claim.sub', '8a333333-3333-3333-3333-333333333333', true);
select public.create_quotation_draft(
  '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'Phase 8A Quotation'::text,
  'draft_key_8a_01'::text
);

select save_quotation_draft_items(
  (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1::bigint,
  jsonb_build_array(
    jsonb_build_object(
      'sectionName', 'Living Room',
      'items', jsonb_build_array(
        jsonb_build_object('itemName', 'Sofa', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 10000000)
      )
    )
  ),
  'item_key_8a_01'
);

select update_quotation_draft(
  (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  2::bigint,
  p_tax_profile_id => '8acccccc-cccc-cccc-cccc-cccccccccccc'::uuid
);

select replace_quotation_payment_schedule(
  (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  3::bigint,
  'percentage'::text,
  jsonb_build_array(
    jsonb_build_object('milestoneName', 'Advance', 'percentage', '50.00'),
    jsonb_build_object('milestoneName', 'Handover', 'percentage', '50.00')
  )
);

select finalize_quotation_version(
  (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  4,
  'fin_key_8a_01'
);

select set_config('role', 'postgres', true);
insert into public.quotation_pdf_documents (
  quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
) values (
  (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  'quotation-documents',
  '8a/v1.pdf',
  'ready',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  12000,
  '8a111111-1111-1111-1111-111111111111',
  now()
);

select issue_quotation_access_grant_internal(
  '8a333333-3333-3333-3333-333333333333'::uuid,
  '8adddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  encode(extensions.digest(convert_to('test_token_8a_01', 'UTF8'), 'sha256'), 'hex'),
  false
);

select set_config(
  'test.phase8a_quote',
  (select id::text from public.quotations where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  true
);
select set_config(
  'test.phase8a_ver',
  (
    select qv.id::text
    from public.quotation_versions qv
    where qv.quotation_id = current_setting('test.phase8a_quote')::uuid
      and qv.version_number = 1
  ),
  true
);

-- Materialize without acceptance must fail
select set_config('role', 'service_role', true);
select throws_ok(
  $$select public.materialize_closed_won_project_internal(current_setting('test.phase8a_ver')::uuid, 'post-acceptance-pre')$$,
  'ACCEPTANCE_NOT_FOUND: Authoritative quotation acceptance is required.',
  'Cannot materialize without acceptance'
);

select set_config('role', 'anon', true);
select is(
  (public.accept_quotation_by_capability('test_token_8a_01', 'Phase 8A Client', 'client8a@example.com')->>'success'),
  'true',
  'Client acceptance creates Closed-Won'
);

select set_config('role', 'postgres', true);
select is(
  (select status from public.leads where id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'closed_won',
  'Lead is closed_won after acceptance'
);

-- Repair queue sees the accepted Closed-Won without a project
select set_config('request.jwt.claim.sub', '8a111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select is(
  jsonb_array_length(public.list_pending_closed_won_project_materializations()),
  1,
  'SA sees pending materialization row'
);

select set_config('request.jwt.claim.sub', '8a333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.repair_closed_won_project_materialization(current_setting('test.phase8a_ver')::uuid, 'repair-se-denied')$$,
  'FORBIDDEN: Only Super Admin or Sales Manager may repair project materialization.',
  'Sales Executive repair denied'
);

select set_config('request.jwt.claim.sub', '8a666666-6666-6666-6666-666666666666', true);
select throws_ok(
  $$select public.repair_closed_won_project_materialization(current_setting('test.phase8a_ver')::uuid, 'repair-pm-denied')$$,
  'FORBIDDEN: Only Super Admin or Sales Manager may repair project materialization.',
  'PM repair denied'
);

select set_config('request.jwt.claim.sub', '8a555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.repair_closed_won_project_materialization(current_setting('test.phase8a_ver')::uuid, 'repair-designer-denied')$$,
  'FORBIDDEN: Only Super Admin or Sales Manager may repair project materialization.',
  'Designer repair denied'
);

-- System materialization
select set_config('role', 'service_role', true);
select set_config(
  'test.phase8a_first',
  public.materialize_closed_won_project_internal(current_setting('test.phase8a_ver')::uuid, 'post-acceptance:8a')::text,
  true
);
select is(
  (current_setting('test.phase8a_first')::jsonb->>'success'),
  'true',
  'Service-role materializer creates project'
);
select is(
  (public.materialize_closed_won_project_internal(current_setting('test.phase8a_ver')::uuid, 'post-acceptance:8a')->>'project_id'),
  (current_setting('test.phase8a_first')::jsonb->>'project_id'),
  'Idempotent system replay with same key returns same project'
);
select is(
  (public.materialize_closed_won_project_internal(current_setting('test.phase8a_ver')::uuid, 'post-acceptance:8a-b')->>'idempotent_replay'),
  'true',
  'Existing project replay with a new key is marked idempotent'
);

select set_config('role', 'postgres', true);
select set_config(
  'test.phase8a_project',
  (select id::text from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  true
);

select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1,
  'Exactly one project per lead'
);
select is(
  (select count(*)::integer from public.projects where quotation_acceptance_id = (select id from public.quotation_acceptances where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)),
  1,
  'Exactly one project per acceptance'
);
select matches(
  (select project_number from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  '^OD-P-[0-9]{4}-[0-9]{6,}$',
  'Project number matches OD-P-YYYY-SEQ6'
);
select is(
  (select created_by from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  null,
  'System materialization uses NULL created_by'
);
select is(
  (select actor_kind from public.project_events where event_type = 'project.created' and lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'system',
  'project.created uses system actor kind'
);
select is(
  (select actor_id from public.project_events where event_type = 'project.created' and lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  null,
  'system project.created has NULL actor_id'
);

select throws_ok(
  $$update public.projects
    set project_number = 'OD-P-1999-000001'
    where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid$$,
  'PROJECT_IDENTITY_IMMUTABLE',
  'Accepted commercial linkage and project number are immutable'
);

-- SA/SM repair replay after project exists
select set_config('request.jwt.claim.sub', '8a222222-2222-2222-2222-222222222222', true);
select set_config('role', 'authenticated', true);
select is(
  (public.repair_closed_won_project_materialization(current_setting('test.phase8a_ver')::uuid, 'repair-sm-replay')->>'success'),
  'true',
  'SM repair replays existing project'
);

-- Direct authenticated DML denied
select throws_ok(
  $$insert into public.projects (
    lead_id, quotation_acceptance_id, accepted_quotation_id, accepted_quotation_version_id, project_number, status
  ) values (
    '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    (select id from public.quotation_acceptances where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
    current_setting('test.phase8a_quote')::uuid,
    current_setting('test.phase8a_ver')::uuid,
    'OD-P-2026-999999',
    'awaiting_project_manager_assignment'
  )$$,
  '42501',
  null,
  'Authenticated direct INSERT on projects is denied'
);

-- RLS visibility
select set_config('request.jwt.claim.sub', '8a111111-1111-1111-1111-111111111111', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1,
  'SA can read project'
);

select set_config('request.jwt.claim.sub', '8a222222-2222-2222-2222-222222222222', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1,
  'SM can read project'
);

select set_config('request.jwt.claim.sub', '8a333333-3333-3333-3333-333333333333', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1,
  'Credited SE can read own project'
);

select set_config('request.jwt.claim.sub', '8a444444-4444-4444-4444-444444444444', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0,
  'Other SE cannot read project'
);

select set_config('request.jwt.claim.sub', '8a666666-6666-6666-6666-666666666666', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0,
  'Unassigned PM cannot read project'
);

select set_config('request.jwt.claim.sub', '8a555555-5555-5555-5555-555555555555', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0,
  'Designer cannot read Phase 8A project'
);

-- Assignment
select set_config('request.jwt.claim.sub', '8a333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a666666-6666-6666-6666-666666666666'::uuid,
    'assign-se-denied'
  )$$,
  'FORBIDDEN',
  'SE cannot assign PM'
);

select set_config('request.jwt.claim.sub', '8a666666-6666-6666-6666-666666666666', true);
select throws_ok(
  $$select public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a666666-6666-6666-6666-666666666666'::uuid,
    'assign-pm-denied'
  )$$,
  'FORBIDDEN',
  'PM cannot self-assign'
);

select set_config('request.jwt.claim.sub', '8a555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a666666-6666-6666-6666-666666666666'::uuid,
    'assign-designer-denied'
  )$$,
  'FORBIDDEN',
  'Designer cannot assign PM'
);

select set_config('request.jwt.claim.sub', '8a111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a888888-8888-8888-8888-888888888888'::uuid,
    'assign-inactive-pm'
  )$$,
  'INELIGIBLE_PROJECT_MANAGER',
  'Inactive PM cannot be assigned'
);

select throws_ok(
  $$select public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a333333-3333-3333-3333-333333333333'::uuid,
    'assign-wrong-role'
  )$$,
  'INELIGIBLE_PROJECT_MANAGER',
  'Non-PM profile cannot be assigned'
);

select is(
  (public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a666666-6666-6666-6666-666666666666'::uuid,
    'assign-sa-initial'
  )->>'status'),
  'awaiting_project_manager_acceptance',
  'SA initial assignment moves to awaiting acceptance'
);

select is(
  (public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a666666-6666-6666-6666-666666666666'::uuid,
    'assign-sa-initial'
  )->>'project_manager_id'),
  '8a666666-6666-6666-6666-666666666666',
  'Same-key assign replay returns the durable result'
);

select is(
  (select count(*)::integer from public.project_manager_assignments
    where project_id = current_setting('test.phase8a_project')::uuid),
  1,
  'Same-key assign replay does not duplicate assignment history'
);

select throws_ok(
  $$select public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a777777-7777-7777-7777-777777777777'::uuid,
    'assign-sa-initial',
    'different-reason'
  )$$,
  'IDEMPOTENCY_KEY_REUSED',
  'Same assign key with different target/reason is rejected'
);

select is(
  (public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a666666-6666-6666-6666-666666666666'::uuid,
    'assign-sa-same'
  )->>'unchanged'),
  'true',
  'Same-current-PM assign is a no-op'
);

select is(
  (select count(*)::integer from public.project_manager_assignments
    where project_id = current_setting('test.phase8a_project')::uuid
      and ended_at is null),
  1,
  'Exactly one current assignment'
);

-- SM reassignment before accept
select set_config('request.jwt.claim.sub', '8a222222-2222-2222-2222-222222222222', true);
select is(
  (public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a777777-7777-7777-7777-777777777777'::uuid,
    'assign-sm-reassign-pre'
  )->>'status'),
  'awaiting_project_manager_acceptance',
  'SM may reassign before handover accept'
);

select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.project_manager_assignments
    where project_id = current_setting('test.phase8a_project')::uuid),
  2,
  'Prior assignment history is retained'
);

-- Handover: only current PM
select set_config('request.jwt.claim.sub', '8a666666-6666-6666-6666-666666666666', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-old-pm'
  )$$,
  'FORBIDDEN: Handover acceptance requires the current primary project manager.',
  'Former PM cannot accept after reassignment'
);

select set_config('request.jwt.claim.sub', '8a111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-sa'
  )$$,
  'FORBIDDEN',
  'SA cannot accept as PM'
);

select set_config('request.jwt.claim.sub', '8a222222-2222-2222-2222-222222222222', true);
select throws_ok(
  $$select public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-sm'
  )$$,
  'FORBIDDEN',
  'SM cannot accept as PM'
);

select set_config('request.jwt.claim.sub', '8a333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-se'
  )$$,
  'FORBIDDEN',
  'SE cannot accept handover'
);

select set_config('request.jwt.claim.sub', '8a555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-designer'
  )$$,
  'FORBIDDEN',
  'Designer cannot accept handover'
);

select set_config('request.jwt.claim.sub', '8a777777-7777-7777-7777-777777777777', true);
select is(
  (public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-pm2'
  )->>'status'),
  'handover_accepted',
  'Current PM accepts handover'
);

select is(
  (public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-pm2'
  )->>'status'),
  'handover_accepted',
  'Same-key handover replay returns the durable result'
);

select is(
  (public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-pm2-replay'
  )->>'idempotent_replay'),
  'true',
  'Same current PM acceptance is idempotent'
);

select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.project_events
    where project_id = current_setting('test.phase8a_project')::uuid
      and event_type = 'project.handover_accepted'),
  1,
  'Acceptance event is not duplicated on replay'
);

-- Current PM can read after assignment
select set_config('request.jwt.claim.sub', '8a777777-7777-7777-7777-777777777777', true);
select set_config('role', 'authenticated', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1,
  'Current PM can read assigned project'
);

-- Reassign after handover accepted
select set_config('request.jwt.claim.sub', '8a111111-1111-1111-1111-111111111111', true);
select is(
  (public.assign_project_manager(
    current_setting('test.phase8a_project')::uuid,
    '8a666666-6666-6666-6666-666666666666'::uuid,
    'assign-sa-reassign-post'
  )->>'status'),
  'awaiting_project_manager_acceptance',
  'SA may reassign after handover accepted'
);

select set_config('role', 'postgres', true);
select is(
  (select handover_accepted_at from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  null,
  'Reassignment clears handover_accepted_at'
);
select is(
  (select status from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'awaiting_project_manager_acceptance',
  'Reassignment resets status'
);

select set_config('request.jwt.claim.sub', '8a777777-7777-7777-7777-777777777777', true);
select set_config('role', 'authenticated', true);
select is(
  (select count(*)::integer from public.projects where lead_id = '8abbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  0,
  'Former PM loses read after reassignment'
);
select throws_ok(
  $$select public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-stale-pm2'
  )$$,
  'FORBIDDEN: Handover acceptance requires the current primary project manager.',
  'Former PM cannot accept after post-accept reassignment'
);

select set_config('request.jwt.claim.sub', '8a666666-6666-6666-6666-666666666666', true);
select is(
  (public.accept_project_handover(
    current_setting('test.phase8a_project')::uuid,
    'accept-new-pm'
  )->>'status'),
  'handover_accepted',
  'Newly assigned PM must re-accept'
);

-- Append-only events
select set_config('role', 'postgres', true);
select throws_ok(
  $$update public.project_events set details = '{}'::jsonb
    where project_id = current_setting('test.phase8a_project')::uuid$$,
  '55000',
  null,
  'project_events UPDATE is blocked'
);
select throws_ok(
  $$delete from public.project_events
    where project_id = current_setting('test.phase8a_project')::uuid$$,
  '55000',
  null,
  'project_events DELETE is blocked'
);

select finish();
rollback;
