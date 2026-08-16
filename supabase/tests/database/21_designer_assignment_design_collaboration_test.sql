begin;
select no_plan();

-- ----------------------------------------------------------------------------
-- Foundation
-- ----------------------------------------------------------------------------
select ok(
  exists (select 1 from public.permissions where code = 'project_design.read'),
  'project_design.read permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_design.staff'),
  'project_design.staff permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_design.collaborate'),
  'project_design.collaborate permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_design.transition'),
  'project_design.transition permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_design.client_approval'),
  'project_design.client_approval permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_design.hold'),
  'project_design.hold permission exists'
);
select ok(
  not exists (select 1 from public.permissions where code = 'project_design.manage'),
  'project_design.manage is not created'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_design.read'
      and r.code in ('super_admin', 'sales_manager', 'project_manager', 'designer')
  ),
  4,
  'project_design.read granted to SA/SM/PM/designer'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_design.staff'
      and r.code in ('super_admin', 'sales_manager')
  ),
  2,
  'project_design.staff granted to SA/SM'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_design.collaborate'
      and r.code = 'designer'
  ),
  1,
  'project_design.collaborate granted to designer'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_design.transition'
      and r.code = 'designer'
  ),
  1,
  'project_design.transition granted to designer'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_design.client_approval'
      and r.code in ('project_manager', 'designer')
  ),
  2,
  'project_design.client_approval granted to PM and designer'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_design.hold'
      and r.code in ('project_manager', 'designer')
  ),
  2,
  'project_design.hold granted to PM and designer'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code like 'project_design.%'
      and r.code in ('management', 'sales', 'project_operations')
  ),
  0,
  'No project_design grants to management/sales/project_operations'
);

select has_table('public', 'project_designer_assignments', 'project_designer_assignments exists');
select has_table('public', 'project_design_workflows', 'project_design_workflows exists');
select has_table('public', 'project_design_evidence', 'project_design_evidence exists');
select has_table('public', 'project_design_deliverable_versions', 'project_design_deliverable_versions exists');
select hasnt_table('public', 'project_execution_states', 'project_execution_states does not exist');

select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_designer_assignments' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_designer_assignments'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_design_workflows' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_design_workflows'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_design_evidence' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_design_evidence'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_design_deliverable_versions' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_design_deliverable_versions'
);

select is(
  (select public from storage.buckets where id = 'project-design-documents'),
  false,
  'bucket project-design-documents is private'
);

select ok(
  (
    select bool_and(coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (
        (n.nspname = 'public' and p.proname in (
          'list_assignable_designers',
          'set_project_lead_designer',
          'add_project_supporting_designer',
          'remove_project_designer_assignment',
          'transition_project_design',
          'record_project_client_approval',
          'hold_project_design',
          'resume_project_design',
          'approve_project_production_ready',
          'complete_project_design',
          'reserve_project_design_deliverable_version',
          'finalize_project_design_deliverable_version',
          'can_view_project_design',
          'can_record_project_client_approval',
          'can_approve_project_production_ready',
          'get_project_design_high_level_status'
        ))
        or (n.nspname = 'private' and p.proname in (
          'project_is_assignable_designer',
          'project_design_assignment_role',
          'project_design_is_current_lead',
          'project_design_is_current_assigned_designer',
          'project_design_can_view',
          'project_design_current_ready_max',
          'project_design_has_ready_kind',
          'project_design_require_active_actor',
          'project_design_assert_evidence_args',
          'project_design_uploaded_evidence_object_exists',
          'project_design_whatsapp_belongs_to_project',
          'prevent_project_designer_assignment_mutation',
          'prevent_project_design_workflow_mutation',
          'prevent_project_design_deliverable_mutation'
        ))
      )
  ),
  'Phase 8B SECURITY DEFINER helpers set search_path'
);

select is(
  has_function_privilege('authenticated', 'private.project_is_assignable_designer(uuid)', 'execute'),
  false,
  'authenticated cannot execute project_is_assignable_designer'
);
select is(
  has_function_privilege('authenticated', 'private.prevent_project_designer_assignment_mutation()', 'execute'),
  false,
  'authenticated cannot execute prevent_project_designer_assignment_mutation'
);
select is(
  has_function_privilege('authenticated', 'private.prevent_project_design_workflow_mutation()', 'execute'),
  false,
  'authenticated cannot execute prevent_project_design_workflow_mutation'
);
select is(
  has_function_privilege('authenticated', 'private.prevent_project_design_deliverable_mutation()', 'execute'),
  false,
  'authenticated cannot execute prevent_project_design_deliverable_mutation'
);
select is(
  has_function_privilege('authenticated', 'private.project_design_require_active_actor()', 'execute'),
  false,
  'authenticated cannot execute project_design_require_active_actor'
);
select is(
  has_function_privilege('authenticated', 'private.project_design_uploaded_evidence_object_exists(uuid,text)', 'execute'),
  false,
  'authenticated cannot execute project_design_uploaded_evidence_object_exists'
);
select is(
  has_function_privilege('anon', 'private.project_design_uploaded_evidence_object_exists(uuid,text)', 'execute'),
  false,
  'anon cannot execute project_design_uploaded_evidence_object_exists'
);
select is(
  has_function_privilege('authenticated', 'public.can_record_project_client_approval(uuid)', 'execute'),
  true,
  'authenticated can execute can_record_project_client_approval'
);
select is(
  has_function_privilege('anon', 'public.can_record_project_client_approval(uuid)', 'execute'),
  false,
  'anon cannot execute can_record_project_client_approval'
);
select is(
  has_function_privilege('authenticated', 'public.can_approve_project_production_ready(uuid)', 'execute'),
  true,
  'authenticated can execute can_approve_project_production_ready'
);
select is(
  has_function_privilege('anon', 'public.can_approve_project_production_ready(uuid)', 'execute'),
  false,
  'anon cannot execute can_approve_project_production_ready'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%project-design-documents%'
        or coalesce(with_check, '') ilike '%project-design-documents%'
      )
  ),
  0,
  'no storage.objects policies grant project-design-documents'
);
select is(
  has_function_privilege('authenticated', 'private.project_idempotency_xact_lock(text,uuid,text,text)', 'execute'),
  false,
  'authenticated cannot execute project_idempotency_xact_lock'
);

select is(
  has_function_privilege('authenticated', 'public.set_project_lead_designer(uuid,uuid,text,text)', 'execute'),
  true,
  'authenticated can execute public.set_project_lead_designer'
);
select is(
  has_function_privilege('anon', 'public.set_project_lead_designer(uuid,uuid,text,text)', 'execute'),
  false,
  'anon cannot execute public.set_project_lead_designer'
);

-- ----------------------------------------------------------------------------
-- Fixture: users, lead, quotation, accept Closed-Won, materialize, PM handover
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);

insert into auth.users (id, instance_id, email, aud, role) values
  ('8b111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_8b@onedecore.in', 'authenticated', 'authenticated'),
  ('8b222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm_8b@onedecore.in', 'authenticated', 'authenticated'),
  ('8b333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_8b@onedecore.in', 'authenticated', 'authenticated'),
  ('8b444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'se2_8b@onedecore.in', 'authenticated', 'authenticated'),
  ('8b555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'lead_designer_8b@onedecore.in', 'authenticated', 'authenticated'),
  ('8b121212-1212-1212-1212-121212121212', '00000000-0000-0000-0000-000000000000', 'supporting_designer_8b@onedecore.in', 'authenticated', 'authenticated'),
  ('8b666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'pm1_8b@onedecore.in', 'authenticated', 'authenticated'),
  ('8b777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'pm2_8b@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 8B ' || id::text
where id in (
  '8b111111-1111-1111-1111-111111111111',
  '8b222222-2222-2222-2222-222222222222',
  '8b333333-3333-3333-3333-333333333333',
  '8b444444-4444-4444-4444-444444444444',
  '8b555555-5555-5555-5555-555555555555',
  '8b121212-1212-1212-1212-121212121212',
  '8b666666-6666-6666-6666-666666666666',
  '8b777777-7777-7777-7777-777777777777'
);

insert into public.user_roles (user_id, role_id)
select '8b111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8b222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8b333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8b444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8b555555-5555-5555-5555-555555555555', id from public.roles where code = 'designer' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8b121212-1212-1212-1212-121212121212', id from public.roles where code = 'designer' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8b666666-6666-6666-6666-666666666666', id from public.roles where code = 'project_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8b777777-7777-7777-7777-777777777777', id from public.roles where code = 'project_manager' on conflict do nothing;

insert into public.contacts (id, display_name, status)
values ('8baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Phase 8B Client', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values
  ('8baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'phone', '+919811122244', true),
  ('8baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'client8b@example.com', true)
on conflict do nothing;

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, assigned_to
) values (
  '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '8baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Phase 8B Client',
  'client8b@example.com',
  'assigned',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'public_intake',
  'complete-home-interiors',
  'apartment-3bhk',
  'ready-now',
  'v1',
  '/planner',
  '8b333333-3333-3333-3333-333333333333'
) on conflict (id) do nothing;

insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
values ('8bcccccc-cccc-cccc-cccc-cccccccccccc', 'gst_18_8b', 'GST 18 8B', 18.00, true, '8b111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select public.set_quotation_max_discount(25.00);

select set_config('request.jwt.claim.sub', '8b333333-3333-3333-3333-333333333333', true);
select public.create_quotation_draft(
  '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'Phase 8B Quotation'::text,
  'draft_key_8b_01'::text
);

select save_quotation_draft_items(
  (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1::bigint,
  jsonb_build_array(
    jsonb_build_object(
      'sectionName', 'Living Room',
      'items', jsonb_build_array(
        jsonb_build_object('itemName', 'Sofa', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 10000000)
      )
    )
  ),
  'item_key_8b_01'
);

select update_quotation_draft(
  (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  2::bigint,
  p_tax_profile_id => '8bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid
);

select replace_quotation_payment_schedule(
  (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  3::bigint,
  'percentage'::text,
  jsonb_build_array(
    jsonb_build_object('milestoneName', 'Advance', 'percentage', '50.00'),
    jsonb_build_object('milestoneName', 'Handover', 'percentage', '50.00')
  )
);

select finalize_quotation_version(
  (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  4,
  'fin_key_8b_01'
);

select set_config('role', 'postgres', true);
insert into public.quotation_pdf_documents (
  quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
) values (
  (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  'quotation-documents',
  '8b/v1.pdf',
  'ready',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  12000,
  '8b111111-1111-1111-1111-111111111111',
  now()
);

select issue_quotation_access_grant_internal(
  '8b333333-3333-3333-3333-333333333333'::uuid,
  '8bdddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  'cccccccccccccccccccccccccccccccc',
  encode(extensions.digest(convert_to('test_token_8b_01', 'UTF8'), 'sha256'), 'hex'),
  false
);

select set_config(
  'test.phase8b_quote',
  (select id::text from public.quotations where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  true
);
select set_config(
  'test.phase8b_ver',
  (
    select qv.id::text
    from public.quotation_versions qv
    where qv.quotation_id = current_setting('test.phase8b_quote')::uuid
      and qv.version_number = 1
  ),
  true
);

select set_config('role', 'anon', true);
select is(
  (public.accept_quotation_by_capability('test_token_8b_01', 'Phase 8B Client', 'client8b@example.com')->>'success'),
  'true',
  'Client acceptance creates Closed-Won'
);

select set_config('role', 'service_role', true);
select is(
  (public.materialize_closed_won_project_internal(current_setting('test.phase8b_ver')::uuid, 'post-acceptance:8b')->>'success'),
  'true',
  'Service-role materializer creates project'
);

select set_config('role', 'postgres', true);
select set_config(
  'test.phase8b_project',
  (select id::text from public.projects where lead_id = '8bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  true
);

select is(
  (select status from public.projects where id = current_setting('test.phase8b_project')::uuid),
  'awaiting_project_manager_assignment',
  'Materialized project awaits PM assignment'
);

-- Assign lead before handover_accepted must fail
select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'staff_before_handover'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Assign lead before handover_accepted is rejected'
);

select is(
  (public.assign_project_manager(
    current_setting('test.phase8b_project')::uuid,
    '8b666666-6666-6666-6666-666666666666'::uuid,
    'assign_pm_8b_01'
  )->>'status'),
  'awaiting_project_manager_acceptance',
  'SA assigns primary PM'
);

select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select is(
  (public.accept_project_handover(
    current_setting('test.phase8b_project')::uuid,
    'accept_pm_8b_01'
  )->>'status'),
  'handover_accepted',
  'Current PM accepts handover'
);

select set_config('role', 'postgres', true);
select is(
  (select status from public.projects where id = current_setting('test.phase8b_project')::uuid),
  'handover_accepted',
  'Project status is handover_accepted'
);

select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values (
      'project-design-documents',
      'projects/' || current_setting('test.phase8b_project') || '/evidence/unauthorized.pdf',
      '8b666666-6666-6666-6666-666666666666',
      '8b666666-6666-6666-6666-666666666666',
      '{}'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'authenticated cannot directly insert project-design-documents storage objects'
);

select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select set_config('role', 'authenticated', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  0,
  'Unassigned designer cannot select workflow before assignment'
);

-- ----------------------------------------------------------------------------
-- Staffing
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'staff_se_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'SE cannot staff designers'
);

select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select throws_ok(
  $$select public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'staff_pm_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'PM cannot staff designers'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'staff_self_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'Designer cannot self-assign as lead'
);

-- Supporting before lead: no workflow row
select set_config('request.jwt.claim.sub', '8b222222-2222-2222-2222-222222222222', true);
select is(
  (public.add_project_supporting_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b121212-1212-1212-1212-121212121212'::uuid,
    'add_supp_first'
  )->>'assignment_role'),
  'supporting_designer',
  'SM can add supporting designer before lead'
);

select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  0,
  'Supporting assignment does not create workflow'
);

select set_config('request.jwt.claim.sub', '8b222222-2222-2222-2222-222222222222', true);
select set_config('role', 'authenticated', true);
select is(
  (public.add_project_supporting_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b121212-1212-1212-1212-121212121212'::uuid,
    'add_supp_dup_01'
  )->>'unchanged'),
  'true',
  'Duplicate current supporting is unchanged'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select is(
  (public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'set_lead_init_01'
  )->>'assignment_role'),
  'lead_designer',
  'SA set lead initializes assignment'
);

select set_config('role', 'postgres', true);
select is(
  (select state from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  'brief_received',
  'First lead assignment creates workflow at brief_received'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.add_project_supporting_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'add_lead_as_supp'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Current lead cannot also be supporting'
);

select is(
  (public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b121212-1212-1212-1212-121212121212'::uuid,
    'promote_supp_lead',
    'promoted from supporting'
  )->>'designer_id'),
  '8b121212-1212-1212-1212-121212121212',
  'Promoting supporting to lead succeeds'
);

select set_config('role', 'postgres', true);
select is(
  (
    select count(*)::integer from public.project_designer_assignments
    where project_id = current_setting('test.phase8b_project')::uuid
      and assignment_role = 'lead_designer'
      and ended_at is null
  ),
  1,
  'Exactly one current lead'
);
select is(
  (
    select count(*)::integer from public.project_designer_assignments
    where project_id = current_setting('test.phase8b_project')::uuid
      and designer_id = '8b121212-1212-1212-1212-121212121212'::uuid
      and assignment_role = 'supporting_designer'
      and ended_at is null
  ),
  0,
  'Promoting supporting to lead closes supporting row'
);
select is(
  (
    select count(*)::integer from public.project_designer_assignments
    where project_id = current_setting('test.phase8b_project')::uuid
      and designer_id = '8b121212-1212-1212-1212-121212121212'::uuid
      and assignment_role = 'supporting_designer'
  ),
  1,
  'Closed supporting history is retained'
);

select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select set_config('role', 'authenticated', true);
select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_pending',
    'trans_meas_pending'
  )->>'state'),
  'measurement_pending',
  'Lead transitions to measurement_pending before reassignment'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select is(
  (public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'reassign_lead_01',
    'reassign after measurement'
  )->>'designer_id'),
  '8b555555-5555-5555-5555-555555555555',
  'SA reassigns lead designer'
);

select set_config('role', 'postgres', true);
select is(
  (select state from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  'measurement_pending',
  'Lead reassignment preserves workflow state'
);

select set_config('request.jwt.claim.sub', '8b222222-2222-2222-2222-222222222222', true);
select set_config('role', 'authenticated', true);
select is(
  (public.add_project_supporting_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b121212-1212-1212-1212-121212121212'::uuid,
    'add_supp_after_reassign'
  )->>'unchanged'),
  'false',
  'Former lead can be added as supporting after reassignment'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select is(
  (public.remove_project_designer_assignment(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'remove_lead_01',
    'temporarily unstaffed'
  )->>'success'),
  'true',
  'SA can remove current lead'
);

select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  1,
  'Removing lead leaves workflow row'
);
select is(
  (
    select count(*)::integer from public.project_designer_assignments
    where project_id = current_setting('test.phase8b_project')::uuid
  ) > 1,
  true,
  'Assignment history is not deleted'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_completed',
    'trans_old_lead'
  )$$,
  '42501',
  'FORBIDDEN: Only the current Lead Designer may transition design.',
  'Former lead cannot transition after removal'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select is(
  (public.set_project_lead_designer(
    current_setting('test.phase8b_project')::uuid,
    '8b555555-5555-5555-5555-555555555555'::uuid,
    'restaff_lead_8b'
  )->>'assignment_role'),
  'lead_designer',
  'SA restaffs original lead for remaining tests'
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8b333333-3333-3333-3333-333333333333', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  0,
  'SE has no detailed design workflow access'
);

select set_config('request.jwt.claim.sub', '8b777777-7777-7777-7777-777777777777', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  0,
  'Unassigned designer-equivalent other PM cannot read design workflow'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  1,
  'Assigned lead can select workflow'
);

select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  1,
  'Assigned PM can select workflow'
);

select throws_ok(
  $$insert into public.project_designer_assignments (
    project_id, designer_id, assignment_role, assigned_by
  ) values (
    current_setting('test.phase8b_project')::uuid,
    '8b121212-1212-1212-1212-121212121212'::uuid,
    'supporting_designer',
    '8b111111-1111-1111-1111-111111111111'::uuid
  )$$,
  '42501',
  null,
  'Authenticated direct INSERT on project_designer_assignments is denied'
);

select set_config('role', 'postgres', true);
insert into public.project_design_evidence (
  project_id, evidence_type, source_type, source_reference, captured_by, note
) values (
  current_setting('test.phase8b_project')::uuid,
  'client_approval',
  'offline_note',
  'append-only-probe',
  '8b111111-1111-1111-1111-111111111111',
  'probe note for append-only guard'
);

select throws_ok(
  $$update public.project_design_evidence
    set note = 'mutated'
    where source_reference = 'append-only-probe'
      and project_id = current_setting('test.phase8b_project')::uuid$$,
  '55000',
  'project_design_evidence is append-only',
  'postgres update evidence throws append-only'
);

-- Unassigned designer (supporting user was assigned; use other PM already 0).
-- Re-check supporting user before they were assigned is covered earlier (no workflow).
-- After restaff, supporting 121212 is currently assigned and can read:
select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select set_config('role', 'authenticated', true);
select is(
  (select count(*)::integer from public.project_design_workflows
    where project_id = current_setting('test.phase8b_project')::uuid),
  1,
  'Currently assigned supporting designer can select workflow'
);

-- ----------------------------------------------------------------------------
-- Workflow + deliverable saga
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'concept_design',
    'trans_skip_invalid'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Skip invalid ordinary transition is rejected'
);

select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_completed',
    'trans_supp_denied'
  )$$,
  '42501',
  'FORBIDDEN: Only the current Lead Designer may transition design.',
  'Supporting cannot ordinary-transition'
);

select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_completed',
    'trans_pm_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'PM cannot ordinary-transition'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_completed',
    'trans_sa_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'SA cannot ordinary-transition'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_completed',
    'trans_meas_no_sheet'
  )$$,
  'PROJECT_MISSING_EVIDENCE',
  'measurement_completed without ready sheet throws PROJECT_MISSING_EVIDENCE'
);

select set_config(
  'test.phase8b_sheet_reserve',
  public.reserve_project_design_deliverable_version(
    current_setting('test.phase8b_project')::uuid,
    'site-sheet',
    'measurement_sheet',
    'Site measurement sheet',
    'sheet.pdf',
    'application/pdf',
    1024,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'reserve_sheet_01'
  )::text,
  true
);

select is(
  (current_setting('test.phase8b_sheet_reserve')::jsonb->>'upload_status'),
  'pending',
  'Lead reserved measurement_sheet version as pending'
);

select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_completed',
    'trans_meas_pending_ver'
  )$$,
  'PROJECT_MISSING_EVIDENCE',
  'Pending deliverable version is insufficient for measurement_completed'
);

select set_config('role', 'postgres', true);
select set_config(
  'test.phase8b_sheet_path',
  current_setting('test.phase8b_sheet_reserve')::jsonb->>'object_path',
  true
);

insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'project-design-documents',
  current_setting('test.phase8b_sheet_path'),
  '8b555555-5555-5555-5555-555555555555',
  '8b555555-5555-5555-5555-555555555555',
  '{}'::jsonb
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  (public.finalize_project_design_deliverable_version(
    (current_setting('test.phase8b_sheet_reserve')::jsonb->>'version_id')::uuid,
    'finalize_sheet_01'
  )->>'upload_status'),
  'ready',
  'Finalize measurement sheet after storage object exists'
);

select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'measurement_completed',
    'trans_meas_ok_01'
  )->>'state'),
  'measurement_completed',
  'measurement_completed succeeds with ready sheet'
);

select set_config('role', 'postgres', true);
select is(
  (select status from public.projects where id = current_setting('test.phase8b_project')::uuid),
  'handover_accepted',
  'projects.status remains handover_accepted after design transitions'
);

-- ----------------------------------------------------------------------------
-- Hold / resume
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.hold_project_design(
    current_setting('test.phase8b_project')::uuid,
    'hold_supp_denied',
    'waiting on client calendar'
  )$$,
  '42501',
  'FORBIDDEN',
  'Supporting hold denied'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.hold_project_design(
    current_setting('test.phase8b_project')::uuid,
    'hold_empty_reason',
    ''
  )$$,
  'INVALID_REASON',
  'Empty hold reason throws INVALID_REASON'
);

select is(
  (public.hold_project_design(
    current_setting('test.phase8b_project')::uuid,
    'hold_lead_reason',
    'waiting on client calendar'
  )->>'state'),
  'design_on_hold',
  'Lead can hold with a reason'
);

select is(
  (public.resume_project_design(
    current_setting('test.phase8b_project')::uuid,
    'resume_lead_01',
    'client dates confirmed'
  )->>'state'),
  'measurement_completed',
  'Resume restores exact prior state'
);

select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select is(
  (public.hold_project_design(
    current_setting('test.phase8b_project')::uuid,
    'hold_pm_allowed',
    'pm requested design pause'
  )->>'state'),
  'design_on_hold',
  'Assigned PM can hold design'
);

select is(
  (public.resume_project_design(
    current_setting('test.phase8b_project')::uuid,
    'resume_pm_01',
    'pm released design hold'
  )->>'state'),
  'measurement_completed',
  'PM resume restores measurement_completed'
);

-- ----------------------------------------------------------------------------
-- Walk remaining ordinary states, revision, client approval, production ready
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'concept_design',
    'trans_concept_01'
  )->>'state'),
  'concept_design',
  'Lead advances to concept_design'
);

select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'internal_review',
    'trans_internal_01'
  )->>'state'),
  'internal_review',
  'Lead advances to internal_review'
);

select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'revision_required',
    'trans_revision_01',
    'client asked for layout options',
    'concept_design'
  )->>'state'),
  'revision_required',
  'Lead sends workflow to revision_required'
);

select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'concept_design',
    'trans_rev_return_01'
  )->>'state'),
  'concept_design',
  'Revision return restores concept_design'
);

select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'internal_review',
    'trans_internal_02'
  )->>'state'),
  'internal_review',
  'Lead returns to internal_review'
);

select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'client_review',
    'trans_client_rev_01'
  )->>'state'),
  'client_review',
  'Lead advances to client_review'
);

select is(
  public.can_record_project_client_approval(current_setting('test.phase8b_project')::uuid),
  true,
  'Current Lead preflight is true in client_review'
);
select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select is(
  public.can_record_project_client_approval(current_setting('test.phase8b_project')::uuid),
  true,
  'Current PM preflight is true in client_review'
);
select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select is(
  public.can_record_project_client_approval(current_setting('test.phase8b_project')::uuid),
  false,
  'Supporting preflight is false for client approval'
);
select set_config('request.jwt.claim.sub', '8b777777-7777-7777-7777-777777777777', true);
select is(
  public.can_record_project_client_approval(current_setting('test.phase8b_project')::uuid),
  false,
  'Other PM preflight is false for client approval'
);
select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select is(
  public.can_record_project_client_approval(current_setting('test.phase8b_project')::uuid),
  false,
  'SA preflight is false for client approval'
);
select set_config('request.jwt.claim.sub', '8b222222-2222-2222-2222-222222222222', true);
select is(
  public.can_record_project_client_approval(current_setting('test.phase8b_project')::uuid),
  false,
  'SM preflight is false for client approval'
);
select set_config('role', 'postgres', true);
update public.profiles set status = 'disabled' where id = '8b555555-5555-5555-5555-555555555555';
select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  public.can_record_project_client_approval(current_setting('test.phase8b_project')::uuid),
  false,
  'Inactive Lead preflight is false for client approval'
);
select set_config('role', 'postgres', true);
update public.profiles set status = 'active' where id = '8b555555-5555-5555-5555-555555555555';

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  format(
    $f$select public.record_project_client_approval(
      %L::uuid,
      'client_appr_missing_obj',
      'uploaded_artifact',
      'projects/%s/evidence/client_approval/missing.pdf',
      'Client signed board',
      'projects/%s/evidence/client_approval/missing.pdf',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      1024,
      'application/pdf'
    )$f$,
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Fabricated uploaded client-approval path without storage object is rejected'
);
select throws_ok(
  format(
    $f$select public.record_project_client_approval(
      %L::uuid,
      'client_appr_other_project',
      'uploaded_artifact',
      'projects/00000000-0000-0000-0000-000000000001/evidence/client_approval/x.pdf',
      'Client signed board',
      'projects/00000000-0000-0000-0000-000000000001/evidence/client_approval/x.pdf',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      1024,
      'application/pdf'
    )$f$,
    current_setting('test.phase8b_project')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Uploaded client-approval path for another project is rejected'
);
select throws_ok(
  format(
    $f$select public.record_project_client_approval(
      %L::uuid,
      'client_appr_ref_mismatch',
      'uploaded_artifact',
      'projects/%s/evidence/client_approval/a.pdf',
      'Client signed board',
      'projects/%s/evidence/client_approval/b.pdf',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      1024,
      'application/pdf'
    )$f$,
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Uploaded client-approval source_reference must equal storage path'
);
select throws_ok(
  format(
    $f$select public.record_project_client_approval(
      %L::uuid,
      'client_appr_bad_mime',
      'uploaded_artifact',
      'projects/%s/evidence/client_approval/x.bin',
      'Client signed board',
      'projects/%s/evidence/client_approval/x.bin',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      1024,
      'application/octet-stream'
    )$f$,
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Unsupported uploaded client-approval MIME is rejected'
);
select throws_ok(
  format(
    $f$select public.record_project_client_approval(
      %L::uuid,
      'client_appr_too_big',
      'uploaded_artifact',
      'projects/%s/evidence/client_approval/x.pdf',
      'Client signed board',
      'projects/%s/evidence/client_approval/x.pdf',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      20971521,
      'application/pdf'
    )$f$,
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Uploaded client-approval larger than 20 MiB is rejected'
);

select set_config('role', 'postgres', true);
select set_config(
  'test.phase8b_wrong_bucket_path',
  'projects/' || current_setting('test.phase8b_project') || '/evidence/client_approval/wrong-bucket.pdf',
  true
);
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'quotation-documents',
  current_setting('test.phase8b_wrong_bucket_path'),
  '8b555555-5555-5555-5555-555555555555',
  '8b555555-5555-5555-5555-555555555555',
  '{}'::jsonb
);
select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  format(
    $f$select public.record_project_client_approval(
      %L::uuid,
      'client_appr_wrong_bucket',
      'uploaded_artifact',
      %L,
      'Client signed board',
      %L,
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      1024,
      'application/pdf'
    )$f$,
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_wrong_bucket_path'),
    current_setting('test.phase8b_wrong_bucket_path')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Uploaded client-approval object in another bucket is rejected'
);

savepoint uploaded_client_approval_ok;
select set_config('role', 'postgres', true);
select set_config(
  'test.phase8b_ok_evidence_path',
  'projects/' || current_setting('test.phase8b_project') || '/evidence/client_approval/ok.pdf',
  true
);
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'project-design-documents',
  current_setting('test.phase8b_ok_evidence_path'),
  '8b555555-5555-5555-5555-555555555555',
  '8b555555-5555-5555-5555-555555555555',
  '{}'::jsonb
);
select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  (public.record_project_client_approval(
    current_setting('test.phase8b_project')::uuid,
    'client_appr_uploaded_ok',
    'uploaded_artifact',
    current_setting('test.phase8b_ok_evidence_path'),
    'Client signed board',
    current_setting('test.phase8b_ok_evidence_path'),
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    1024,
    'application/pdf'
  )->>'state'),
  'client_approved',
  'Uploaded client approval succeeds when the private object exists'
);
rollback to savepoint uploaded_client_approval_ok;

select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select throws_ok(
  $$select public.record_project_client_approval(
    current_setting('test.phase8b_project')::uuid,
    'client_appr_supp',
    'offline_note',
    'site-meeting-note',
    'Client approved concept in writing'
  )$$,
  '42501',
  'FORBIDDEN',
  'Supporting cannot record client approval'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.record_project_client_approval(
    current_setting('test.phase8b_project')::uuid,
    'client_appr_sa',
    'offline_note',
    'site-meeting-note',
    'Client approved concept in writing'
  )$$,
  '42501',
  'FORBIDDEN',
  'SA cannot record client approval'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select is(
  (public.record_project_client_approval(
    current_setting('test.phase8b_project')::uuid,
    'client_appr_lead',
    'offline_note',
    'site-meeting-note',
    'Client approved concept in writing'
  )->>'state'),
  'client_approved',
  'Lead records offline_note client approval'
);

select set_config(
  'test.phase8b_evidence_count',
  (
    select count(*)::text from public.project_design_evidence
    where project_id = current_setting('test.phase8b_project')::uuid
      and evidence_type = 'client_approval'
      and source_reference = 'site-meeting-note'
  ),
  true
);

select is(
  (public.record_project_client_approval(
    current_setting('test.phase8b_project')::uuid,
    'client_appr_lead',
    'offline_note',
    'site-meeting-note',
    'Client approved concept in writing'
  )->>'state'),
  'client_approved',
  'Same client-approval idempotency key replays'
);

select set_config('role', 'postgres', true);
select is(
  (
    select count(*)::integer from public.project_design_evidence
    where project_id = current_setting('test.phase8b_project')::uuid
      and evidence_type = 'client_approval'
      and source_reference = 'site-meeting-note'
  ),
  current_setting('test.phase8b_evidence_count')::integer,
  'Client-approval replay does not duplicate evidence'
);

select set_config(
  'test.phase8b_event_count',
  (
    select count(*)::text from public.project_events
    where project_id = current_setting('test.phase8b_project')::uuid
  ),
  true
);

select ok(
  exists (
    select 1 from public.project_events
    where project_id = current_setting('test.phase8b_project')::uuid
      and event_type = 'project.client_approved'
  ),
  'Client approval reuses project_events'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  (public.record_project_client_approval(
    current_setting('test.phase8b_project')::uuid,
    'client_appr_lead',
    'offline_note',
    'site-meeting-note',
    'Client approved concept in writing'
  )->>'state'),
  'client_approved',
  'Second replay still returns durable client_approved'
);

select set_config('role', 'postgres', true);
select is(
  (
    select count(*)::integer from public.project_events
    where project_id = current_setting('test.phase8b_project')::uuid
  ),
  current_setting('test.phase8b_event_count')::integer,
  'Idempotent replay does not insert extra project_events'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  (public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'production_drawings',
    'trans_prod_draw_01'
  )->>'state'),
  'production_drawings',
  'Lead advances to production_drawings'
);

select set_config(
  'test.phase8b_draw_reserve',
  public.reserve_project_design_deliverable_version(
    current_setting('test.phase8b_project')::uuid,
    'prod-drawing',
    'production_drawing',
    'Production drawing set',
    'drawing.pdf',
    'application/pdf',
    2048,
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    'reserve_drawing_01'
  )::text,
  true
);

select set_config('role', 'postgres', true);
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'project-design-documents',
  current_setting('test.phase8b_draw_reserve')::jsonb->>'object_path',
  '8b555555-5555-5555-5555-555555555555',
  '8b555555-5555-5555-5555-555555555555',
  '{}'::jsonb
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  (public.finalize_project_design_deliverable_version(
    (current_setting('test.phase8b_draw_reserve')::jsonb->>'version_id')::uuid,
    'finalize_drawing_01'
  )->>'upload_status'),
  'ready',
  'Production drawing version is ready'
);

select is(
  public.can_approve_project_production_ready(current_setting('test.phase8b_project')::uuid),
  true,
  'Current Lead preflight is true at production_drawings with gates'
);
select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select is(
  public.can_approve_project_production_ready(current_setting('test.phase8b_project')::uuid),
  false,
  'Supporting preflight is false for production ready'
);
select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select is(
  public.can_approve_project_production_ready(current_setting('test.phase8b_project')::uuid),
  false,
  'PM preflight is false for production ready'
);
select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select throws_ok(
  format(
    $f$select public.approve_project_production_ready(
      %L::uuid,
      'prod_ready_missing_obj',
      'uploaded_artifact',
      'projects/%s/evidence/production_ready/missing.pdf',
      'Ready pack',
      'projects/%s/evidence/production_ready/missing.pdf',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      2048,
      'application/pdf'
    )$f$,
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Fabricated uploaded production-ready path without storage object is rejected'
);
select throws_ok(
  format(
    $f$select public.approve_project_production_ready(
      %L::uuid,
      'prod_ready_ref_mismatch',
      'uploaded_artifact',
      'projects/%s/evidence/production_ready/a.pdf',
      'Ready pack',
      'projects/%s/evidence/production_ready/b.pdf',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      2048,
      'application/pdf'
    )$f$,
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project'),
    current_setting('test.phase8b_project')
  ),
  'PROJECT_MISSING_EVIDENCE',
  'Uploaded production-ready source_reference must equal storage path'
);

savepoint uploaded_production_ready_ok;
select set_config('role', 'postgres', true);
select set_config(
  'test.phase8b_ok_prd_path',
  'projects/' || current_setting('test.phase8b_project') || '/evidence/production_ready/ok.pdf',
  true
);
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values (
  'project-design-documents',
  current_setting('test.phase8b_ok_prd_path'),
  '8b555555-5555-5555-5555-555555555555',
  '8b555555-5555-5555-5555-555555555555',
  '{}'::jsonb
);
select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  (public.approve_project_production_ready(
    current_setting('test.phase8b_project')::uuid,
    'prod_ready_uploaded_ok',
    'uploaded_artifact',
    current_setting('test.phase8b_ok_prd_path'),
    'Ready pack',
    current_setting('test.phase8b_ok_prd_path'),
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    2048,
    'application/pdf'
  )->>'state'),
  'production_ready',
  'Uploaded production ready succeeds when the private object exists'
);
rollback to savepoint uploaded_production_ready_ok;

select set_config('request.jwt.claim.sub', '8b121212-1212-1212-1212-121212121212', true);
select throws_ok(
  $$select public.approve_project_production_ready(
    current_setting('test.phase8b_project')::uuid,
    'prod_ready_supp',
    'offline_note',
    'production-pack-v1',
    'Ready for production handover'
  )$$,
  '42501',
  'FORBIDDEN: Only the current Lead Designer may approve production ready.',
  'Supporting cannot approve production ready'
);

select set_config('request.jwt.claim.sub', '8b666666-6666-6666-6666-666666666666', true);
select throws_ok(
  $$select public.approve_project_production_ready(
    current_setting('test.phase8b_project')::uuid,
    'prod_ready_pm',
    'offline_note',
    'production-pack-v1',
    'Ready for production handover'
  )$$,
  '42501',
  'FORBIDDEN',
  'PM cannot approve production ready'
);

select set_config('request.jwt.claim.sub', '8b111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.approve_project_production_ready(
    current_setting('test.phase8b_project')::uuid,
    'prod_ready_sa',
    'offline_note',
    'production-pack-v1',
    'Ready for production handover'
  )$$,
  '42501',
  'FORBIDDEN',
  'SA cannot approve production ready'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select is(
  (public.approve_project_production_ready(
    current_setting('test.phase8b_project')::uuid,
    'prod_ready_lead',
    'offline_note',
    'production-pack-v1',
    'Ready for production handover'
  )->>'state'),
  'production_ready',
  'Lead approves production ready'
);

select hasnt_table('public', 'project_execution_states', 'approving production ready does not create execution tables');
select ok(
  not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'project_execution_states',
        'project_execution_tasks',
        'project_site_executions'
      )
  ),
  'No Phase 8C execution persistence tables exist'
);

select is(
  (public.complete_project_design(
    current_setting('test.phase8b_project')::uuid,
    'complete_design_01'
  )->>'state'),
  'design_completed',
  'Lead completes design from production_ready without extra evidence'
);

select set_config(
  'test.phase8b_event_count_complete',
  (
    select count(*)::text from public.project_events
    where project_id = current_setting('test.phase8b_project')::uuid
  ),
  true
);

select is(
  (public.complete_project_design(
    current_setting('test.phase8b_project')::uuid,
    'complete_design_01'
  )->>'state'),
  'design_completed',
  'Complete-design replay returns durable result'
);

select set_config('role', 'postgres', true);
select is(
  (
    select count(*)::integer from public.project_events
    where project_id = current_setting('test.phase8b_project')::uuid
  ),
  current_setting('test.phase8b_event_count_complete')::integer,
  'Complete-design replay inserts no extra events'
);
select is(
  (
    select count(*)::integer from public.project_events
    where project_id = current_setting('test.phase8b_project')::uuid
      and event_type = 'project.design_completed'
  ),
  1,
  'project.design_completed event is unique'
);

select set_config('request.jwt.claim.sub', '8b555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.hold_project_design(
    current_setting('test.phase8b_project')::uuid,
    'hold_after_complete',
    'should not hold completed design'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Cannot hold after design_completed'
);

select throws_ok(
  $$select public.transition_project_design(
    current_setting('test.phase8b_project')::uuid,
    'production_ready',
    'trans_after_complete'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Terminal design_completed blocks further transition'
);

select set_config('role', 'postgres', true);
select is(
  (select status from public.projects where id = current_setting('test.phase8b_project')::uuid),
  'handover_accepted',
  'projects.status remains handover_accepted after design_completed'
);

select finish();
rollback;
