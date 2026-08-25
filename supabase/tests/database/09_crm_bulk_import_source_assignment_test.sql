-- ONEDECORE Phase 5D CRM bulk import + source-based assignment pgTAP tests

begin;
select plan(84);

-- =============================================================================
-- Synthetic staff users (unique to this file — d-prefix)
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('d1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '5d-sa@example.test', 'authenticated', 'authenticated'),
  ('d2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '5d-mgr@example.test', 'authenticated', 'authenticated'),
  ('d3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '5d-execa@example.test', 'authenticated', 'authenticated'),
  ('d4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '5d-execb@example.test', 'authenticated', 'authenticated'),
  ('d5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', '5d-pm@example.test', 'authenticated', 'authenticated'),
  ('d6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', '5d-designer@example.test', 'authenticated', 'authenticated'),
  ('d7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', '5d-mgmt@example.test', 'authenticated', 'authenticated'),
  ('d8888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', '5d-sales@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'd1111111-1111-1111-1111-111111111111',
  'd2222222-2222-2222-2222-222222222222',
  'd3333333-3333-3333-3333-333333333333',
  'd4444444-4444-4444-4444-444444444444',
  'd5555555-5555-5555-5555-555555555555',
  'd6666666-6666-6666-6666-666666666666',
  'd7777777-7777-7777-7777-777777777777',
  'd8888888-8888-8888-8888-888888888888'
);

insert into public.user_roles (user_id, role_id)
select 'd1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'd2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'd3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'd4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'd5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';
insert into public.user_roles (user_id, role_id)
select 'd6666666-6666-6666-6666-666666666666', id from public.roles where code = 'designer';
insert into public.user_roles (user_id, role_id)
select 'd7777777-7777-7777-7777-777777777777', id from public.roles where code = 'management';
insert into public.user_roles (user_id, role_id)
select 'd8888888-8888-8888-8888-888888888888', id from public.roles where code = 'sales';

select set_config(
  'test.phase5d_phone_call_source',
  (select id::text from public.lead_sources where code = 'phone_call' limit 1),
  true
);
select set_config('test.phase5d_pre_consent_count', (select count(*)::text from public.consent_events), true);
select set_config('test.phase5d_file_sha', repeat('a', 64), true);

-- =============================================================================
-- RBAC: leads.bulk_import
-- =============================================================================

set local role authenticated;

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import'))$$,
  array[true],
  'super_admin has leads.bulk_import'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import'))$$,
  array[true],
  'sales_manager has leads.bulk_import'
);

select set_config('request.jwt.claim.sub', 'd7777777-7777-7777-7777-777777777777', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import'))$$,
  array[true],
  'legacy management has leads.bulk_import'
);

select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import'))$$,
  array[false],
  'sales_executive denied leads.bulk_import'
);

select set_config('request.jwt.claim.sub', 'd8888888-8888-8888-8888-888888888888', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import'))$$,
  array[false],
  'legacy sales denied leads.bulk_import'
);

select set_config('request.jwt.claim.sub', 'd5555555-5555-5555-5555-555555555555', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import'))$$,
  array[false],
  'project_manager denied leads.bulk_import'
);

select set_config('request.jwt.claim.sub', 'd6666666-6666-6666-6666-666666666666', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import'))$$,
  array[false],
  'designer denied leads.bulk_import'
);

-- =============================================================================
-- RBAC: leads.bulk_import_approve
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import_approve'))$$,
  array[true],
  'super_admin has leads.bulk_import_approve'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import_approve'))$$,
  array[false],
  'sales_manager denied leads.bulk_import_approve'
);

select set_config('request.jwt.claim.sub', 'd7777777-7777-7777-7777-777777777777', true);
select results_eq(
  $$select (select private.has_permission('leads.bulk_import_approve'))$$,
  array[false],
  'legacy management denied leads.bulk_import_approve'
);

-- =============================================================================
-- RBAC: leads.assignment_rules.manage
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select (select private.has_permission('leads.assignment_rules.manage'))$$,
  array[true],
  'super_admin has leads.assignment_rules.manage'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select private.has_permission('leads.assignment_rules.manage'))$$,
  array[false],
  'sales_manager denied leads.assignment_rules.manage'
);

select set_config('request.jwt.claim.sub', 'd7777777-7777-7777-7777-777777777777', true);
select results_eq(
  $$select (select private.has_permission('leads.assignment_rules.manage'))$$,
  array[false],
  'legacy management denied leads.assignment_rules.manage'
);

-- =============================================================================
-- RPC exposure
-- =============================================================================

reset role;

select results_eq(
  $$select has_function_privilege('authenticated', 'public.create_lead_import_batch(uuid,text,text,text,bigint,text,text,uuid)', 'execute')$$,
  array[true],
  'authenticated can execute create_lead_import_batch'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.replace_lead_import_mapping(uuid,jsonb,uuid)', 'execute')$$,
  array[true],
  'authenticated can execute replace_lead_import_mapping'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.replace_lead_import_rows(uuid,jsonb)', 'execute')$$,
  array[true],
  'authenticated can execute replace_lead_import_rows'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.validate_lead_import_batch(uuid)', 'execute')$$,
  array[true],
  'authenticated can execute validate_lead_import_batch'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.submit_lead_import_batch(uuid,integer)', 'execute')$$,
  array[true],
  'authenticated can execute submit_lead_import_batch'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.approve_lead_import_batch(uuid,integer)', 'execute')$$,
  array[true],
  'authenticated can execute approve_lead_import_batch'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.process_lead_import_batch(uuid,integer,integer)', 'execute')$$,
  array[true],
  'authenticated can execute process_lead_import_batch'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.create_lead_assignment_rule(uuid,uuid,integer,text,text,text)', 'execute')$$,
  array[true],
  'authenticated can execute create_lead_assignment_rule'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.reject_lead_import_batch(uuid,integer,text)', 'execute')$$,
  array[true],
  'authenticated can execute reject_lead_import_batch'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.confirm_lead_import_batch_direct(uuid,integer)', 'execute')$$,
  array[true],
  'authenticated can execute confirm_lead_import_batch_direct'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.cancel_lead_import_batch(uuid)', 'execute')$$,
  array[true],
  'authenticated can execute cancel_lead_import_batch'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.set_lead_assignment_rule_active(uuid,boolean)', 'execute')$$,
  array[true],
  'authenticated can execute set_lead_assignment_rule_active'
);

-- =============================================================================
-- Batch create + idempotency
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5d_mgr_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0001-4000-8000-000000000001'::uuid,
    '5d-import.csv',
    current_setting('test.phase5d_file_sha'),
    'csv',
    1024,
    null,
    'fp-5d-mgr',
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select status::text, created_by::text, file_type::text
    from public.lead_import_batches where id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  $$values ('draft'::text, 'd2222222-2222-2222-2222-222222222222'::text, 'csv'::text)$$,
  'manager creates csv import batch in draft'
);

select results_eq(
  $$select id::text from public.create_lead_import_batch(
    'd2222222-0001-4000-8000-000000000001'::uuid,
    '5d-import.csv',
    current_setting('test.phase5d_file_sha'),
    'csv',
    1024,
    null,
    'fp-5d-mgr',
    current_setting('test.phase5d_phone_call_source')::uuid
  )$$,
  array[current_setting('test.phase5d_mgr_batch')],
  'duplicate client_request_id returns same batch idempotently'
);

select throws_ok(
  $$select public.create_lead_import_batch(
    'd2222222-0002-4000-8000-000000000002'::uuid,
    'bad.csv',
    'not-a-sha256',
    'csv',
    1024
  )$$,
  '22023',
  'CRM_IMPORT_INVALID_FILE_SHA256',
  'invalid file sha256 rejected'
);

select throws_ok(
  $$select public.create_lead_import_batch(
    'd2222222-0003-4000-8000-000000000003'::uuid,
    'book.xlsx',
    current_setting('test.phase5d_file_sha'),
    'xlsx',
    2048
  )$$,
  '22023',
  'CRM_IMPORT_WORKSHEET_REQUIRED',
  'xlsx batch requires worksheet name'
);

select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$select public.create_lead_import_batch(
    'd3333333-0001-4000-8000-000000000001'::uuid,
    'exec.csv',
    current_setting('test.phase5d_file_sha'),
    'csv',
    512
  )$$,
  '42501',
  'CRM_IMPORT_PERMISSION_DENIED',
  'sales executive denied batch create'
);

-- =============================================================================
-- Mapping + rows staging
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select lives_ok(
  $$select public.replace_lead_import_mapping(
    current_setting('test.phase5d_mgr_batch')::uuid,
    '{"Name":"submitted_name","Mobile":"phone","Service":"service_code"}'::jsonb,
    current_setting('test.phase5d_phone_call_source')::uuid
  )$$,
  'valid column mapping accepted'
);

select throws_ok(
  $$select public.replace_lead_import_mapping(
    current_setting('test.phase5d_mgr_batch')::uuid,
    '{"Bad":"not_a_field"}'::jsonb
  )$$,
  '22023',
  'CRM_IMPORT_INVALID_MAPPING_FIELD',
  'unknown mapping target field rejected'
);

select throws_ok(
  $$select public.replace_lead_import_mapping(
    current_setting('test.phase5d_mgr_batch')::uuid,
    '[]'::jsonb
  )$$,
  '22023',
  'CRM_IMPORT_INVALID_MAPPING',
  'non-object mapping rejected'
);

select lives_ok(
  $$select public.replace_lead_import_rows(
    current_setting('test.phase5d_mgr_batch')::uuid,
    '[{"row_number":1,"submitted_name":"5D Import Row","phone":"+919500050001","email":null,"service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Koramangala","budget_comfort_code":"6-12l","room_codes":["living"],"message":null,"source_detail":null}]'::jsonb
  )$$,
  'replace staged rows succeeds'
);

select throws_ok(
  $$select public.replace_lead_import_rows(
    current_setting('test.phase5d_mgr_batch')::uuid,
    '[]'::jsonb
  )$$,
  '22023',
  'CRM_IMPORT_ROW_COUNT_OUT_OF_BOUNDS',
  'empty row payload rejected'
);

-- =============================================================================
-- Validate batch + row outcomes
-- =============================================================================

select set_config(
  'test.phase5d_validated_batch',
  (select id::text from public.validate_lead_import_batch(current_setting('test.phase5d_mgr_batch')::uuid)),
  true
);

select results_eq(
  $$select status::text, total_rows, valid_rows, invalid_rows, importable_rows
    from public.lead_import_batches where id = current_setting('test.phase5d_validated_batch')::uuid$$,
  $$values ('ready_for_review'::text, 1, 1, 0, 1)$$,
  'valid staged row yields ready_for_review with importable count'
);

select results_eq(
  $$select validation_status::text, duplicate_outcome::text, import_status::text, assignment_resolution_code::text
    from public.lead_import_rows where batch_id = current_setting('test.phase5d_validated_batch')::uuid$$,
  $$values ('valid'::text, 'CLEAR'::text, 'ready'::text, 'NO_MATCH_UNASSIGNED'::text)$$,
  'clear duplicate row is import-ready with NO_MATCH when no assignment rule exists'
);

-- invalid row batch
select set_config(
  'test.phase5d_invalid_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0004-4000-8000-000000000004'::uuid,
    'invalid.csv',
    repeat('b', 64),
    'csv',
    800,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_invalid_batch')::uuid,
  '[{"row_number":1,"submitted_name":"X","phone":null,"email":null,"service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_invalid_batch')::uuid);

select results_eq(
  $$select status::text, invalid_rows from public.lead_import_batches where id = current_setting('test.phase5d_invalid_batch')::uuid$$,
  $$values ('validation_failed'::text, 1)$$,
  'missing contact yields validation_failed batch'
);

select results_eq(
  $$select validation_status::text from public.lead_import_rows where batch_id = current_setting('test.phase5d_invalid_batch')::uuid$$,
  array['invalid'::text],
  'row without phone or email marked invalid'
);

-- =============================================================================
-- Assignment rules + resolver (via validate)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select set_config(
  'test.phase5d_rule_generic',
  (select id::text from public.create_lead_assignment_rule(
    current_setting('test.phase5d_phone_call_source')::uuid,
    'd3333333-3333-3333-3333-333333333333'::uuid,
    10
  )),
  true
);

select set_config(
  'test.phase5d_rule_specific',
  (select id::text from public.create_lead_assignment_rule(
    current_setting('test.phase5d_phone_call_source')::uuid,
    'd4444444-4444-4444-4444-444444444444'::uuid,
    5,
    'complete-home-interiors',
    'koramangala',
    '6-12l'
  )),
  true
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_validated_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D Assigned Row","phone":"+919500050002","email":null,"service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Koramangala","budget_comfort_code":"6-12l","room_codes":["living"]}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_validated_batch')::uuid);

select results_eq(
  $$select assignment_resolution_code::text, resolved_assignee_id::text
    from public.lead_import_rows where batch_id = current_setting('test.phase5d_validated_batch')::uuid$$,
  $$values ('RULE_MATCH'::text, 'd4444444-4444-4444-4444-444444444444'::text)$$,
  'specific locality+service rule wins over generic source rule'
);

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select throws_ok(
  $$select public.create_lead_assignment_rule(
    current_setting('test.phase5d_phone_call_source')::uuid,
    'd5555555-5555-5555-5555-555555555555'::uuid,
    3
  )$$,
  '22023',
  'CRM_ASSIGNMENT_RULE_INVALID_TARGET',
  'project manager rejected as assignment rule target'
);

-- NO_MATCH batch
select set_config(
  'test.phase5d_nomatch_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0005-4000-8000-000000000005'::uuid,
    'nomatch.csv',
    repeat('c', 64),
    'csv',
    600,
    null,
    null,
    (select id from public.lead_sources where code = 'walk_in' limit 1)
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_nomatch_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D No Rule","phone":"+919500050003","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_nomatch_batch')::uuid);

select results_eq(
  $$select assignment_resolution_code::text, resolved_assignee_id is null
    from public.lead_import_rows where batch_id = current_setting('test.phase5d_nomatch_batch')::uuid$$,
  $$values ('NO_MATCH_UNASSIGNED'::text, true)$$,
  'source without matching rule yields NO_MATCH_UNASSIGNED'
);

select throws_ok(
  $$select public.process_lead_import_batch(
    current_setting('test.phase5d_nomatch_batch')::uuid,
    1,
    10
  )$$,
  '22023',
  'CRM_IMPORT_STALE_REVISION',
  'process rejects stale validation revision'
);

-- =============================================================================
-- Duplicate evaluation — bulk import never grants override
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5d_active_seed',
  (select id::text from public.create_manual_lead(
    '5D Active Dup Seed',
    '+919500050010',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5d_phone_call_source')::uuid,
    'Indiranagar',
    null, '{}'::text[], null, null,
    'd3333333-3333-3333-3333-333333333333'::uuid
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5d_active_seed')::uuid,
  'contacted',
  null,
  null
);

select set_config(
  'test.phase5d_dup_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0006-4000-8000-000000000006'::uuid,
    'dup.csv',
    repeat('d', 64),
    'csv',
    700,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_dup_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D Active Dup","phone":"+919500050010","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Indiranagar"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_dup_batch')::uuid);

select results_eq(
  $$select duplicate_outcome::text, import_status::text
    from public.lead_import_rows where batch_id = current_setting('test.phase5d_dup_batch')::uuid$$,
  $$values ('ACTIVE_DUPLICATE'::text, 'skipped'::text)$$,
  'active duplicate row skipped at validation without override path'
);

select results_eq(
  $$select duplicate_blocked_rows from public.lead_import_batches where id = current_setting('test.phase5d_dup_batch')::uuid$$,
  array[1],
  'duplicate_blocked_rows counter incremented'
);

-- RECENT_SIMILAR — can_override false via row validation only (no bulk override RPC)
select set_config(
  'test.phase5d_recent_seed',
  (select id::text from public.create_manual_lead(
    '5D Recent Similar',
    '+919500050011',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5d_phone_call_source')::uuid,
    'Whitefield'
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5d_recent_seed')::uuid,
  'closed_lost',
  'Closed for bulk import recent similar test',
  'price'
);

select set_config(
  'test.phase5d_recent_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0007-4000-8000-000000000007'::uuid,
    'recent.csv',
    repeat('e', 64),
    'csv',
    700,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_recent_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D Recent Dup","phone":"+919500050011","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Whitefield"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_recent_batch')::uuid);

select results_eq(
  $$select duplicate_outcome::text, import_status::text
    from public.lead_import_rows where batch_id = current_setting('test.phase5d_recent_batch')::uuid$$,
  $$values ('RECENT_SIMILAR'::text, 'skipped'::text)$$,
  'recent similar duplicate skipped without manager override in bulk import'
);

-- =============================================================================
-- Batch state machine — submit / approve / reject
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5d_submit_rev',
  (select validation_revision::text from public.lead_import_batches where id = current_setting('test.phase5d_validated_batch')::uuid),
  true
);

select set_config(
  'test.phase5d_submitted_batch',
  (select id::text from public.submit_lead_import_batch(
    current_setting('test.phase5d_validated_batch')::uuid,
    current_setting('test.phase5d_submit_rev')::integer
  )),
  true
);

select results_eq(
  $$select status::text, submitted_at is not null from public.lead_import_batches where id = current_setting('test.phase5d_submitted_batch')::uuid$$,
  $$values ('pending_super_admin_approval'::text, true)$$,
  'manager submit moves batch to pending_super_admin_approval'
);

select throws_ok(
  $$select public.submit_lead_import_batch(
    current_setting('test.phase5d_submitted_batch')::uuid,
    current_setting('test.phase5d_submit_rev')::integer
  )$$,
  '22023',
  'CRM_IMPORT_BATCH_NOT_SUBMITTABLE',
  'cannot resubmit pending batch'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.approve_lead_import_batch(
    current_setting('test.phase5d_submitted_batch')::uuid,
    current_setting('test.phase5d_submit_rev')::integer
  )$$,
  '42501',
  'CRM_IMPORT_APPROVE_DENIED',
  'manager cannot approve import batch'
);

-- SA self-approve guard (creator cannot approve own submission)
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select set_config(
  'test.phase5d_sa_self_batch',
  (select id::text from public.create_lead_import_batch(
    'd1111111-0002-4000-8000-000000000002'::uuid,
    'sa-self.csv',
    repeat('2', 64),
    'csv',
    350,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_sa_self_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D SA Self","phone":"+919500050040","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Koramangala","budget_comfort_code":"6-12l"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_sa_self_batch')::uuid);

select set_config(
  'test.phase5d_sa_self_rev',
  (select validation_revision::text from public.lead_import_batches where id = current_setting('test.phase5d_sa_self_batch')::uuid),
  true
);

select public.submit_lead_import_batch(
  current_setting('test.phase5d_sa_self_batch')::uuid,
  current_setting('test.phase5d_sa_self_rev')::integer
);

select throws_ok(
  $$select public.approve_lead_import_batch(
    current_setting('test.phase5d_sa_self_batch')::uuid,
    current_setting('test.phase5d_sa_self_rev')::integer
  )$$,
  '42501',
  'CRM_IMPORT_APPROVER_CANNOT_BE_CREATOR',
  'batch creator cannot approve own submission'
);

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select set_config(
  'test.phase5d_approved_batch',
  (select id::text from public.approve_lead_import_batch(
    current_setting('test.phase5d_submitted_batch')::uuid,
    current_setting('test.phase5d_submit_rev')::integer
  )),
  true
);

select results_eq(
  $$select status::text, approval_kind::text, approved_by::text
    from public.lead_import_batches where id = current_setting('test.phase5d_approved_batch')::uuid$$,
  $$values ('approved'::text, 'manager_submission'::text, 'd1111111-1111-1111-1111-111111111111'::text)$$,
  'super admin approves manager batch with manager_submission kind'
);

-- reject path on separate batch
select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5d_reject_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0008-4000-8000-000000000008'::uuid,
    'reject.csv',
    repeat('f', 64),
    'csv',
    500,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_reject_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D Reject Row","phone":"+919500050020","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Koramangala","budget_comfort_code":"6-12l"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_reject_batch')::uuid);

select set_config(
  'test.phase5d_reject_rev',
  (select validation_revision::text from public.lead_import_batches where id = current_setting('test.phase5d_reject_batch')::uuid),
  true
);

select public.submit_lead_import_batch(
  current_setting('test.phase5d_reject_batch')::uuid,
  current_setting('test.phase5d_reject_rev')::integer
);

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select throws_ok(
  $$select public.reject_lead_import_batch(
    current_setting('test.phase5d_reject_batch')::uuid,
    current_setting('test.phase5d_reject_rev')::integer,
    'too short'
  )$$,
  '22023',
  'CRM_IMPORT_REJECTION_REASON_INVALID',
  'rejection reason shorter than ten characters rejected'
);

select public.reject_lead_import_batch(
  current_setting('test.phase5d_reject_batch')::uuid,
  current_setting('test.phase5d_reject_rev')::integer,
  'Rejected by super admin for test coverage'
);

select results_eq(
  $$select status::text from public.lead_import_batches where id = current_setting('test.phase5d_reject_batch')::uuid$$,
  array['rejected'::text],
  'super admin reject moves batch to rejected terminal state'
);

-- =============================================================================
-- SA direct confirm path
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select set_config(
  'test.phase5d_direct_batch',
  (select id::text from public.create_lead_import_batch(
    'd1111111-0001-4000-8000-000000000001'::uuid,
    'direct.csv',
    repeat('1', 64),
    'csv',
    400,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_direct_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D Direct Import","phone":"+919500050030","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Koramangala","budget_comfort_code":"6-12l"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_direct_batch')::uuid);

select set_config(
  'test.phase5d_direct_rev',
  (select validation_revision::text from public.lead_import_batches where id = current_setting('test.phase5d_direct_batch')::uuid),
  true
);

select public.confirm_lead_import_batch_direct(
  current_setting('test.phase5d_direct_batch')::uuid,
  current_setting('test.phase5d_direct_rev')::integer
);

select results_eq(
  $$select status::text, approval_kind::text from public.lead_import_batches where id = current_setting('test.phase5d_direct_batch')::uuid$$,
  $$values ('approved'::text, 'direct_import'::text)$$,
  'super admin direct confirm approves without manager submission'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.confirm_lead_import_batch_direct(
    current_setting('test.phase5d_direct_batch')::uuid,
    current_setting('test.phase5d_direct_rev')::integer
  )$$,
  '42501',
  'CRM_IMPORT_DIRECT_CONFIRM_SA_ONLY',
  'manager cannot direct-confirm import batch'
);

-- =============================================================================
-- Process import — lead metadata, assignment, consent isolation
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select set_config(
  'test.phase5d_process_result',
  (select public.process_lead_import_batch(
    current_setting('test.phase5d_approved_batch')::uuid,
    current_setting('test.phase5d_submit_rev')::integer,
    100
  )::text),
  true
);

select results_eq(
  $$select (current_setting('test.phase5d_process_result')::jsonb ->> 'batch_status')::text$$,
  array['completed'::text],
  'approved manager batch processes to completed'
);

select set_config(
  'test.phase5d_imported_lead',
  (select lead_id::text from public.lead_import_rows
    where batch_id = current_setting('test.phase5d_approved_batch')::uuid and import_status = 'imported'),
  true
);

select results_eq(
  $$select entry_method::text, source::text, status::text, assigned_to::text
    from public.leads where id = current_setting('test.phase5d_imported_lead')::uuid$$,
  $$values ('import'::text, 'bulk-import'::text, 'assigned'::text, 'd4444444-4444-4444-4444-444444444444'::text)$$,
  'imported lead uses entry_method import and source bulk-import with rule assignment'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where lead_id = current_setting('test.phase5d_imported_lead')::uuid
      and activity_type = 'lead.bulk_imported'$$,
  array[1],
  'import writes lead.bulk_imported activity'
);

select results_eq(
  $$select assignment_method::text from public.lead_assignment_history
    where lead_id = current_setting('test.phase5d_imported_lead')::uuid$$,
  array['source_rule'::text],
  'imported assigned lead records source_rule assignment history'
);

select results_eq(
  $$select count(*)::integer from public.consent_events$$,
  array[current_setting('test.phase5d_pre_consent_count')::integer],
  'bulk import writes zero consent_events'
);

-- process direct batch (unassigned — walk_in source, no rule on that batch's row uses phone_call rules only when source matches)
select public.process_lead_import_batch(
  current_setting('test.phase5d_direct_batch')::uuid,
  current_setting('test.phase5d_direct_rev')::integer,
  100
);

select set_config(
  'test.phase5d_direct_lead',
  (select lead_id::text from public.lead_import_rows
    where batch_id = current_setting('test.phase5d_direct_batch')::uuid),
  true
);

select results_eq(
  $$select entry_method::text, source::text, assigned_to is not null
    from public.leads where id = current_setting('test.phase5d_direct_lead')::uuid$$,
  $$values ('import'::text, 'bulk-import'::text, true)$$,
  'direct SA import assigns via matching source rule'
);

-- row idempotency — imported row retains stable lead_id (batch already completed)
select results_eq(
  $$select lead_id is not null from public.lead_import_rows
    where batch_id = current_setting('test.phase5d_approved_batch')::uuid limit 1$$,
  array[true],
  'imported row retains non-null lead_id after processing'
);

select results_eq(
  $$select count(*)::integer from public.leads l
    join public.lead_import_rows r on r.lead_id = l.id
    where r.batch_id = current_setting('test.phase5d_approved_batch')::uuid$$,
  array[1],
  'completed batch created exactly one lead per imported row'
);

-- =============================================================================
-- RLS visibility
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::integer from public.lead_import_batches where id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  array[1],
  'batch creator can select own batch under RLS'
);

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select results_eq(
  $$select count(*)::integer from public.lead_import_batches where id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  array[1],
  'super admin can select another users import batch'
);

select set_config('request.jwt.claim.sub', 'd7777777-7777-7777-7777-777777777777', true);

select results_eq(
  $$select count(*)::integer from public.lead_import_batches where id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  array[0],
  'unrelated management user cannot select another managers batch'
);

select set_config('request.jwt.claim.sub', 'd3333333-3333-3333-3333-333333333333', true);

select results_eq(
  $$select count(*)::integer from public.lead_import_batches where id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  array[0],
  'sales executive cannot select import batch'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::integer from public.lead_import_rows where batch_id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  array[1],
  'batch creator can select staged rows'
);

select cmp_ok(
  (select count(*) from public.lead_import_events where batch_id = current_setting('test.phase5d_mgr_batch')::uuid),
  '>',
  0::bigint,
  'batch creator can select import events'
);

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select cmp_ok(
  (select count(*) from public.lead_assignment_rules),
  '>',
  0::bigint,
  'super admin can select assignment rules'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select count(*)::integer from public.lead_assignment_rules$$,
  array[0],
  'sales manager cannot select assignment rules under RLS'
);

-- =============================================================================
-- Cancel + terminal state guards
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5d_cancel_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0009-4000-8000-000000000009'::uuid,
    'cancel.csv',
    repeat('9', 64),
    'csv',
    300,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.cancel_lead_import_batch(current_setting('test.phase5d_cancel_batch')::uuid);

select results_eq(
  $$select status::text from public.lead_import_batches where id = current_setting('test.phase5d_cancel_batch')::uuid$$,
  array['cancelled'::text],
  'creator can cancel draft batch'
);

select throws_ok(
  $$select public.cancel_lead_import_batch(current_setting('test.phase5d_approved_batch')::uuid)$$,
  '22023',
  'CRM_IMPORT_BATCH_NOT_CANCELLABLE',
  'cannot cancel already approved batch'
);

-- =============================================================================
-- Events append-only (postgres role — authenticated has select-only ACL)
-- =============================================================================

reset role;

select throws_ok(
  $$update public.lead_import_events set event_type = 'batch.created' where batch_id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  '55000',
  null,
  'lead_import_events rejects update'
);

select throws_ok(
  $$delete from public.lead_import_events where batch_id = current_setting('test.phase5d_mgr_batch')::uuid$$,
  '55000',
  null,
  'lead_import_events rejects delete'
);

set local role authenticated;

-- =============================================================================
-- Management create path + auth guard
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd7777777-7777-7777-7777-777777777777', true);

select lives_ok(
  $$select public.create_lead_import_batch(
    'd7777777-0001-4000-8000-000000000001'::uuid,
    'mgmt.csv',
    repeat('8', 64),
    'csv',
    450
  )$$,
  'legacy management may create import batch'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.create_lead_import_batch(
    '00000000-0000-4000-8000-000000009999'::uuid,
    'anon.csv',
    repeat('0', 64),
    'csv',
    100
  )$$,
  '42501',
  'CRM_IMPORT_AUTH_REQUIRED',
  'unauthenticated caller rejected for batch create'
);

set local role authenticated;

-- =============================================================================
-- Rule deactivate + REUSABLE_CONTACT import path
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select public.set_lead_assignment_rule_active(
  current_setting('test.phase5d_rule_generic')::uuid,
  false
);

select results_eq(
  $$select is_active from public.lead_assignment_rules where id = current_setting('test.phase5d_rule_generic')::uuid$$,
  array[false],
  'super admin can deactivate assignment rule'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5d_reusable_seed',
  (select id::text from public.create_manual_lead(
    '5D Reusable Import',
    '+919500050050',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5d_phone_call_source')::uuid,
    'Jayanagar'
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5d_reusable_seed')::uuid,
  'closed_lost',
  'Closed for reusable bulk import test',
  'timing'
);

reset role;
set local role postgres;
select set_config('onedecore.crm_transition', '1', true);
update public.leads
set created_at = now() - interval '31 days'
where id = current_setting('test.phase5d_reusable_seed')::uuid;
select set_config('onedecore.crm_transition', '0', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

select set_config(
  'test.phase5d_reusable_batch',
  (select id::text from public.create_lead_import_batch(
    'd1111111-0003-4000-8000-000000000003'::uuid,
    'reusable.csv',
    repeat('4', 64),
    'csv',
    500,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_reusable_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D Reusable Row","phone":"+919500050050","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month","locality":"Jayanagar"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_reusable_batch')::uuid);

select results_eq(
  $$select duplicate_outcome::text, import_status::text
    from public.lead_import_rows where batch_id = current_setting('test.phase5d_reusable_batch')::uuid$$,
  $$values ('REUSABLE_CONTACT'::text, 'ready'::text)$$,
  'aged closed contact yields REUSABLE_CONTACT import-ready row'
);

select set_config(
  'test.phase5d_reusable_rev',
  (select validation_revision::text from public.lead_import_batches where id = current_setting('test.phase5d_reusable_batch')::uuid),
  true
);

select public.confirm_lead_import_batch_direct(
  current_setting('test.phase5d_reusable_batch')::uuid,
  current_setting('test.phase5d_reusable_rev')::integer
);

select public.process_lead_import_batch(
  current_setting('test.phase5d_reusable_batch')::uuid,
  current_setting('test.phase5d_reusable_rev')::integer,
  50
);

select results_eq(
  $$select import_status::text from public.lead_import_rows where batch_id = current_setting('test.phase5d_reusable_batch')::uuid$$,
  array['imported'::text],
  'REUSABLE_CONTACT row imports successfully'
);

-- =============================================================================
-- Import audit events + lead.created metadata
-- =============================================================================

select results_eq(
  $$select count(*)::integer from public.lead_import_events
    where batch_id = current_setting('test.phase5d_mgr_batch')::uuid
      and event_type = 'batch.created'$$,
  array[1],
  'batch.created audit event recorded'
);

select results_eq(
  $$select (event_data ->> 'entryMethod')::text, (event_data ->> 'source')::text
    from public.lead_events
    where lead_id = current_setting('test.phase5d_imported_lead')::uuid
      and event_type = 'lead.created'
    limit 1$$,
  $$values ('import'::text, 'bulk-import'::text)$$,
  'lead.created event records import entry method and bulk-import source'
);

select results_eq(
  $$select (attribution ->> 'importBatchId') is not null
    from public.leads where id = current_setting('test.phase5d_imported_lead')::uuid$$,
  array[true],
  'imported lead attribution stores importBatchId'
);

-- =============================================================================
-- Mapping edit from ready_for_review rewinds to draft
-- =============================================================================

select set_config('request.jwt.claim.sub', 'd2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5d_edit_batch',
  (select id::text from public.create_lead_import_batch(
    'd2222222-0010-4000-8000-000000000010'::uuid,
    'edit.csv',
    repeat('6', 64),
    'csv',
    320,
    null,
    null,
    current_setting('test.phase5d_phone_call_source')::uuid
  )),
  true
);

select public.replace_lead_import_rows(
  current_setting('test.phase5d_edit_batch')::uuid,
  '[{"row_number":1,"submitted_name":"5D Edit Row","phone":"+919500050060","service_code":"complete-home-interiors","property_code":"apartment-2bhk","timeline_code":"within-1-month"}]'::jsonb
);

select public.validate_lead_import_batch(current_setting('test.phase5d_edit_batch')::uuid);

select set_config(
  'test.phase5d_edit_rev_before',
  (select validation_revision::text from public.lead_import_batches where id = current_setting('test.phase5d_edit_batch')::uuid),
  true
);

select public.replace_lead_import_mapping(
  current_setting('test.phase5d_edit_batch')::uuid,
  '{"Name":"submitted_name"}'::jsonb
);

select results_eq(
  $$select status::text, validation_revision > current_setting('test.phase5d_edit_rev_before')::integer
    from public.lead_import_batches where id = current_setting('test.phase5d_edit_batch')::uuid$$,
  $$values ('draft'::text, true)$$,
  'mapping edit from ready_for_review rewinds batch to draft and bumps revision'
);

select * from finish();
rollback;
