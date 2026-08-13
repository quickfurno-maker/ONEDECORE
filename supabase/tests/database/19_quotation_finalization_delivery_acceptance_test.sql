begin;
select plan(42);

-- ----------------------------------------------------------------------------
-- 1. Schema & Function Existence Verification
-- ----------------------------------------------------------------------------
select has_table('public', 'quotation_commercial_settings', 'quotation_commercial_settings table should exist');
select has_table('public', 'quotation_pdf_documents', 'quotation_pdf_documents table should exist');
select has_table('public', 'quotation_access_grants', 'quotation_access_grants table should exist');
select has_table('public', 'quotation_acceptances', 'quotation_acceptances table should exist');

select has_function('public', 'set_quotation_max_discount', array['numeric'], 'set_quotation_max_discount RPC should exist');
select has_function('public', 'finalize_quotation_version', array['uuid', 'uuid', 'integer', 'text'], 'finalize_quotation_version RPC should exist');
select has_function('public', 'issue_quotation_access_grant', array['uuid', 'text', 'text'], 'issue_quotation_access_grant RPC should exist');
select has_function('public', 'get_quotation_by_capability', array['text'], 'get_quotation_by_capability RPC should exist');
select has_function('public', 'accept_quotation_by_capability', array['text', 'text', 'text'], 'accept_quotation_by_capability RPC should exist');
select has_function('public', 'create_quotation_revision', array['uuid', 'text'], 'create_quotation_revision RPC should exist');

-- ----------------------------------------------------------------------------
-- 2. Test Fixture Setup (Roles, Users, Profiles, Contact, Lead, Quotation Draft)
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);

-- Create test profiles
insert into auth.users (id, instance_id, email, aud, role) values
  ('7b111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'superadmin_7b@onedecore.in', 'authenticated', 'authenticated'),
  ('7b222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'manager_7b@onedecore.in', 'authenticated', 'authenticated'),
  ('7b333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'exec_assigned_7b@onedecore.in', 'authenticated', 'authenticated'),
  ('7b444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'exec_unassigned_7b@onedecore.in', 'authenticated', 'authenticated'),
  ('7b555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'designer_7b@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active' where id in (
  '7b111111-1111-1111-1111-111111111111',
  '7b222222-2222-2222-2222-222222222222',
  '7b333333-3333-3333-3333-333333333333',
  '7b444444-4444-4444-4444-444444444444',
  '7b555555-5555-5555-5555-555555555555'
);

-- Assign system roles
insert into public.user_roles (user_id, role_id)
select '7b111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '7b222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '7b333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '7b444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '7b555555-5555-5555-5555-555555555555', id from public.roles where code = 'designer'
on conflict do nothing;

-- Create synthetic contact & lead
insert into public.contacts (id, display_name, status)
values ('7b666666-6666-6666-6666-666666666666', 'Test Client 7B', 'active')
on conflict (id) do nothing;

insert into public.leads (
  id,
  submission_reference,
  contact_id,
  submitted_name,
  submitted_email,
  status,
  source,
  primary_source_id,
  entry_method,
  service_code,
  property_code,
  timeline_code,
  planner_version,
  landing_path,
  assigned_to
) values (
  '7b777777-7777-7777-7777-777777777777',
  '7b777777-7777-7777-7777-777777777777',
  '7b666666-6666-6666-6666-666666666666',
  'Test Client 7B',
  'client7b@example.com',
  'assigned',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'public_intake',
  'complete-home-interiors',
  'apartment-3bhk',
  'ready-now',
  'v1',
  '/planner',
  '7b333333-3333-3333-3333-333333333333'
) on conflict (id) do nothing;

-- Create synthetic tax profile
insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
values ('7b888888-8888-8888-8888-888888888888', 'gst_18_7b', 'Standard GST 18%', 18.00, true, '7b111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

-- Set Super Admin context and configure max discount
select set_config('request.jwt.claim.sub', '7b111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);

select is(
  (public.set_quotation_max_discount(25.00)->>'success'),
  'true',
  'Super Admin sets maximum discount percentage bound to 25.00%'
);

-- Create quotation draft
select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);

select is(
  (public.create_quotation_draft(
    '7b777777-7777-7777-7777-777777777777'::uuid,
    'Commercial Interior Quotation 7B'::text
  )->>'versionNumber')::integer,
  1,
  'Assigned Sales Exec creates initial draft version 1'
);

-- Save items & payment schedule
select save_quotation_draft_items(
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  1::bigint,
  jsonb_build_array(
    jsonb_build_object(
      'sectionName', 'Living Room',
      'items', jsonb_build_array(
        jsonb_build_object('itemName', 'Sofa Set Custom', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 10000000)
      )
    )
  ),
  'item_key_7b_01'
);

select update_quotation_draft(
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  2::bigint,
  p_tax_profile_id => '7b888888-8888-8888-8888-888888888888'::uuid
);

select replace_quotation_payment_schedule(
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  3::bigint,
  'percentage'::text,
  jsonb_build_array(
    jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', '50.00'),
    jsonb_build_object('milestoneName', 'Handover', 'percentage', '50.00')
  )
);

-- ----------------------------------------------------------------------------
-- 3. RBAC Enforcement on Finalization
-- ----------------------------------------------------------------------------
-- Test: Designer role denied finalization
select set_config('request.jwt.claim.sub', '7b555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.finalize_quotation_version(
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and status = 'draft'),
    4
  )$$,
  'FORBIDDEN: Permission quotations.finalize is required.',
  'Designer role is denied quotations.finalize'
);

-- Test: Unassigned Sales Exec denied finalization
select set_config('request.jwt.claim.sub', '7b444444-4444-4444-4444-444444444444', true);
select throws_ok(
  $$select public.finalize_quotation_version(
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and status = 'draft'),
    4
  )$$,
  'FORBIDDEN: Sales Executive can only finalize quotations for assigned leads.',
  'Unassigned Sales Executive is denied finalization for unassigned lead'
);

-- ----------------------------------------------------------------------------
-- 4. Server-Authoritative Finalization & Immutability
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);

select is(
  (public.finalize_quotation_version(
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and status = 'draft'),
    4,
    'fin_key_7b_01'
  )->>'status'),
  'finalized',
  'Assigned Sales Exec successfully finalizes draft version 1'
);

-- Verify server-authoritative canonical content SHA-256 is stored
select isnt(
  (select finalized_content_sha256 from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
  null,
  'Finalized version has non-null server-authoritative finalized_content_sha256'
);

-- Test: Idempotent replay of finalization
select is(
  (public.finalize_quotation_version(
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    4,
    'fin_key_7b_01'
  )->>'status'),
  'finalized',
  'Idempotent replay of finalization with same key returns status finalized'
);

-- Test: Idempotency key reuse with different payload throws exception
select throws_ok(
  $$select public.finalize_quotation_version(
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    99,
    'fin_key_7b_01'
  )$$,
  'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH: Idempotency key reused with different payload.',
  'Idempotency key reuse with different payload throws IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH'
);

-- Test: Immutability trigger blocks updating finalized version
select throws_ok(
  $$update public.quotation_versions set title = 'Mutated Title' where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1$$,
  'QUOTATION_VERSION_IMMUTABLE: Cannot update or delete a finalized/archived quotation version.',
  'Immutability trigger blocks updating a finalized quotation version'
);

-- ----------------------------------------------------------------------------
-- 5. PDF Artifact Registration & Access Grant Issuance
-- ----------------------------------------------------------------------------
-- Synthetic PDF readiness registration
select set_config('role', 'postgres', true);
insert into public.quotation_pdf_documents (
  quotation_id,
  quotation_version_id,
  bucket_id,
  object_path,
  status,
  pdf_sha256,
  file_size_bytes,
  created_by,
  ready_at
) values (
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
  'quotation-documents',
  '7b777777-7777-7777-7777-777777777777/v1.pdf',
  'ready',
  'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
  102450,
  '7b111111-1111-1111-1111-111111111111',
  now()
);

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

-- Issue access grant
select is(
  (public.issue_quotation_access_grant(
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'nonce_7b_01',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
  )->>'success'),
  'true',
  'Assigned Sales Exec issues quotation access grant for finalized version 1'
);

-- Verify grant stored in quotation_access_grants with SHA-256 token digest
select is(
  (select count(*)::integer from public.quotation_access_grants where capability_token_hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'),
  1,
  'Quotation access grant record exists with matching SHA-256 capability_token_hash'
);

-- ----------------------------------------------------------------------------
-- 6. Client Capability DTO Retrieval
-- ----------------------------------------------------------------------------
select set_config('role', 'anon', true);

select is(
  (public.get_quotation_by_capability('test_token_7b_01')->>'success'),
  'true',
  'Anon client retrieves valid commercial quotation DTO using capability token'
);

select is(
  (public.get_quotation_by_capability('invalid_token_999')->>'success'),
  'false',
  'Anon client receives generic failure for invalid capability token'
);

-- ----------------------------------------------------------------------------
-- 7. Pre-Acceptance Revision Creation
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

select is(
  (public.create_quotation_revision(
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'rev_key_7b_01'
  )->>'version_number')::integer,
  2,
  'Assigned Sales Exec creates draft revision version 2 from finalized version 1'
);

-- Verify previous access grant was automatically revoked upon revision creation
select isnt(
  (select revoked_at from public.quotation_access_grants where capability_token_hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'),
  null,
  'Creating new draft revision automatically revokes active access grant for version 1'
);

-- Finalize version 2 and register PDF
select save_quotation_draft_items(
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  1::bigint,
  jsonb_build_array(
    jsonb_build_object(
      'sectionName', 'Living Room',
      'items', jsonb_build_array(
        jsonb_build_object('itemName', 'Sofa Set Custom Rev', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 12000000)
      )
    )
  ),
  'item_key_7b_02'
);

select update_quotation_draft(
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  2::bigint,
  p_tax_profile_id => '7b888888-8888-8888-8888-888888888888'::uuid
);

select replace_quotation_payment_schedule(
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  3::bigint,
  'percentage'::text,
  jsonb_build_array(
    jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', '50.00'),
    jsonb_build_object('milestoneName', 'Handover', 'percentage', '50.00')
  )
);

select finalize_quotation_version(
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 2),
  4,
  'fin_key_7b_02'
);

select set_config('role', 'postgres', true);
insert into public.quotation_pdf_documents (
  quotation_id,
  quotation_version_id,
  bucket_id,
  object_path,
  status,
  pdf_sha256,
  file_size_bytes,
  created_by,
  ready_at
) values (
  (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 2),
  'quotation-documents',
  '7b777777-7777-7777-7777-777777777777/v2.pdf',
  'ready',
  'b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01234a',
  125000,
  '7b111111-1111-1111-1111-111111111111',
  now()
);

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

select issue_quotation_access_grant(
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 2),
  'nonce_7b_02',
  '9d7087f6c6521526cef009ce5eff26ece278b0d9840d5cc9b92g7g3bc559b029'
);

-- ----------------------------------------------------------------------------
-- 8. Client Acceptance & Atomic Closed-Won CRM Integration
-- ----------------------------------------------------------------------------
-- Direct pipeline update guard test: Direct UPDATE to leads.status without transition context fails
select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$update public.leads set status = 'closed_won' where id = '7b777777-7777-7777-7777-777777777777'::uuid$$,
  '42501',
  'Direct lead pipeline status update is forbidden by trg_leads_no_direct_pipeline_update'
);

-- Execute client acceptance via capability RPC
select set_config('role', 'anon', true);

select is(
  (public.accept_quotation_by_capability('test_token_7b_02', 'Test Client 7B', 'client7b@example.com')->>'success'),
  'true',
  'Client accepts commercial quotation via capability token'
);

-- Verify CRM Lead status was mutated atomically to closed_won
select is(
  (select status from public.leads where id = '7b777777-7777-7777-7777-777777777777'::uuid),
  'closed_won',
  'CRM lead status is atomically mutated to closed_won upon quotation acceptance'
);

-- Verify credited_sales_executive_id snapshot in quotation_acceptances
select is(
  (select credited_sales_executive_id from public.quotation_acceptances where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  '7b333333-3333-3333-3333-333333333333'::uuid,
  'Quotation acceptance snapshots assigned Sales Executive as credited_sales_executive_id'
);

-- Verify revenue basis in quotation_acceptances is taxable_base_paise (GST excluded)
select is(
  (select taxable_base_paise from public.quotation_acceptances where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
  12000000::bigint,
  'Quotation acceptance revenue basis equals taxable_base_paise (12000000 paise)'
);

-- Verify lead.status_changed event in lead_events
select is(
  (select count(*)::integer from public.lead_events where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid and event_type = 'lead.status_changed'),
  1,
  'lead.status_changed event emitted to lead_events stream'
);

-- Verify status.changed activity in lead_activities
select is(
  (select count(*)::integer from public.lead_activities where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid and activity_type = 'status.changed'),
  1,
  'status.changed activity recorded in lead_activities interaction log'
);

-- Test: Idempotent replay of same quotation acceptance
select is(
  (public.accept_quotation_by_capability('test_token_7b_02', 'Test Client 7B', 'client7b@example.com')->>'alreadyAccepted'),
  'true',
  'Idempotent replay of same quotation acceptance returns alreadyAccepted true'
);

-- Test: Post-acceptance revision creation is strictly forbidden
select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$select public.create_quotation_revision(
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 2)
  )$$,
  'QUOTATION_ACCEPTED_IMMUTABLE: Cannot create revision for an accepted quotation.',
  'Creating revision after quotation acceptance is strictly forbidden'
);

-- ----------------------------------------------------------------------------
-- 9. Privileges & Token Safety Scan
-- ----------------------------------------------------------------------------
-- Direct INSERT on quotation_access_grants by authenticated is denied by RLS
select throws_ok(
  $$insert into public.quotation_access_grants (
    quotation_id, quotation_version_id, derivation_nonce, capability_token_hash
  ) values (
    '7b777777-7777-7777-7777-777777777777'::uuid,
    '7b777777-7777-7777-7777-777777777777'::uuid,
    'nonce_hack',
    'hash_hack'
  )$$,
  '42501',
  'Direct INSERT on quotation_access_grants is denied to authenticated users'
);

-- Verify no plaintext capability token exists in database text/json columns
select is(
  (select count(*)::integer from public.quotation_access_grants where capability_token_hash = 'test_token_7b_02' or derivation_nonce = 'test_token_7b_02'),
  0,
  'Plaintext capability token is NOT persisted in quotation_access_grants table'
);

select * from finish();
rollback;
