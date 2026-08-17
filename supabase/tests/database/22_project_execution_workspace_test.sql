begin;
select no_plan();

-- ----------------------------------------------------------------------------
-- Foundation
-- ----------------------------------------------------------------------------
select ok(
  exists (select 1 from public.permissions where code = 'project_execution.read'),
  'project_execution.read permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_execution.transition'),
  'project_execution.transition permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_execution.hold'),
  'project_execution.hold permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_execution.snag'),
  'project_execution.snag permission exists'
);
select ok(
  exists (select 1 from public.permissions where code = 'project_execution.cancel'),
  'project_execution.cancel permission exists'
);
select ok(
  not exists (select 1 from public.permissions where code = 'project_execution.manage'),
  'project_execution.manage is not created'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_execution.read'
      and r.code in ('super_admin', 'sales_manager', 'project_manager')
  ),
  3,
  'project_execution.read granted to SA/SM/PM'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_execution.transition'
      and r.code = 'project_manager'
  ),
  1,
  'project_execution.transition granted to PM only'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_execution.hold'
      and r.code = 'project_manager'
  ),
  1,
  'project_execution.hold granted to PM only'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_execution.snag'
      and r.code = 'project_manager'
  ),
  1,
  'project_execution.snag granted to PM only'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code in (
      'project_execution.transition',
      'project_execution.hold',
      'project_execution.snag'
    )
      and r.code in ('super_admin', 'sales_manager')
  ),
  0,
  'SA/SM have no transition/hold/snag grants'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'project_execution.cancel'
      and r.code in ('super_admin', 'sales_manager', 'project_manager')
  ),
  3,
  'project_execution.cancel granted to SA/SM/PM'
);

select is(
  (
    select count(*)::integer
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code like 'project_execution.%'
      and r.code in ('designer', 'sales_executive', 'management', 'sales', 'project_operations')
  ),
  0,
  'No project_execution grants to designer/sales_executive/management/sales/project_operations'
);

select has_table('public', 'project_execution_workflows', 'project_execution_workflows exists');
select has_table('public', 'project_execution_snags', 'project_execution_snags exists');
select has_table('public', 'project_execution_evidence', 'project_execution_evidence exists');

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_execution_workflows'
      and column_name = 'material_finalisation'
  ),
  'project_execution_workflows has no material_finalisation column'
);

select ok(
  (
    select not (
      pg_get_constraintdef(c.oid) ilike '%project_created%'
      or pg_get_constraintdef(c.oid) ilike '%material_finalisation%'
    )
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'project_execution_workflows'
      and c.conname = 'chk_project_execution_workflows_state'
  ),
  'execution state check excludes project_created and material_finalisation'
);

select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_execution_workflows' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_execution_workflows'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_execution_snags' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_execution_snags'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'project_execution_evidence' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS enabled on project_execution_evidence'
);

select is(
  (select public from storage.buckets where id = 'project-execution-documents'),
  false,
  'bucket project-execution-documents is private'
);

select is(
  (select count(*)::integer from storage.objects where bucket_id = 'project-execution-documents'),
  0,
  'no objects in project-execution-documents at start'
);

select ok(
  (
    select bool_and(coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and (
        (n.nspname = 'public' and p.proname in (
          'repair_project_execution_workflow',
          'can_transition_project_execution',
          'can_resolve_project_execution_snag',
          'can_record_project_execution_handover',
          'can_complete_project_execution',
          'can_view_project_execution_detail',
          'transition_project_execution',
          'hold_project_execution',
          'resume_project_execution',
          'cancel_project_execution',
          'create_project_execution_snag',
          'start_project_execution_snag',
          'resolve_project_execution_snag',
          'record_project_execution_handover',
          'complete_project_execution',
          'get_project_execution_high_level_status'
        ))
        or (n.nspname = 'private' and p.proname in (
          'project_execution_entry_eligible',
          'project_execution_is_current_pm',
          'project_execution_can_view_detail',
          'project_execution_is_assigned_designer',
          'project_execution_uploaded_evidence_object_exists',
          'project_execution_whatsapp_belongs_to_project',
          'project_execution_has_blocking_snags',
          'project_execution_require_active_actor',
          'project_execution_assert_evidence_args',
          'project_execution_insert_evidence',
          'prevent_project_execution_workflow_mutation',
          'prevent_project_execution_snag_mutation',
          'materialize_project_execution_impl',
          'trg_after_design_completed_materialize_execution'
        ))
      )
  ),
  'Phase 8C SECURITY DEFINER helpers set search_path'
);

select is(
  has_function_privilege('authenticated', 'private.project_execution_entry_eligible(uuid)', 'execute'),
  false,
  'authenticated cannot execute project_execution_entry_eligible'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_is_current_pm(uuid,uuid)', 'execute'),
  false,
  'authenticated cannot execute project_execution_is_current_pm'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_is_assigned_designer(uuid,uuid)', 'execute'),
  false,
  'authenticated cannot execute project_execution_is_assigned_designer'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_uploaded_evidence_object_exists(uuid,text)', 'execute'),
  false,
  'authenticated cannot execute project_execution_uploaded_evidence_object_exists'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_whatsapp_belongs_to_project(uuid,uuid)', 'execute'),
  false,
  'authenticated cannot execute project_execution_whatsapp_belongs_to_project'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_has_blocking_snags(uuid)', 'execute'),
  false,
  'authenticated cannot execute project_execution_has_blocking_snags'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_require_active_actor()', 'execute'),
  false,
  'authenticated cannot execute project_execution_require_active_actor'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_assert_evidence_args(text,text,text,text,text,bigint,text)', 'execute'),
  false,
  'authenticated cannot execute project_execution_assert_evidence_args'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_insert_evidence(uuid,uuid,text,text,uuid,text,text,text,text,text,bigint,text)', 'execute'),
  false,
  'authenticated cannot execute project_execution_insert_evidence'
);
select is(
  has_function_privilege('authenticated', 'private.prevent_project_execution_workflow_mutation()', 'execute'),
  false,
  'authenticated cannot execute prevent_project_execution_workflow_mutation'
);
select is(
  has_function_privilege('authenticated', 'private.prevent_project_execution_snag_mutation()', 'execute'),
  false,
  'authenticated cannot execute prevent_project_execution_snag_mutation'
);
select is(
  has_function_privilege('authenticated', 'private.materialize_project_execution_impl(uuid,text,uuid,text)', 'execute'),
  false,
  'authenticated cannot execute materialize_project_execution_impl'
);
select is(
  has_function_privilege('authenticated', 'private.trg_after_design_completed_materialize_execution()', 'execute'),
  false,
  'authenticated cannot execute trg_after_design_completed_materialize_execution'
);
select is(
  has_function_privilege('authenticated', 'private.project_execution_can_view_detail(uuid)', 'execute'),
  true,
  'authenticated can execute private.project_execution_can_view_detail for RLS'
);

select is(
  has_function_privilege('authenticated', 'public.repair_project_execution_workflow(uuid,text)', 'execute'),
  true,
  'authenticated can execute public.repair_project_execution_workflow'
);
select is(
  has_function_privilege('anon', 'public.repair_project_execution_workflow(uuid,text)', 'execute'),
  false,
  'anon cannot execute public.repair_project_execution_workflow'
);
select is(
  has_function_privilege('authenticated', 'public.can_transition_project_execution(uuid,text)', 'execute'),
  true,
  'authenticated can execute public.can_transition_project_execution'
);
select is(
  has_function_privilege('anon', 'public.can_transition_project_execution(uuid,text)', 'execute'),
  false,
  'anon cannot execute public.can_transition_project_execution'
);
select is(
  has_function_privilege('authenticated', 'public.can_resolve_project_execution_snag(uuid)', 'execute'),
  true,
  'authenticated can execute public.can_resolve_project_execution_snag'
);
select is(
  has_function_privilege('anon', 'public.can_resolve_project_execution_snag(uuid)', 'execute'),
  false,
  'anon cannot execute public.can_resolve_project_execution_snag'
);
select is(
  has_function_privilege('authenticated', 'public.can_record_project_execution_handover(uuid)', 'execute'),
  true,
  'authenticated can execute public.can_record_project_execution_handover'
);
select is(
  has_function_privilege('anon', 'public.can_record_project_execution_handover(uuid)', 'execute'),
  false,
  'anon cannot execute public.can_record_project_execution_handover'
);
select is(
  has_function_privilege('authenticated', 'public.can_complete_project_execution(uuid)', 'execute'),
  true,
  'authenticated can execute public.can_complete_project_execution'
);
select is(
  has_function_privilege('anon', 'public.can_complete_project_execution(uuid)', 'execute'),
  false,
  'anon cannot execute public.can_complete_project_execution'
);
select is(
  has_function_privilege('authenticated', 'public.can_view_project_execution_detail(uuid)', 'execute'),
  true,
  'authenticated can execute public.can_view_project_execution_detail'
);
select is(
  has_function_privilege('anon', 'public.can_view_project_execution_detail(uuid)', 'execute'),
  false,
  'anon cannot execute public.can_view_project_execution_detail'
);
select is(
  has_function_privilege('authenticated', 'public.transition_project_execution(uuid,text,text,text,text,text,text,text,bigint,text)', 'execute'),
  true,
  'authenticated can execute public.transition_project_execution'
);
select is(
  has_function_privilege('anon', 'public.transition_project_execution(uuid,text,text,text,text,text,text,text,bigint,text)', 'execute'),
  false,
  'anon cannot execute public.transition_project_execution'
);
select is(
  has_function_privilege('authenticated', 'public.hold_project_execution(uuid,text,text,text)', 'execute'),
  true,
  'authenticated can execute public.hold_project_execution'
);
select is(
  has_function_privilege('anon', 'public.hold_project_execution(uuid,text,text,text)', 'execute'),
  false,
  'anon cannot execute public.hold_project_execution'
);
select is(
  has_function_privilege('authenticated', 'public.resume_project_execution(uuid,text)', 'execute'),
  true,
  'authenticated can execute public.resume_project_execution'
);
select is(
  has_function_privilege('anon', 'public.resume_project_execution(uuid,text)', 'execute'),
  false,
  'anon cannot execute public.resume_project_execution'
);
select is(
  has_function_privilege('authenticated', 'public.cancel_project_execution(uuid,text,text)', 'execute'),
  true,
  'authenticated can execute public.cancel_project_execution'
);
select is(
  has_function_privilege('anon', 'public.cancel_project_execution(uuid,text,text)', 'execute'),
  false,
  'anon cannot execute public.cancel_project_execution'
);
select is(
  has_function_privilege('authenticated', 'public.create_project_execution_snag(uuid,text,text,text)', 'execute'),
  true,
  'authenticated can execute public.create_project_execution_snag'
);
select is(
  has_function_privilege('anon', 'public.create_project_execution_snag(uuid,text,text,text)', 'execute'),
  false,
  'anon cannot execute public.create_project_execution_snag'
);
select is(
  has_function_privilege('authenticated', 'public.start_project_execution_snag(uuid,text)', 'execute'),
  true,
  'authenticated can execute public.start_project_execution_snag'
);
select is(
  has_function_privilege('anon', 'public.start_project_execution_snag(uuid,text)', 'execute'),
  false,
  'anon cannot execute public.start_project_execution_snag'
);
select is(
  has_function_privilege('authenticated', 'public.resolve_project_execution_snag(uuid,text,text,text,text,text,text,bigint,text)', 'execute'),
  true,
  'authenticated can execute public.resolve_project_execution_snag'
);
select is(
  has_function_privilege('anon', 'public.resolve_project_execution_snag(uuid,text,text,text,text,text,text,bigint,text)', 'execute'),
  false,
  'anon cannot execute public.resolve_project_execution_snag'
);
select is(
  has_function_privilege('authenticated', 'public.record_project_execution_handover(uuid,text,text,text,text,text,text,bigint,text)', 'execute'),
  true,
  'authenticated can execute public.record_project_execution_handover'
);
select is(
  has_function_privilege('anon', 'public.record_project_execution_handover(uuid,text,text,text,text,text,text,bigint,text)', 'execute'),
  false,
  'anon cannot execute public.record_project_execution_handover'
);
select is(
  has_function_privilege('authenticated', 'public.complete_project_execution(uuid,text,text,text,text,text,text,bigint,text)', 'execute'),
  true,
  'authenticated can execute public.complete_project_execution'
);
select is(
  has_function_privilege('anon', 'public.complete_project_execution(uuid,text,text,text,text,text,text,bigint,text)', 'execute'),
  false,
  'anon cannot execute public.complete_project_execution'
);
select is(
  has_function_privilege('authenticated', 'public.get_project_execution_high_level_status(uuid)', 'execute'),
  true,
  'authenticated can execute public.get_project_execution_high_level_status'
);
select is(
  has_function_privilege('anon', 'public.get_project_execution_high_level_status(uuid)', 'execute'),
  false,
  'anon cannot execute public.get_project_execution_high_level_status'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%project-execution-documents%'
        or coalesce(with_check, '') ilike '%project-execution-documents%'
      )
  ),
  0,
  'no storage.objects policies grant project-execution-documents'
);

select hasnt_table('public', 'procurement', 'No ERP procurement table');
select hasnt_table('public', 'inventory', 'No ERP inventory table');
select hasnt_table('public', 'milestones', 'No ERP milestones table');
select hasnt_table('public', 'project_milestones', 'No project_milestones table');

-- ----------------------------------------------------------------------------
-- Fixture: users, lead, quotation, accept Closed-Won, materialize, PM assign
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);

insert into auth.users (id, instance_id, email, aud, role) values
  ('8c111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'sm_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'se2_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'lead_designer_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c121212-1212-1212-1212-121212121212', '00000000-0000-0000-0000-000000000000', 'supporting_designer_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'pm1_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'pm2_8c@onedecore.in', 'authenticated', 'authenticated'),
  ('8c999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'unassigned_designer_8c@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 8C ' || id::text
where id in (
  '8c111111-1111-1111-1111-111111111111',
  '8c222222-2222-2222-2222-222222222222',
  '8c333333-3333-3333-3333-333333333333',
  '8c444444-4444-4444-4444-444444444444',
  '8c555555-5555-5555-5555-555555555555',
  '8c121212-1212-1212-1212-121212121212',
  '8c666666-6666-6666-6666-666666666666',
  '8c777777-7777-7777-7777-777777777777',
  '8c999999-9999-9999-9999-999999999999'
);

insert into public.user_roles (user_id, role_id)
select '8c111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c555555-5555-5555-5555-555555555555', id from public.roles where code = 'designer' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c121212-1212-1212-1212-121212121212', id from public.roles where code = 'designer' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c666666-6666-6666-6666-666666666666', id from public.roles where code = 'project_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c777777-7777-7777-7777-777777777777', id from public.roles where code = 'project_manager' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '8c999999-9999-9999-9999-999999999999', id from public.roles where code = 'designer' on conflict do nothing;

insert into public.contacts (id, display_name, status)
values ('8caaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Phase 8C Client', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values
  ('8caaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'phone', '+919811122248', true),
  ('8caaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'client8c@example.com', true)
on conflict do nothing;

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, assigned_to
) values (
  '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '8caaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Phase 8C Client',
  'client8c@example.com',
  'assigned',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'public_intake',
  'complete-home-interiors',
  'apartment-3bhk',
  'ready-now',
  'v1',
  '/planner',
  '8c333333-3333-3333-3333-333333333333'
) on conflict (id) do nothing;

insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
values ('8ccccccc-cccc-cccc-cccc-cccccccccccc', 'gst_18_8c', 'GST 18 8C', 18.00, true, '8c111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select public.set_quotation_max_discount(25.00);

select set_config('request.jwt.claim.sub', '8c333333-3333-3333-3333-333333333333', true);
select public.create_quotation_draft(
  '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'Phase 8C Quotation'::text,
  'draft_key_8c_01'::text
);

select save_quotation_draft_items(
  (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  1::bigint,
  jsonb_build_array(
    jsonb_build_object(
      'sectionName', 'Living Room',
      'items', jsonb_build_array(
        jsonb_build_object('itemName', 'Sofa', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 10000000)
      )
    )
  ),
  'item_key_8c_01'
);

select update_quotation_draft(
  (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  2::bigint,
  p_tax_profile_id => '8ccccccc-cccc-cccc-cccc-cccccccccccc'::uuid
);

select replace_quotation_payment_schedule(
  (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  3::bigint,
  'percentage'::text,
  jsonb_build_array(
    jsonb_build_object('milestoneName', 'Advance', 'percentage', '50.00'),
    jsonb_build_object('milestoneName', 'Handover', 'percentage', '50.00')
  )
);

select finalize_quotation_version(
  (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  4,
  'fin_key_8c_01'
);

select set_config('role', 'postgres', true);
insert into public.quotation_pdf_documents (
  quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
) values (
  (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  'quotation-documents',
  '8c/v1.pdf',
  'ready',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  12000,
  '8c111111-1111-1111-1111-111111111111',
  now()
);

select issue_quotation_access_grant_internal(
  '8c333333-3333-3333-3333-333333333333'::uuid,
  '8cdddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) and version_number = 1),
  'cccccccccccccccccccccccccccccccc',
  encode(extensions.digest(convert_to('test_token_8c_01', 'UTF8'), 'sha256'), 'hex'),
  false
);

select set_config(
  'test.phase8c_quote',
  (select id::text from public.quotations where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  true
);
select set_config(
  'test.phase8c_ver',
  (
    select qv.id::text
    from public.quotation_versions qv
    where qv.quotation_id = current_setting('test.phase8c_quote')::uuid
      and qv.version_number = 1
  ),
  true
);

select set_config('role', 'anon', true);
select is(
  (public.accept_quotation_by_capability('test_token_8c_01', 'Phase 8C Client', 'client8c@example.com')->>'success'),
  'true',
  'Client acceptance creates Closed-Won'
);

select set_config('role', 'service_role', true);
select is(
  (public.materialize_closed_won_project_internal(current_setting('test.phase8c_ver')::uuid, 'post-acceptance:8c')->>'success'),
  'true',
  'Service-role materializer creates project'
);

select set_config('role', 'postgres', true);
select set_config(
  'test.phase8c_project',
  (select id::text from public.projects where lead_id = '8cbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  true
);

select is(
  (select status from public.projects where id = current_setting('test.phase8c_project')::uuid),
  'awaiting_project_manager_assignment',
  'Materialized project awaits PM assignment'
);

select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select is(
  (public.assign_project_manager(
    current_setting('test.phase8c_project')::uuid,
    '8c666666-6666-6666-6666-666666666666'::uuid,
    'assign_pm_8c_01'
  )->>'status'),
  'awaiting_project_manager_acceptance',
  'SA assigns primary PM'
);

-- ----------------------------------------------------------------------------
-- FLOW 1: design_completed before accept does not create execution
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'No execution row after materialize+PM assign before accept'
);

insert into public.project_design_workflows (project_id, state, started_by)
values (
  current_setting('test.phase8c_project')::uuid,
  'brief_received',
  '8c111111-1111-1111-1111-111111111111'
);

select lives_ok(
  $$update public.project_design_workflows
    set state = 'design_completed', completed_at = now(), updated_at = now()
    where project_id = current_setting('test.phase8c_project')::uuid$$,
  'Design completed update before handover does not raise'
);

select is(
  (select state from public.project_design_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  'design_completed',
  'Design stays design_completed after pre-accept update'
);

select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'No execution row when design completes before handover accept'
);

select set_config('request.jwt.claim.sub', '8c666666-6666-6666-6666-666666666666', true);
select set_config('role', 'authenticated', true);
select is(
  (public.accept_project_handover(
    current_setting('test.phase8c_project')::uuid,
    'accept_pm_8c_01'
  )->>'status'),
  'handover_accepted',
  'Current PM accepts handover'
);

select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select is(
  (public.repair_project_execution_workflow(
    current_setting('test.phase8c_project')::uuid,
    'repair_sa_8c_01'
  )->>'state'),
  'production',
  'SA repair_project_execution_workflow creates production'
);

select is(
  (public.repair_project_execution_workflow(
    current_setting('test.phase8c_project')::uuid,
    'repair_sa_8c_01'
  )->>'state'),
  'production',
  'SA repair same key is idempotent'
);

select set_config('request.jwt.claim.sub', '8c222222-2222-2222-2222-222222222222', true);
select is(
  (public.repair_project_execution_workflow(
    current_setting('test.phase8c_project')::uuid,
    'repair_sm_8c_01'
  )->>'unchanged'),
  'true',
  'SM can repair replay when production already exists'
);

select set_config('request.jwt.claim.sub', '8c666666-6666-6666-6666-666666666666', true);
select throws_ok(
  $$select public.repair_project_execution_workflow(
    current_setting('test.phase8c_project')::uuid,
    'repair_pm_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'PM cannot repair execution workflow'
);

select set_config('request.jwt.claim.sub', '8c333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.repair_project_execution_workflow(
    current_setting('test.phase8c_project')::uuid,
    'repair_se_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'SE cannot repair execution workflow'
);

select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  1,
  'Exactly one execution workflow after repair'
);
select is(
  (select state from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  'production',
  'Execution state is production after repair'
);

-- ----------------------------------------------------------------------------
-- FLOW 2: assign lead; production_ready must not create a second execution
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select is(
  (public.set_project_lead_designer(
    current_setting('test.phase8c_project')::uuid,
    '8c555555-5555-5555-5555-555555555555'::uuid,
    'set_lead_8c_01'
  )->>'assignment_role'),
  'lead_designer',
  'SA assigns lead designer after accept'
);
select is(
  (public.add_project_supporting_designer(
    current_setting('test.phase8c_project')::uuid,
    '8c121212-1212-1212-1212-121212121212'::uuid,
    'set_supporting_8c_01'
  )->>'assignment_role'),
  'supporting_designer',
  'SA assigns supporting designer after accept'
);

savepoint production_ready_update;
select set_config('role', 'postgres', true);
update public.project_design_workflows
set state = 'production_ready', completed_at = null, updated_at = now()
where project_id = current_setting('test.phase8c_project')::uuid;

select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  1,
  'Production Ready update does not create a second execution row'
);
select is(
  (select state from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  'production',
  'Production Ready update does not change execution state'
);
rollback to savepoint production_ready_update;

select set_config('request.jwt.claim.sub', '8c555555-5555-5555-5555-555555555555', true);
select set_config('role', 'authenticated', true);
select is(
  (public.complete_project_design(
    current_setting('test.phase8c_project')::uuid,
    'complete_design_8c_01'
  )->>'state'),
  'design_completed',
  'Lead complete_project_design is idempotent when already design_completed'
);

select set_config('role', 'postgres', true);
select is(
  (select state from public.project_design_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  'design_completed',
  'Design remains design_completed after idempotent complete'
);

-- ----------------------------------------------------------------------------
-- FLOW 4-5: unauthorized transition; evidenced adjacent path
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_sa_denied',
    'offline_note',
    'offline-sa-01',
    'Dispatch pack confirmed'
  )$$,
  '42501',
  'FORBIDDEN',
  'SA cannot transition execution'
);

select set_config('request.jwt.claim.sub', '8c222222-2222-2222-2222-222222222222', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_sm_denied',
    'offline_note',
    'offline-sm-01',
    'Dispatch pack confirmed'
  )$$,
  '42501',
  'FORBIDDEN',
  'SM cannot transition execution'
);

select set_config('request.jwt.claim.sub', '8c555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_des_denied',
    'offline_note',
    'offline-des-01',
    'Dispatch pack confirmed'
  )$$,
  '42501',
  'FORBIDDEN',
  'Designer cannot transition execution'
);

select set_config('request.jwt.claim.sub', '8c333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_se_denied',
    'offline_note',
    'offline-se-01',
    'Dispatch pack confirmed'
  )$$,
  '42501',
  'FORBIDDEN',
  'SE cannot transition execution'
);

select set_config('request.jwt.claim.sub', '8c777777-7777-7777-7777-777777777777', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_pm2_denied',
    'offline_note',
    'offline-pm2-01',
    'Dispatch pack confirmed'
  )$$,
  '42501',
  'FORBIDDEN',
  'Other PM cannot transition execution'
);

select set_config('request.jwt.claim.sub', '8c666666-6666-6666-6666-666666666666', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_rfd_missing'
  )$$,
  'PROJECT_MISSING_EVIDENCE',
  'production to ready_for_dispatch without evidence is rejected'
);

select is(
  (public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_rfd_8c_01',
    'offline_note',
    'offline-rfd-01',
    'Dispatch pack confirmed'
  )->>'state'),
  'ready_for_dispatch',
  'PM transitions production to ready_for_dispatch with offline note'
);

select set_config('role', 'postgres', true);
select set_config(
  'test.phase8c_event_count_rfd',
  (
    select count(*)::text from public.project_events
    where project_id = current_setting('test.phase8c_project')::uuid
      and event_type = 'project.execution_changed'
  ),
  true
);

select set_config('request.jwt.claim.sub', '8c666666-6666-6666-6666-666666666666', true);
select set_config('role', 'authenticated', true);
select is(
  (public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'ready_for_dispatch',
    'trans_rfd_8c_01',
    'offline_note',
    'offline-rfd-01',
    'Dispatch pack confirmed'
  )->>'state'),
  'ready_for_dispatch',
  'Replay of the same transition key returns durable result'
);

select set_config('role', 'postgres', true);
select is(
  (
    select count(*)::integer from public.project_events
    where project_id = current_setting('test.phase8c_project')::uuid
      and event_type = 'project.execution_changed'
  ),
  current_setting('test.phase8c_event_count_rfd')::integer,
  'Transition replay inserts no extra events'
);

select throws_ok(
  $$update public.project_execution_evidence
    set note = 'tamper'
    where project_id = current_setting('test.phase8c_project')::uuid$$,
  '55000',
  null,
  'execution evidence UPDATE is blocked'
);
select throws_ok(
  $$delete from public.project_execution_evidence
    where project_id = current_setting('test.phase8c_project')::uuid$$,
  '55000',
  null,
  'execution evidence DELETE is blocked'
);

select set_config('request.jwt.claim.sub', '8c666666-6666-6666-6666-666666666666', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values (
      'project-execution-documents',
      'projects/' || current_setting('test.phase8c_project') || '/execution/evidence/unauthorized.pdf',
      '8c666666-6666-6666-6666-666666666666',
      '8c666666-6666-6666-6666-666666666666',
      '{}'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'authenticated cannot directly insert project-execution-documents storage objects'
);

-- RLS: other PM / designer / SE cannot select detailed tables
select set_config('request.jwt.claim.sub', '8c777777-7777-7777-7777-777777777777', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'Other PM cannot select execution workflows'
);

select set_config('request.jwt.claim.sub', '8c555555-5555-5555-5555-555555555555', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'Designer cannot select execution workflows'
);
select is(
  (select count(*)::integer from public.project_execution_snags
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'Designer cannot select execution snags'
);
select is(
  (select count(*)::integer from public.project_execution_evidence
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'Designer cannot select execution evidence'
);

select set_config('request.jwt.claim.sub', '8c333333-3333-3333-3333-333333333333', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'SE cannot select execution workflows'
);
select is(
  (select count(*)::integer from public.project_execution_evidence
    where project_id = current_setting('test.phase8c_project')::uuid),
  0,
  'SE cannot select execution evidence'
);

select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  1,
  'SA can select execution workflows'
);
select set_config('request.jwt.claim.sub', '8c222222-2222-2222-2222-222222222222', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  1,
  'SM can select execution workflows'
);
select set_config('request.jwt.claim.sub', '8c666666-6666-6666-6666-666666666666', true);
select is(
  (select count(*)::integer from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  1,
  'Current PM can select execution workflows'
);

-- High-level status
select set_config('request.jwt.claim.sub', '8c555555-5555-5555-5555-555555555555', true);
select is(
  (public.get_project_execution_high_level_status(
    current_setting('test.phase8c_project')::uuid
  )->>'execution_state'),
  'ready_for_dispatch',
  'Assigned lead can read high-level execution status'
);

select ok(
  not exists (
    select 1
    from jsonb_object_keys(
      public.get_project_execution_high_level_status(current_setting('test.phase8c_project')::uuid)
    ) k
    where k in ('evidence', 'snags', 'storage_object_path', 'note', 'evidence_id', 'paths')
  ),
  'High-level status has no evidence, snags, or storage paths'
);

select set_config('request.jwt.claim.sub', '8c121212-1212-1212-1212-121212121212', true);
select is(
  (public.get_project_execution_high_level_status(
    current_setting('test.phase8c_project')::uuid
  )->>'execution_state'),
  'ready_for_dispatch',
  'Assigned supporting designer can read high-level execution status'
);

select set_config('request.jwt.claim.sub', '8c999999-9999-9999-9999-999999999999', true);
select throws_ok(
  $$select public.get_project_execution_high_level_status(
    current_setting('test.phase8c_project')::uuid
  )$$,
  '42501',
  'FORBIDDEN',
  'Unassigned designer cannot read high-level execution status'
);

select set_config('request.jwt.claim.sub', '8c333333-3333-3333-3333-333333333333', true);
select is(
  (public.get_project_execution_high_level_status(
    current_setting('test.phase8c_project')::uuid
  )->>'execution_state'),
  'ready_for_dispatch',
  'Own credited SE can read high-level execution status'
);

select set_config('request.jwt.claim.sub', '8c444444-4444-4444-4444-444444444444', true);
select throws_ok(
  $$select public.get_project_execution_high_level_status(
    current_setting('test.phase8c_project')::uuid
  )$$,
  '42501',
  'FORBIDDEN',
  'SE2 cannot read high-level execution status'
);

-- ----------------------------------------------------------------------------
-- PM reassignment after ready_for_dispatch
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select is(
  (public.assign_project_manager(
    current_setting('test.phase8c_project')::uuid,
    '8c777777-7777-7777-7777-777777777777'::uuid,
    'assign_pm_8c_02'
  )->>'status'),
  'awaiting_project_manager_acceptance',
  'SA reassigns primary PM to PM2'
);

select set_config('role', 'postgres', true);
select is(
  (select state from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  'ready_for_dispatch',
  'Reassignment preserves execution state'
);

select set_config('request.jwt.claim.sub', '8c666666-6666-6666-6666-666666666666', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'delivery',
    'trans_old_pm_denied',
    'offline_note',
    'offline-old-01',
    'Delivery note recorded'
  )$$,
  '42501',
  'FORBIDDEN',
  'Former PM cannot transition after reassignment'
);

select set_config('request.jwt.claim.sub', '8c777777-7777-7777-7777-777777777777', true);
select throws_ok(
  $$select public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'delivery',
    'trans_new_pm_preaccept',
    'offline_note',
    'offline-new-01',
    'Delivery note recorded'
  )$$,
  '42501',
  'FORBIDDEN',
  'New PM cannot transition before handover accept'
);

select is(
  (public.accept_project_handover(
    current_setting('test.phase8c_project')::uuid,
    'accept_pm_8c_02'
  )->>'status'),
  'handover_accepted',
  'PM2 accepts handover after reassignment'
);

-- FLOW 6: hold/resume on main path; cancel-from-hold via savepoint
select throws_ok(
  $$select public.hold_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'site_access_blocked',
    'short',
    'hold_short_denied'
  )$$,
  'INVALID_REASON',
  'Hold reason shorter than 10 characters is rejected'
);

select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.hold_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'site_access_blocked',
    'Client site access delayed',
    'hold_sa_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'SA cannot hold execution'
);

select set_config('request.jwt.claim.sub', '8c777777-7777-7777-7777-777777777777', true);
savepoint cancel_from_hold;
select is(
  (public.hold_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'site_access_blocked',
    'Client site access delayed',
    'hold_cancel_8c_01'
  )->>'state'),
  'on_hold',
  'PM can hold from ready_for_dispatch before cancel probe'
);
select is(
  (public.cancel_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'Client cancelled the remaining site work',
    'cancel_from_hold_8c'
  )->>'state'),
  'cancelled',
  'PM can cancel execution from on_hold'
);
rollback to savepoint cancel_from_hold;

select is(
  (public.hold_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'site_access_blocked',
    'Client site access delayed',
    'hold_rfd_8c_01'
  )->>'held_from_state'),
  'ready_for_dispatch',
  'PM hold records exact held_from_state'
);

select is(
  (public.resume_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'resume_rfd_8c_01'
  )->>'state'),
  'ready_for_dispatch',
  'PM resume returns to exact held_from_state'
);

select is(
  (public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'delivery',
    'trans_del_8c_01',
    'offline_note',
    'offline-del-01',
    'Goods received at site'
  )->>'state'),
  'delivery',
  'PM transitions ready_for_dispatch to delivery with offline note'
);

select is(
  (public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'installation',
    'trans_ins_8c_01',
    'offline_note',
    'offline-ins-01',
    'Installation crew on site'
  )->>'state'),
  'installation',
  'PM transitions delivery to installation with offline note'
);

savepoint sa_sm_cancel_probe;
select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select is(
  (public.cancel_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'Owner cancelled remaining installation work',
    'cancel_sa_8c_01'
  )->>'state'),
  'cancelled',
  'SA can cancel execution'
);
rollback to savepoint sa_sm_cancel_probe;

savepoint sm_cancel_probe;
select set_config('request.jwt.claim.sub', '8c222222-2222-2222-2222-222222222222', true);
select is(
  (public.cancel_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'Manager cancelled remaining installation work',
    'cancel_sm_8c_01'
  )->>'state'),
  'cancelled',
  'SM can cancel execution'
);
rollback to savepoint sm_cancel_probe;

select set_config('request.jwt.claim.sub', '8c777777-7777-7777-7777-777777777777', true);

select is(
  (public.transition_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'snag_resolution',
    'trans_snag_8c_01'
  )->>'state'),
  'snag_resolution',
  'installation to snag_resolution without evidence succeeds'
);

-- Snag mutation denied for SA/SM/designer, then PM snag path
select set_config('request.jwt.claim.sub', '8c111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.create_project_execution_snag(
    current_setting('test.phase8c_project')::uuid,
    'Paint touch-up',
    'Living room wall needs paint',
    'snag_sa_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'SA cannot create execution snags'
);

select set_config('request.jwt.claim.sub', '8c222222-2222-2222-2222-222222222222', true);
select throws_ok(
  $$select public.create_project_execution_snag(
    current_setting('test.phase8c_project')::uuid,
    'Paint touch-up',
    'Living room wall needs paint',
    'snag_sm_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'SM cannot create execution snags'
);

select set_config('request.jwt.claim.sub', '8c555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.create_project_execution_snag(
    current_setting('test.phase8c_project')::uuid,
    'Paint touch-up',
    'Living room wall needs paint',
    'snag_des_denied'
  )$$,
  '42501',
  'FORBIDDEN',
  'Designer cannot create execution snags'
);

select set_config('request.jwt.claim.sub', '8c777777-7777-7777-7777-777777777777', true);
select set_config(
  'test.phase8c_snag',
  (public.create_project_execution_snag(
    current_setting('test.phase8c_project')::uuid,
    'Paint touch-up',
    'Living room wall needs paint',
    'snag_create_8c_01'
  )->>'snag_id'),
  true
);

select is(
  (public.start_project_execution_snag(
    current_setting('test.phase8c_snag')::uuid,
    'snag_start_8c_01'
  )->>'status'),
  'in_progress',
  'PM starts open snag'
);

select throws_ok(
  $$select public.record_project_execution_handover(
    current_setting('test.phase8c_project')::uuid,
    'handover_blocked_8c',
    'offline_note',
    'offline-handover-blocked',
    'Client signed handover note'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Handover is blocked while a snag is open or in progress'
);

select is(
  (public.resolve_project_execution_snag(
    current_setting('test.phase8c_snag')::uuid,
    'snag_resolve_8c_01',
    'offline_note',
    'offline-snag-01',
    'Paint touch-up completed'
  )->>'status'),
  'resolved',
  'PM resolves snag with offline note evidence'
);

select is(
  (public.record_project_execution_handover(
    current_setting('test.phase8c_project')::uuid,
    'handover_8c_01',
    'offline_note',
    'offline-handover-01',
    'Client signed handover note'
  )->>'state'),
  'handover',
  'PM records handover with offline note after snags resolved'
);

select is(
  (public.hold_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'client_decision_pending',
    'Client asked to pause handover',
    'hold_handover_8c_01'
  )->>'held_from_state'),
  'handover',
  'PM can hold from handover'
);

select is(
  (public.resume_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'resume_handover_8c_01'
  )->>'state'),
  'handover',
  'PM resume from handover hold returns to handover'
);

select is(
  (public.complete_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'complete_8c_01',
    'offline_note',
    'offline-complete-01',
    'Completion acknowledgement noted'
  )->>'state'),
  'completed',
  'PM completes execution with a separate offline note'
);

select throws_ok(
  $$select public.cancel_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'Trying to cancel a completed job',
    'cancel_completed_8c'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Cancel of completed execution is denied'
);

select throws_ok(
  $$select public.hold_project_execution(
    current_setting('test.phase8c_project')::uuid,
    'other',
    'Trying to hold a completed job',
    'hold_completed_8c'
  )$$,
  'PROJECT_INVALID_TRANSITION',
  'Hold of completed execution is denied'
);

select set_config('role', 'postgres', true);
select throws_ok(
  $$update public.project_execution_snags
    set status = 'open', resolved_by = null, resolved_at = null
    where id = current_setting('test.phase8c_snag')::uuid$$,
  'PROJECT_SNAG_IMMUTABLE',
  'Resolved snag cannot be reopened'
);

select is(
  (select state from public.project_execution_workflows
    where project_id = current_setting('test.phase8c_project')::uuid),
  'completed',
  'Execution remains completed after denied reopen attempts'
);

select finish();
rollback;
