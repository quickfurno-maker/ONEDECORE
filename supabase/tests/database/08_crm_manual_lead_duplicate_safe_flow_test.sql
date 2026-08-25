-- ONEDECORE Phase 5C2B CRM manual lead duplicate-safe flow pgTAP tests

begin;
select plan(61);

-- =============================================================================
-- Synthetic staff users (unique to this file)
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '5c2b-sa@example.test', 'authenticated', 'authenticated'),
  ('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '5c2b-mgr@example.test', 'authenticated', 'authenticated'),
  ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '5c2b-execa@example.test', 'authenticated', 'authenticated'),
  ('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '5c2b-execb@example.test', 'authenticated', 'authenticated'),
  ('c5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', '5c2b-pm@example.test', 'authenticated', 'authenticated'),
  ('c6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', '5c2b-designer@example.test', 'authenticated', 'authenticated'),
  ('c7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', '5c2b-mgmt@example.test', 'authenticated', 'authenticated'),
  ('c8888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', '5c2b-sales@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'c1111111-1111-1111-1111-111111111111',
  'c2222222-2222-2222-2222-222222222222',
  'c3333333-3333-3333-3333-333333333333',
  'c4444444-4444-4444-4444-444444444444',
  'c5555555-5555-5555-5555-555555555555',
  'c6666666-6666-6666-6666-666666666666',
  'c7777777-7777-7777-7777-777777777777',
  'c8888888-8888-8888-8888-888888888888'
);

insert into public.user_roles (user_id, role_id)
select 'c1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'c2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'c3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'c4444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'c5555555-5555-5555-5555-555555555555', id from public.roles where code = 'project_manager';
insert into public.user_roles (user_id, role_id)
select 'c6666666-6666-6666-6666-666666666666', id from public.roles where code = 'designer';
insert into public.user_roles (user_id, role_id)
select 'c7777777-7777-7777-7777-777777777777', id from public.roles where code = 'management';
insert into public.user_roles (user_id, role_id)
select 'c8888888-8888-8888-8888-888888888888', id from public.roles where code = 'sales';

select set_config(
  'test.phase5c2b_phone_call_source',
  (select id::text from public.lead_sources where code = 'phone_call' limit 1),
  true
);
select set_config('test.phase5c2b_pre_consent_count', (select count(*)::text from public.consent_events), true);

-- =============================================================================
-- RBAC: leads.create
-- =============================================================================

set local role authenticated;

select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select (select private.has_permission('leads.create'))$$,
  array[true],
  'super_admin has leads.create'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select private.has_permission('leads.create'))$$,
  array[true],
  'sales_manager has leads.create'
);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select (select private.has_permission('leads.create'))$$,
  array[true],
  'sales_executive has leads.create'
);

select set_config('request.jwt.claim.sub', 'c7777777-7777-7777-7777-777777777777', true);
select results_eq(
  $$select (select private.has_permission('leads.create'))$$,
  array[true],
  'legacy management has leads.create'
);

select set_config('request.jwt.claim.sub', 'c8888888-8888-8888-8888-888888888888', true);
select results_eq(
  $$select (select private.has_permission('leads.create'))$$,
  array[true],
  'legacy sales has leads.create'
);

select set_config('request.jwt.claim.sub', 'c5555555-5555-5555-5555-555555555555', true);
select results_eq(
  $$select (select private.has_permission('leads.create'))$$,
  array[false],
  'project_manager denied leads.create'
);

select set_config('request.jwt.claim.sub', 'c6666666-6666-6666-6666-666666666666', true);
select results_eq(
  $$select (select private.has_permission('leads.create'))$$,
  array[false],
  'designer denied leads.create'
);

-- =============================================================================
-- RBAC: leads.duplicate_override
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select (select private.has_permission('leads.duplicate_override'))$$,
  array[true],
  'super_admin has leads.duplicate_override'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select private.has_permission('leads.duplicate_override'))$$,
  array[true],
  'sales_manager has leads.duplicate_override'
);

select set_config('request.jwt.claim.sub', 'c7777777-7777-7777-7777-777777777777', true);
select results_eq(
  $$select (select private.has_permission('leads.duplicate_override'))$$,
  array[true],
  'legacy management has leads.duplicate_override'
);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);
select results_eq(
  $$select (select private.has_permission('leads.duplicate_override'))$$,
  array[false],
  'sales_executive denied leads.duplicate_override'
);

select set_config('request.jwt.claim.sub', 'c8888888-8888-8888-8888-888888888888', true);
select results_eq(
  $$select (select private.has_permission('leads.duplicate_override'))$$,
  array[false],
  'legacy sales denied leads.duplicate_override'
);

-- =============================================================================
-- RPC exposure
-- =============================================================================

reset role;

select results_eq(
  $$select has_function_privilege('authenticated', 'public.check_manual_lead_duplicate(text,text,text,text,text)', 'execute')$$,
  array[true],
  'authenticated can execute check_manual_lead_duplicate'
);

select results_eq(
  $$select has_function_privilege('authenticated', 'public.create_manual_lead(text,text,text,text,text,text,uuid,text,text,text[],text,text,uuid,boolean,text)', 'execute')$$,
  array[true],
  'authenticated can execute create_manual_lead'
);

-- =============================================================================
-- Duplicate preview: CLEAR (no existing contact)
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select outcome_code, can_create, can_override, existing_lead_id
    from public.check_manual_lead_duplicate(
      '+919500000013', null, 'complete-home-interiors', 'apartment-2bhk', null
    )$$,
  $$values ('CLEAR'::text, true, false, null::uuid)$$,
  'unknown phone preview returns CLEAR'
);

select results_eq(
  $$select array_agg(key order by key)
    from public.check_manual_lead_duplicate(
      '+919500000013', null, 'complete-home-interiors', 'apartment-2bhk', null
    ) r,
    lateral jsonb_object_keys(to_jsonb(r)) key$$,
  $$select array['can_create', 'can_override', 'existing_lead_id', 'outcome_code']::text[]$$,
  'duplicate preview exposes only four non-PII outcome fields'
);

-- =============================================================================
-- Manual create: executive self-assignment
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select set_config(
  'test.phase5c2b_exec_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Exec Client',
    '+919500000001',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select status::text, assigned_to::text, entry_method::text, source::text
    from public.leads where id = current_setting('test.phase5c2b_exec_lead')::uuid$$,
  $$values ('assigned'::text, 'c3333333-3333-3333-3333-333333333333'::text, 'manual'::text, 'manual-crm'::text)$$,
  'executive manual create auto-assigns to self with manual entry metadata'
);

select results_eq(
  $$select count(*)::integer from public.contact_channels
    where address_normalized = '+919500000001' and channel_type = 'phone' and status = 'active'$$,
  array[1],
  'new manual create provisions active phone contact channel'
);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Exec Forbidden Assignee',
    '+919500000099',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    null, null, '{}'::text[], null, null,
    'c4444444-4444-4444-4444-444444444444'::uuid
  )$$,
  '42501',
  'CRM_MANUAL_LEAD_ASSIGNEE_FORBIDDEN',
  'executive cannot choose another assignee'
);

-- =============================================================================
-- Manual create: manager assignment modes
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5c2b_mgr_unassigned',
  (select id::text from public.create_manual_lead(
    '5C2B Manager Unassigned',
    '+919500000002',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    null, null, '{}'::text[], null, null,
    null
  )),
  true
);

select results_eq(
  $$select status::text, assigned_to is null from public.leads where id = current_setting('test.phase5c2b_mgr_unassigned')::uuid$$,
  $$values ('new'::text, true)$$,
  'manager may create unassigned lead in new status'
);

select set_config(
  'test.phase5c2b_mgr_self',
  (select id::text from public.create_manual_lead(
    '5C2B Manager Self',
    '+919500000003',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    null, null, '{}'::text[], null, null,
    'c2222222-2222-2222-2222-222222222222'::uuid
  )),
  true
);

select results_eq(
  $$select status::text, assigned_to::text from public.leads where id = current_setting('test.phase5c2b_mgr_self')::uuid$$,
  $$values ('assigned'::text, 'c2222222-2222-2222-2222-222222222222'::text)$$,
  'manager may self-assign manual lead'
);

select set_config(
  'test.phase5c2b_mgr_execb',
  (select id::text from public.create_manual_lead(
    '5C2B Manager Exec B',
    '+919500000004',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    null, null, '{}'::text[], null, null,
    'c4444444-4444-4444-4444-444444444444'::uuid
  )),
  true
);

select results_eq(
  $$select assigned_to::text from public.leads where id = current_setting('test.phase5c2b_mgr_execb')::uuid$$,
  array['c4444444-4444-4444-4444-444444444444'::text],
  'manager may assign eligible executive'
);

select results_eq(
  $$select count(*)::integer from public.lead_assignment_history
    where lead_id = current_setting('test.phase5c2b_mgr_execb')::uuid$$,
  array[1],
  'assigned manual lead writes assignment history'
);

-- =============================================================================
-- Manual create: super admin assignment modes
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c1111111-1111-1111-1111-111111111111', true);

select set_config(
  'test.phase5c2b_admin_unassigned',
  (select id::text from public.create_manual_lead(
    '5C2B Admin Unassigned',
    '+919500000005',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select status::text from public.leads where id = current_setting('test.phase5c2b_admin_unassigned')::uuid$$,
  array['new'],
  'super admin may create unassigned manual lead'
);

select set_config(
  'test.phase5c2b_admin_exec',
  (select id::text from public.create_manual_lead(
    '5C2B Admin Exec Assign',
    '+919500000006',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    null, null, '{}'::text[], null, null,
    'c3333333-3333-3333-3333-333333333333'::uuid
  )),
  true
);

select results_eq(
  $$select assigned_to::text from public.leads where id = current_setting('test.phase5c2b_admin_exec')::uuid$$,
  array['c3333333-3333-3333-3333-333333333333'::text],
  'super admin may assign eligible executive'
);

-- =============================================================================
-- Manual create: validation failures
-- =============================================================================

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Invalid Assignee',
    '+919500000007',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    null, null, '{}'::text[], null, null,
    'c5555555-5555-5555-5555-555555555555'::uuid
  )$$,
  '22023',
  'CRM_MANUAL_LEAD_INVALID_ASSIGNEE',
  'project manager rejected as manual lead assignee'
);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Inactive Source',
    '+919500000098',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    '00000000-0000-4000-8000-000000000099'::uuid
  )$$,
  '22023',
  'CRM_MANUAL_LEAD_INACTIVE_SOURCE',
  'inactive primary source rejected'
);

-- =============================================================================
-- Manual create: audit trail and consent isolation
-- =============================================================================

select results_eq(
  $$select count(*)::integer from public.lead_source_touchpoints
    where lead_id = current_setting('test.phase5c2b_exec_lead')::uuid$$,
  array[1],
  'manual create writes exactly one first touchpoint'
);

select results_eq(
  $$select count(*)::integer from public.lead_events
    where lead_id = current_setting('test.phase5c2b_exec_lead')::uuid and event_type = 'lead.created'$$,
  array[1],
  'manual create writes lead.created event'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where lead_id = current_setting('test.phase5c2b_exec_lead')::uuid and activity_type = 'lead.manual_created'$$,
  array[1],
  'manual create writes lead.manual_created activity'
);

select results_eq(
  $$select count(*)::integer from public.lead_activities
    where lead_id = current_setting('test.phase5c2b_mgr_execb')::uuid and activity_type = 'assignment.changed'$$,
  array[1],
  'assigned manual create writes assignment.changed activity'
);

select results_eq(
  $$select count(*)::integer from public.consent_events$$,
  array[current_setting('test.phase5c2b_pre_consent_count')::integer],
  'manual create writes zero consent_events'
);

-- =============================================================================
-- Contact: reuse, channel enrichment, identity conflict, display_name
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5c2b_contact_a',
  (select contact_id::text from public.leads where id = current_setting('test.phase5c2b_exec_lead')::uuid),
  true
);

select set_config(
  'test.phase5c2b_reuse_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Reuse Attempt',
    '+919500000001',
    null,
    'modular-kitchens',
    'apartment-3bhk',
    'within-2-months',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select contact_id::text from public.leads where id = current_setting('test.phase5c2b_reuse_lead')::uuid$$,
  array[current_setting('test.phase5c2b_contact_a')],
  'manual create reuses existing contact by phone'
);

select set_config(
  'test.phase5c2b_phone_only_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Phone Only',
    '+919500000009',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select set_config(
  'test.phase5c2b_email_enriched',
  (select id::text from public.create_manual_lead(
    '5C2B Email Enriched',
    '+919500000009',
    '5c2b-enriched@example.test',
    'modular-kitchens',
    'apartment-1bhk', 'after-2-months',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select count(*)::integer from public.contact_channels ch
    where ch.contact_id = (select contact_id from public.leads where id = current_setting('test.phase5c2b_phone_only_lead')::uuid)
      and ch.channel_type = 'email'
      and ch.address_normalized = '5c2b-enriched@example.test'
      and ch.status = 'active'$$,
  array[1],
  'manual create adds missing email channel to existing phone contact'
);

select set_config(
  'test.phase5c2b_split_phone_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Split Phone',
    '+919500000010',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select set_config(
  'test.phase5c2b_split_email_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Split Email',
    '+919500000011',
    '5c2b-split-conflict@example.test',
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select outcome_code, can_create, can_override
    from public.check_manual_lead_duplicate(
      '+919500000010',
      '5c2b-split-conflict@example.test',
      'complete-home-interiors',
      'apartment-2bhk',
      null
    )$$,
  $$values ('CONTACT_IDENTITY_CONFLICT'::text, false, false)$$,
  'split phone/email contacts return CONTACT_IDENTITY_CONFLICT preview'
);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Split Conflict Create',
    '+919500000010',
    '5c2b-split-conflict@example.test',
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )$$,
  'P0001',
  'CRM_MANUAL_LEAD_CONTACT_IDENTITY_CONFLICT',
  'split identity conflict blocks manual create without override path'
);

select set_config(
  'test.phase5c2b_preserve_lead',
  (select id::text from public.create_manual_lead(
    'Preserved Display Name',
    '+919500000012',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select set_config(
  'test.phase5c2b_preserve_contact',
  (select contact_id::text from public.leads where id = current_setting('test.phase5c2b_preserve_lead')::uuid),
  true
);

select set_config(
  'test.phase5c2b_preserve_reuse',
  (select id::text from public.create_manual_lead(
    'Attempted Overwrite Name',
    '+919500000012',
    null,
    'modular-kitchens',
    'apartment-1bhk', 'after-2-months',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select display_name from public.contacts where id = current_setting('test.phase5c2b_preserve_contact')::uuid$$,
  array['Preserved Display Name'::text],
  'reused contact display_name is not overwritten'
);

-- =============================================================================
-- Duplicate: REUSABLE_CONTACT after closed lead
-- =============================================================================

select set_config(
  'test.phase5c2b_reusable_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Reusable Closed',
    '+919500000014',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Koramangala'
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5c2b_reusable_lead')::uuid,
  'closed_lost',
  'Closed for reusable contact duplicate test',
  'timing'
);

reset role;
set local role postgres;
select set_config('onedecore.crm_transition', '1', true);
update public.leads
set created_at = now() - interval '31 days'
where id = current_setting('test.phase5c2b_reusable_lead')::uuid;
select set_config('onedecore.crm_transition', '0', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select outcome_code, can_create, can_override
    from public.check_manual_lead_duplicate(
      '+919500000014', null, 'complete-home-interiors', 'apartment-2bhk', 'Koramangala'
    )$$,
  $$values ('REUSABLE_CONTACT'::text, true, false)$$,
  'aged closed contact yields REUSABLE_CONTACT without recent-similar block'
);

-- =============================================================================
-- Duplicate: ACTIVE_DUPLICATE hard block
-- =============================================================================

select set_config(
  'test.phase5c2b_active_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Active Duplicate',
    '+919500000015',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Indiranagar',
    null, '{}'::text[], null, null,
    'c3333333-3333-3333-3333-333333333333'::uuid
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5c2b_active_lead')::uuid,
  'contacted',
  null,
  null
);

select results_eq(
  $$select outcome_code, can_create, can_override
    from public.check_manual_lead_duplicate(
      '+919500000015', null, 'complete-home-interiors', 'apartment-2bhk', 'Indiranagar'
    )$$,
  $$values ('ACTIVE_DUPLICATE'::text, false, false)$$,
  'active similar lead preview returns ACTIVE_DUPLICATE without override'
);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Active Duplicate Attempt',
    '+919500000015',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Indiranagar'
  )$$,
  'P0001',
  'CRM_MANUAL_LEAD_ACTIVE_DUPLICATE',
  'active duplicate hard blocks manual create'
);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Active Override Attempt',
    '+919500000015',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Indiranagar',
    null, '{}'::text[], null, null,
    null,
    true,
    'Manager attempted override on active duplicate block'
  )$$,
  'P0001',
  'CRM_MANUAL_LEAD_ACTIVE_DUPLICATE',
  'active duplicate cannot be overridden even with reason'
);

-- =============================================================================
-- Duplicate: RECENT_SIMILAR soft block and override policy
-- =============================================================================

select set_config(
  'test.phase5c2b_recent_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Recent Similar',
    '+919500000016',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Whitefield'
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5c2b_recent_lead')::uuid,
  'closed_lost',
  'Closed for recent similar duplicate test',
  'price'
);

select results_eq(
  $$select outcome_code, can_create, can_override
    from public.check_manual_lead_duplicate(
      '+919500000016', null, 'complete-home-interiors', 'apartment-2bhk', 'Whitefield'
    )$$,
  $$values ('RECENT_SIMILAR'::text, false, true)$$,
  'recent closed similar lead preview returns RECENT_SIMILAR with manager override'
);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Recent Without Override',
    '+919500000016',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Whitefield'
  )$$,
  'P0001',
  'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_REQUIRED',
  'recent similar requires explicit duplicate override'
);

select set_config('request.jwt.claim.sub', 'c3333333-3333-3333-3333-333333333333', true);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Exec Override Denied',
    '+919500000016',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Whitefield',
    null, '{}'::text[], null, null,
    null,
    true,
    'Executive attempted override without permission'
  )$$,
  '42501',
  'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_DENIED',
  'sales executive cannot override recent similar duplicate'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Short Override Reason',
    '+919500000016',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Whitefield',
    null, '{}'::text[], null, null,
    null,
    true,
    'too short'
  )$$,
  '22023',
  'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_REASON_INVALID',
  'override reason shorter than ten characters rejected'
);

select set_config(
  'test.phase5c2b_recent_override_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Recent Override Success',
    '+919500000016',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'immediate',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Whitefield',
    null, '{}'::text[], null, null,
    null,
    true,
    'Manager override for returning client within thirty days'
  )),
  true
);

select results_eq(
  $$select count(*)::integer from public.lead_events
    where lead_id = current_setting('test.phase5c2b_recent_override_lead')::uuid
      and event_type = 'lead.duplicate_detected'$$,
  array[1],
  'manager override create records duplicate_detected event'
);

select set_config(
  'test.phase5c2b_mgmt_seed',
  (select id::text from public.create_manual_lead(
    '5C2B Mgmt Seed',
    '+919500000021',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'HSR Layout'
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5c2b_mgmt_seed')::uuid,
  'closed_lost',
  'Seed lead for management override path',
  'timing'
);

select set_config('request.jwt.claim.sub', 'c7777777-7777-7777-7777-777777777777', true);

select set_config(
  'test.phase5c2b_mgmt_override_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Management Override',
    '+919500000021',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'HSR Layout',
    null, '{}'::text[], null, null,
    null,
    true,
    'Legacy management override for duplicate-safe create'
  )),
  true
);

select results_eq(
  $$select id::text from public.leads where id = current_setting('test.phase5c2b_mgmt_override_lead')::uuid$$,
  array[current_setting('test.phase5c2b_mgmt_override_lead')],
  'legacy management may override recent similar with valid reason'
);

-- =============================================================================
-- Duplicate: non-similar and locality fail-closed
-- =============================================================================

select set_config(
  'test.phase5c2b_old_closed',
  (select id::text from public.create_manual_lead(
    '5C2B Old Closed',
    '+919500000017',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

reset role;
set local role postgres;
select set_config('onedecore.crm_transition', '1', true);
update public.leads
set created_at = now() - interval '31 days',
    status = 'closed_lost',
    closed_lost_reason_id = (select id from public.lead_closure_reasons where code = 'other' and is_active = true limit 1),
    closed_lost_note = 'Old closed lead outside duplicate window'
where id = current_setting('test.phase5c2b_old_closed')::uuid;
select set_config('onedecore.crm_transition', '0', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select outcome_code, can_create
    from public.check_manual_lead_duplicate(
      '+919500000017', null, 'complete-home-interiors', 'apartment-2bhk', null
    )$$,
  $$values ('REUSABLE_CONTACT'::text, true)$$,
  'closed lead older than thirty days is not recent-similar blocked'
);

select set_config(
  'test.phase5c2b_service_seed',
  (select id::text from public.create_manual_lead(
    '5C2B Service Seed',
    '+919500000018',
    null,
    'modular-kitchens',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5c2b_service_seed')::uuid,
  'closed_lost',
  'Service mismatch duplicate seed',
  'timing'
);

select results_eq(
  $$select outcome_code, can_create
    from public.check_manual_lead_duplicate(
      '+919500000018', null, 'complete-home-interiors', 'apartment-2bhk', null
    )$$,
  $$values ('REUSABLE_CONTACT'::text, true)$$,
  'different service code is not treated as similar duplicate'
);

select set_config(
  'test.phase5c2b_property_seed',
  (select id::text from public.create_manual_lead(
    '5C2B Property Seed',
    '+919500000019',
    null,
    'complete-home-interiors',
    'apartment-3bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5c2b_property_seed')::uuid,
  'closed_lost',
  'Property mismatch duplicate seed',
  'timing'
);

select results_eq(
  $$select outcome_code, can_create
    from public.check_manual_lead_duplicate(
      '+919500000019', null, 'complete-home-interiors', 'apartment-2bhk', null
    )$$,
  $$values ('REUSABLE_CONTACT'::text, true)$$,
  'different property code is not treated as similar duplicate'
);

select set_config(
  'test.phase5c2b_locality_seed',
  (select id::text from public.create_manual_lead(
    '5C2B Locality Seed',
    '+919500000020',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    'Jayanagar'
  )),
  true
);

select public.transition_lead_status(
  current_setting('test.phase5c2b_locality_seed')::uuid,
  'closed_lost',
  'Locality mismatch duplicate seed',
  'timing'
);

select results_eq(
  $$select outcome_code, can_create
    from public.check_manual_lead_duplicate(
      '+919500000020', null, 'complete-home-interiors', 'apartment-2bhk', 'Malleshwaram'
    )$$,
  $$values ('REUSABLE_CONTACT'::text, true)$$,
  'mismatched locality fails closed to not-similar'
);

select results_eq(
  $$select timeline_code::text from public.leads where id = current_setting('test.phase5c2b_recent_override_lead')::uuid$$,
  array['immediate'::text],
  'duplicate similarity ignores timeline differences on override create'
);

-- =============================================================================
-- Privacy: preview visibility and role denial
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select set_config(
  'test.phase5c2b_privacy_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Privacy Lead',
    '+919500000023',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid,
    null, null, '{}'::text[], null, null,
    'c3333333-3333-3333-3333-333333333333'::uuid
  )),
  true
);

select set_config('request.jwt.claim.sub', 'c4444444-4444-4444-4444-444444444444', true);

select results_eq(
  $$select outcome_code, existing_lead_id is null
    from public.check_manual_lead_duplicate(
      '+919500000023', null, 'complete-home-interiors', 'apartment-2bhk', null
    )$$,
  $$values ('ACTIVE_DUPLICATE'::text, true)$$,
  'executive without lead visibility gets null existing_lead_id in preview'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select results_eq(
  $$select existing_lead_id::text
    from public.check_manual_lead_duplicate(
      '+919500000023', null, 'complete-home-interiors', 'apartment-2bhk', null
    )$$,
  array[current_setting('test.phase5c2b_privacy_lead')],
  'manager preview may return existing_lead_id when lead is visible'
);

select set_config('request.jwt.claim.sub', 'c5555555-5555-5555-5555-555555555555', true);

select throws_ok(
  $$select outcome_code from public.check_manual_lead_duplicate(
    '+919500000013', null, 'complete-home-interiors', 'apartment-2bhk', null
  )$$,
  '42501',
  'CRM_MANUAL_LEAD_PERMISSION_DENIED',
  'project manager denied duplicate preview'
);

select set_config('request.jwt.claim.sub', 'c6666666-6666-6666-6666-666666666666', true);

select throws_ok(
  $$select outcome_code from public.check_manual_lead_duplicate(
    '+919500000013', null, 'complete-home-interiors', 'apartment-2bhk', null
  )$$,
  '42501',
  'CRM_MANUAL_LEAD_PERMISSION_DENIED',
  'designer denied duplicate preview'
);

-- =============================================================================
-- Create denial for non-creator CRM roles
-- =============================================================================

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B PM Create',
    '+919500000097',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )$$,
  '42501',
  'CRM_MANUAL_LEAD_PERMISSION_DENIED',
  'project manager denied manual create'
);

select set_config('request.jwt.claim.sub', 'c6666666-6666-6666-6666-666666666666', true);

select throws_ok(
  $$select public.create_manual_lead(
    '5C2B Designer Create',
    '+919500000096',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )$$,
  '42501',
  'CRM_MANUAL_LEAD_PERMISSION_DENIED',
  'designer denied manual create'
);

-- =============================================================================
-- Legacy sales create + concurrency contact reuse
-- =============================================================================

select set_config('request.jwt.claim.sub', 'c8888888-8888-8888-8888-888888888888', true);

select set_config(
  'test.phase5c2b_sales_lead',
  (select id::text from public.create_manual_lead(
    '5C2B Legacy Sales',
    '+919500000025',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select assigned_to::text from public.leads where id = current_setting('test.phase5c2b_sales_lead')::uuid$$,
  array['c8888888-8888-8888-8888-888888888888'::text],
  'legacy sales manual create auto-assigns to self'
);

select set_config('request.jwt.claim.sub', 'c2222222-2222-2222-2222-222222222222', true);

select set_config('test.phase5c2b_concurrency_pre', (select count(*)::text from public.contacts), true);

select set_config(
  'test.phase5c2b_concurrency_a',
  (select contact_id::text from public.create_manual_lead(
    '5C2B Concurrency A',
    '+919500000022',
    null,
    'complete-home-interiors',
    'apartment-2bhk',
    'within-1-month',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select set_config(
  'test.phase5c2b_concurrency_b',
  (select contact_id::text from public.create_manual_lead(
    '5C2B Concurrency B',
    '+919500000022',
    null,
    'modular-kitchens',
    'apartment-1bhk', 'after-2-months',
    current_setting('test.phase5c2b_phone_call_source')::uuid
  )),
  true
);

select results_eq(
  $$select current_setting('test.phase5c2b_concurrency_a') = current_setting('test.phase5c2b_concurrency_b')$$,
  array[true],
  'sequential creates with same phone reuse one contact'
);

select results_eq(
  $$select count(*)::integer from public.contacts$$,
  array[current_setting('test.phase5c2b_concurrency_pre')::integer + 1],
  'sequential duplicate-phone creates add only one new contact row'
);

select * from finish();
rollback;
