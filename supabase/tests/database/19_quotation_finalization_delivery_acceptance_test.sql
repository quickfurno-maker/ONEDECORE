begin;
select plan(97);

-- ----------------------------------------------------------------------------
-- 1. Schema & Function Existence Verification
-- ----------------------------------------------------------------------------
select has_table('public', 'quotation_commercial_settings', 'quotation_commercial_settings table should exist');
select has_table('public', 'quotation_pdf_documents', 'quotation_pdf_documents table should exist');
select has_table('public', 'quotation_access_grants', 'quotation_access_grants table should exist');
select has_table('public', 'quotation_acceptances', 'quotation_acceptances table should exist');

select has_function('public', 'set_quotation_max_discount', array['numeric'], 'set_quotation_max_discount RPC should exist');
select has_function('public', 'finalize_quotation_version', array['uuid', 'uuid', 'integer', 'text'], 'finalize_quotation_version RPC should exist');
select has_function('public', 'issue_quotation_access_grant_internal', array['uuid', 'uuid', 'uuid', 'text', 'text', 'boolean'], 'issue_quotation_access_grant_internal RPC should exist');
select has_function('public', 'create_quotation_whatsapp_service_send_intent', array['uuid', 'uuid', 'uuid', 'text'], 'create_quotation_whatsapp_service_send_intent RPC should exist');
select has_function('public', 'get_quotation_by_capability', array['text'], 'get_quotation_by_capability RPC should exist');
select has_function('public', 'accept_quotation_by_capability', array['text', 'text', 'text'], 'accept_quotation_by_capability RPC should exist');
select has_function('public', 'create_quotation_revision', array['uuid', 'text'], 'create_quotation_revision RPC should exist');
select has_function('public', 'reserve_quotation_pdf_document', array['uuid'], 'reserve_quotation_pdf_document RPC should exist');
select has_function('public', 'mark_quotation_pdf_document_ready', array['uuid', 'text', 'text', 'bigint'], 'mark_quotation_pdf_document_ready RPC should exist');

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

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values ('7b666666-6666-6666-6666-666666666666', 'phone', '+919876543210', true),
       ('7b666666-6666-6666-6666-666666666666', 'email', 'client7b@example.com', true)
on conflict do nothing;

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
    'Commercial Interior Quotation 7B'::text,
    'draft_key_7b_01'::text
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

create temp table temp_test_ids as
select q.id as quote_id, qv.id as ver_id
from public.quotations q
join public.quotation_versions qv on qv.quotation_id = q.id
where q.lead_id = '7b777777-7777-7777-7777-777777777777'::uuid and qv.status = 'draft';

-- ----------------------------------------------------------------------------
-- 3. RBAC Enforcement on Finalization
-- ----------------------------------------------------------------------------
-- Test: Designer role denied finalization
select set_config('request.jwt.claim.sub', '7b555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.finalize_quotation_version(
    (select quote_id from temp_test_ids),
    (select ver_id from temp_test_ids),
    4
  )$$,
  'FORBIDDEN: Permission quotations.finalize is required.',
  'Designer role is denied quotations.finalize'
);

-- Test: Unassigned Sales Exec denied finalization
select set_config('request.jwt.claim.sub', '7b444444-4444-4444-4444-444444444444', true);
select throws_ok(
  $$select public.finalize_quotation_version(
    (select quote_id from temp_test_ids),
    (select ver_id from temp_test_ids),
    4
  )$$,
  'FORBIDDEN: Sales Executive can only finalize quotations for assigned leads.',
  'Unassigned Sales Executive is denied finalization for unassigned lead'
);

-- ----------------------------------------------------------------------------
-- 4. Server-Authoritative Finalization & Immutability
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);

select isnt(
  private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)),
  null,
  'Canonical hash is computable on draft before finalization'
);

update public.quotation_versions
set terms_and_conditions = 'Hash term A'
where id = (select ver_id from temp_test_ids);
select set_config('test.hash_terms_a', private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)), true);
update public.quotation_versions
set terms_and_conditions = 'Hash term B'
where id = (select ver_id from temp_test_ids);
select isnt(
  current_setting('test.hash_terms_a'),
  private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)),
  'Term change produces a different canonical hash'
);

update public.quotation_versions
set inclusions = array['Wood finish']
where id = (select ver_id from temp_test_ids);
select set_config('test.hash_inc_a', private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)), true);
update public.quotation_versions
set inclusions = array['Stone finish']
where id = (select ver_id from temp_test_ids);
select isnt(
  current_setting('test.hash_inc_a'),
  private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)),
  'Inclusion change produces a different canonical hash'
);

update public.quotation_versions
set exclusions = array['Civil']
where id = (select ver_id from temp_test_ids);
select set_config('test.hash_exc_a', private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)), true);
update public.quotation_versions
set exclusions = array['Plumbing']
where id = (select ver_id from temp_test_ids);
select isnt(
  current_setting('test.hash_exc_a'),
  private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)),
  'Exclusion change produces a different canonical hash'
);

update public.quotation_versions
set tax_profile_snapshot = jsonb_build_object('id','7b888888-8888-8888-8888-888888888888','code','gst_18_7b','display_name','GST A','rate_percentage',18)
where id = (select ver_id from temp_test_ids);
select set_config('test.hash_tax_a', private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)), true);
update public.quotation_versions
set tax_profile_snapshot = jsonb_build_object('id','7b888888-8888-8888-8888-888888888888','code','gst_20_7b','display_name','GST B','rate_percentage',20)
where id = (select ver_id from temp_test_ids);
select isnt(
  current_setting('test.hash_tax_a'),
  private.compute_canonical_quotation_sha256((select ver_id from temp_test_ids)),
  'Tax profile identity change produces a different canonical hash'
);

update public.quotation_tax_profiles
set rate_percentage = 20.00, display_name = 'Standard GST 20%'
where id = '7b888888-8888-8888-8888-888888888888'::uuid;

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

select is(
  (public.finalize_quotation_version(
    (select quote_id from temp_test_ids),
    (select ver_id from temp_test_ids),
    4,
    'fin_key_7b_01'
  )->>'status'),
  'finalized',
  'Assigned Sales Exec successfully finalizes draft version 1'
);

-- Verify server-authoritative canonical content SHA-256 is stored
select isnt(
  (select finalized_content_sha256 from public.quotation_versions where id = (select ver_id from temp_test_ids)),
  null,
  'Finalized version has non-null server-authoritative finalized_content_sha256'
);

select is(
  (select tax_rate_percentage from public.quotation_versions where id = (select ver_id from temp_test_ids)),
  20.00,
  'Finalization re-snapshots live tax rate 20 onto the version'
);

select is(
  (select (tax_profile_snapshot->>'rate_percentage')::numeric from public.quotation_versions where id = (select ver_id from temp_test_ids)),
  20.00,
  'tax_profile_snapshot rate is 20 after live resnapshot'
);

select is(
  (select tax_total_paise from public.quotation_versions where id = (select ver_id from temp_test_ids)),
  2000000::bigint,
  'tax_total_paise uses the live 20 percent rate'
);

select is(
  (select grand_total_paise from public.quotation_versions where id = (select ver_id from temp_test_ids)),
  12000000::bigint,
  'grand_total_paise uses the live 20 percent rate'
);

-- Test: Idempotent replay of finalization
select is(
  (public.finalize_quotation_version(
    (select quote_id from temp_test_ids),
    (select ver_id from temp_test_ids),
    4,
    'fin_key_7b_01'
  )->>'status'),
  'finalized',
  'Idempotent replay of finalization with same key returns status finalized'
);

-- Test: Idempotency key reuse with different payload throws exception
select throws_ok(
  $$select public.finalize_quotation_version(
    (select quote_id from temp_test_ids),
    (select ver_id from temp_test_ids),
    99,
    'fin_key_7b_01'
  )$$,
  'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH: Idempotency key reused with different payload.',
  'Idempotency key reuse with different payload throws IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH'
);

-- Test: Immutability trigger blocks updating finalized version
select set_config('role', 'postgres', true);
select throws_ok(
  $$update public.quotation_versions set title = 'Mutated Title' where id = (select ver_id from temp_test_ids)$$,
  'QUOTATION_VERSION_IMMUTABLE: Cannot update or delete a finalized/archived quotation version.',
  'Immutability trigger blocks updating a finalized quotation version'
);

select throws_ok(
  $$insert into public.quotation_sections (quotation_version_id, section_name, display_order) values ((select ver_id from temp_test_ids), 'Illegal Section', 99)$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate sections or schedule of a finalized/archived quotation version.',
  'Finalized section INSERT is blocked'
);
select throws_ok(
  $$update public.quotation_sections set section_name = 'Mutated' where quotation_version_id = (select ver_id from temp_test_ids)$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate sections or schedule of a finalized/archived quotation version.',
  'Finalized section UPDATE is blocked'
);
select throws_ok(
  $$delete from public.quotation_sections where quotation_version_id = (select ver_id from temp_test_ids)$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate sections or schedule of a finalized/archived quotation version.',
  'Finalized section DELETE is blocked'
);
select throws_ok(
  $$insert into public.quotation_items (section_id, item_name, quantity, unit_of_measure, unit_rate_paise, line_total_paise, display_order)
    values ((select id from public.quotation_sections where quotation_version_id = (select ver_id from temp_test_ids) limit 1), 'Illegal Item', 1, 'nos', 1, 1, 99)$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate items of a finalized/archived quotation version.',
  'Finalized item INSERT is blocked'
);
select throws_ok(
  $$update public.quotation_items set item_name = 'Mutated Item' where section_id in (select id from public.quotation_sections where quotation_version_id = (select ver_id from temp_test_ids))$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate items of a finalized/archived quotation version.',
  'Finalized item UPDATE is blocked'
);
select throws_ok(
  $$delete from public.quotation_items where section_id in (select id from public.quotation_sections where quotation_version_id = (select ver_id from temp_test_ids))$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate items of a finalized/archived quotation version.',
  'Finalized item DELETE is blocked'
);
select throws_ok(
  $$insert into public.quotation_payment_schedules (quotation_version_id, milestone_name, milestone_order, percentage, amount_paise)
    values ((select ver_id from temp_test_ids), 'Illegal Milestone', 99, 0, 0)$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate sections or schedule of a finalized/archived quotation version.',
  'Finalized payment schedule INSERT is blocked'
);
select throws_ok(
  $$update public.quotation_payment_schedules set milestone_name = 'Mutated' where quotation_version_id = (select ver_id from temp_test_ids)$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate sections or schedule of a finalized/archived quotation version.',
  'Finalized payment schedule UPDATE is blocked'
);
select throws_ok(
  $$delete from public.quotation_payment_schedules where quotation_version_id = (select ver_id from temp_test_ids)$$,
  'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate sections or schedule of a finalized/archived quotation version.',
  'Finalized payment schedule DELETE is blocked'
);

-- ----------------------------------------------------------------------------
-- 5. PDF Artifact Registration & Access Grant Issuance
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);

select throws_ok(
  $$insert into public.quotation_pdf_documents (
    quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
  ) values (
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'quotation-documents',
    '7b777777-7777-7777-7777-777777777777/v1-missing-hash.pdf',
    'ready',
    null,
    1024,
    '7b111111-1111-1111-1111-111111111111',
    now()
  )$$,
  '23514',
  null,
  'READY missing hash rejected'
);

select throws_ok(
  $$insert into public.quotation_pdf_documents (
    quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
  ) values (
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'quotation-documents',
    '7b777777-7777-7777-7777-777777777777/v1-missing-size.pdf',
    'ready',
    'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
    null,
    '7b111111-1111-1111-1111-111111111111',
    now()
  )$$,
  '23514',
  null,
  'READY missing size rejected'
);

select throws_ok(
  $$insert into public.quotation_pdf_documents (
    quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
  ) values (
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'quotation-documents',
    '7b777777-7777-7777-7777-777777777777/v1-missing-ready-at.pdf',
    'ready',
    'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
    1024,
    '7b111111-1111-1111-1111-111111111111',
    null
  )$$,
  '23514',
  null,
  'READY missing ready_at rejected'
);

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

select throws_ok(
  $$update public.quotation_pdf_documents
    set object_path = 'mutated-ready.pdf'
    where object_path = '7b777777-7777-7777-7777-777777777777/v1.pdf'$$,
  'QUOTATION_PDF_IMMUTABLE: READY quotation PDF documents cannot be mutated.',
  'READY PDF mutation is rejected'
);

select throws_ok(
  $$insert into public.quotation_pdf_documents (
    quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
  ) values (
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'quotation-documents',
    '7b777777-7777-7777-7777-777777777777/v1-dup.pdf',
    'ready',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    2048,
    '7b111111-1111-1111-1111-111111111111',
    now()
  )$$,
  '23505',
  null,
  'Duplicate PDF artifact per version is rejected'
);

select is(
  has_function_privilege('authenticated', 'public.issue_quotation_access_grant_internal(uuid,uuid,uuid,text,text,boolean)', 'execute'),
  false,
  'Authenticated cannot execute internal grant mint'
);
select is(
  has_function_privilege('anon', 'public.issue_quotation_access_grant_internal(uuid,uuid,uuid,text,text,boolean)', 'execute'),
  false,
  'Anon cannot execute internal grant mint'
);
select is(
  has_function_privilege('service_role', 'public.issue_quotation_access_grant_internal(uuid,uuid,uuid,text,text,boolean)', 'execute'),
  true,
  'service_role can execute internal grant mint'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.issue_quotation_access_grant_internal(
    '7b333333-3333-3333-3333-333333333333'::uuid,
    '7baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'd86e306dc2c559b331a0572a024c325ef442003faa73017ea13c9f00180b0ab1',
    false
  )$$,
  '42501',
  null,
  'Authenticated direct call of internal grant mint is permission denied'
);
reset role;

select set_config('role', 'postgres', true);
select is(
  (public.issue_quotation_access_grant_internal(
    '7b333333-3333-3333-3333-333333333333'::uuid,
    '7baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    false
  )->>'grant_id'),
  '7baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Persisted grant id matches HMAC identity grant id'
);

select is(
  (public.issue_quotation_access_grant_internal(
    '7b333333-3333-3333-3333-333333333333'::uuid,
    '7bffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    false
  )->>'grant_id'),
  '7baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Normal send reuses the one active grant'
);

select is(
  (public.issue_quotation_access_grant_internal(
    '7b333333-3333-3333-3333-333333333333'::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
    'cccccccccccccccccccccccccccccccc',
    'd86e306dc2c559b331a0572a024c325ef442003faa73017ea13c9f00180b0ab1',
    true
  )->>'grant_id'),
  '7bcccccc-cccc-cccc-cccc-cccccccccccc',
  'Explicit reissue persists the new grant id'
);

select set_config('role', 'postgres', true);
select is(
  (select count(*)::integer from public.quotation_access_grants where quotation_version_id = (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1) and revoked_at is null),
  1,
  'Exactly one active grant remains after reissue'
);

select isnt(
  (select revoked_at from public.quotation_access_grants where id = '7baaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  null,
  'Reissue revokes the previous active grant'
);

-- ----------------------------------------------------------------------------
-- 5b. Canonical Phase 6B quotation send-intent
-- ----------------------------------------------------------------------------
select set_config('role', 'postgres', true);

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values ('7b666666-6666-6666-6666-666666666666', 'whatsapp', '+919876543210', true);

select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:7b:1101:wamid.Q7B001',
  p_event_hash => repeat('a', 64),
  p_envelope_hash => repeat('b', 64),
  p_waba_id => '9101',
  p_phone_number_id => '1101',
  p_display_phone_number => '+919800000001',
  p_provider_message_id => 'wamid.Q7B001',
  p_customer_e164 => '+919876543210',
  p_recipient_e164 => '+919800000001',
  p_display_name_snapshot => 'Test Client 7B',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Inbound quotation enquiry',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-13T10:00:00+00:00'::timestamptz
);

select * from public.ingest_meta_whatsapp_message(
  p_event_key => 'msg:7b:1101:wamid.Q7BWRONG',
  p_event_hash => repeat('c', 64),
  p_envelope_hash => repeat('d', 64),
  p_waba_id => '9101',
  p_phone_number_id => '1101',
  p_display_phone_number => '+919800000001',
  p_provider_message_id => 'wamid.Q7BWRONG',
  p_customer_e164 => '+919000111222',
  p_recipient_e164 => '+919800000001',
  p_display_name_snapshot => 'Wrong Lead',
  p_provider_message_type => 'text',
  p_normalized_message_type => 'text',
  p_body_text => 'Unrelated inbound',
  p_content => '{}'::jsonb,
  p_context_provider_message_id => null,
  p_provider_timestamp => '2026-08-13T10:01:00+00:00'::timestamptz
);

update public.whatsapp_conversations
set lead_id = '7b777777-7777-7777-7777-777777777777'::uuid,
    contact_id = '7b666666-6666-6666-6666-666666666666'::uuid
where customer_e164 = '+919876543210';

select set_config('test.conv_7b', (select id::text from public.whatsapp_conversations where customer_e164 = '+919876543210' limit 1), true);
select set_config('test.wrong_conv_7b', (select id::text from public.whatsapp_conversations where customer_e164 = '+919000111222' limit 1), true);
select set_config(
  'test.v1_id',
  (select id::text from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 1),
  true
);

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$select public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.conv_7b')::uuid,
    'quotation-send:' || current_setting('test.v1_id') || ':7bcccccc-cccc-cccc-cccc-cccccccccccc'
  )$$,
  'denied_missing_consent',
  'Missing WhatsApp consent denies quotation send'
);

select set_config('role', 'postgres', true);
insert into public.consent_events (
  contact_id, lead_id, purpose_code, channel, event_type, copy_version, notice_version, source, actor_type
) values (
  '7b666666-6666-6666-6666-666666666666',
  '7b777777-7777-7777-7777-777777777777',
  'WHATSAPP_SERVICE',
  'whatsapp',
  'granted',
  'whatsapp-service-v0.1-draft',
  'privacy-notice-v0.1-draft',
  'local-test',
  'staff'
);

update public.contacts set status = 'do_not_contact' where id = '7b666666-6666-6666-6666-666666666666';
select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.conv_7b')::uuid,
    'quotation-send-dnc'
  )$$,
  'denied_dnc',
  'DNC contact denies quotation send'
);

select set_config('role', 'postgres', true);
update public.contacts set status = 'active' where id = '7b666666-6666-6666-6666-666666666666';
update public.contact_channels
set status = 'suppressed'
where contact_id = '7b666666-6666-6666-6666-666666666666'
  and channel_type = 'whatsapp';

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.conv_7b')::uuid,
    'quotation-send-suppressed'
  )$$,
  'denied_channel_suppressed',
  'Suppressed WhatsApp channel denies quotation send'
);

select set_config('role', 'postgres', true);
update public.contact_channels
set status = 'active'
where contact_id = '7b666666-6666-6666-6666-666666666666'
  and channel_type = 'whatsapp';

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.wrong_conv_7b')::uuid,
    'quotation-send-wrong-conv'
  )$$,
  'CONVERSATION_LEAD_MISMATCH: Conversation is not linked to the quotation lead.',
  'Wrong conversation/lead is denied'
);

select set_config('request.jwt.claim.sub', '7b444444-4444-4444-4444-444444444444', true);
select throws_ok(
  $$select public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.conv_7b')::uuid,
    'quotation-send-unassigned'
  )$$,
  'FORBIDDEN: Sales Executive can only send quotations for assigned leads.',
  'Non-assigned Sales Executive is denied quotation send'
);

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select is(
  (select requested_by::text from public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.conv_7b')::uuid,
    'quotation-send:' || current_setting('test.v1_id') || ':7bcccccc-cccc-cccc-cccc-cccccccccccc'
  )),
  '7b333333-3333-3333-3333-333333333333',
  'Quotation send-intent requested_by is the real authenticated actor'
);

select is(
  (select eligibility_code from public.whatsapp_send_intents where requested_by = '7b333333-3333-3333-3333-333333333333' and idempotency_key like 'quotation-send:%'),
  'eligible',
  'Quotation send-intent eligibility_code is canonical eligible'
);

select is(
  (select id from public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.conv_7b')::uuid,
    'quotation-send:' || current_setting('test.v1_id') || ':7bcccccc-cccc-cccc-cccc-cccccccccccc'
  )),
  (select id from public.whatsapp_send_intents where requested_by = '7b333333-3333-3333-3333-333333333333' and idempotency_key like 'quotation-send:%' limit 1),
  'Stable duplicate quotation send returns the same intent'
);

select is(
  (select count(*)::integer from public.quotation_events where event_type = 'quotation.send_requested' and details->>'grant_id' = '7bcccccc-cccc-cccc-cccc-cccccccccccc'),
  1,
  'quotation.send_requested audit event exists for the send-intent'
);

select is(
  (select body_text like '%/q/%' or body_text ilike '%test_token_7b_%' from public.whatsapp_send_intents where idempotency_key like 'quotation-send:%' limit 1),
  false,
  'Persisted quotation send-intent body is redacted and has no bearer token'
);

select set_config('request.jwt.claim.sub', '7b222222-2222-2222-2222-222222222222', true);
select isnt(
  (select id from public.create_quotation_whatsapp_service_send_intent(
    current_setting('test.v1_id')::uuid,
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    current_setting('test.conv_7b')::uuid,
    'quotation-send-manager-broad'
  )),
  null,
  'Sales Manager broad scope is allowed for quotation send'
);

select lives_ok(
  $$select public.create_whatsapp_service_send_intent(
    current_setting('test.conv_7b')::uuid,
    'ordinary-6b-7b',
    'WHATSAPP_SERVICE',
    'Ordinary service body'
  )$$,
  'Ordinary Phase 6B send-intent path remains compatible'
);

select is(
  (select phone_number_id from public.whatsapp_conversations where id = current_setting('test.conv_7b')::uuid) is not null
    and (select count(*)::integer from public.whatsapp_conversations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) = 1,
  true,
  'Quotation send uses a real ingested conversation with no fabricated phone identity'
);

select set_config('onedecore.quotation_secure_send', '', true);
select throws_ok(
  $$select private.create_whatsapp_service_send_intent_impl_v2(
    current_setting('test.conv_7b')::uuid,
    'direct-v2-secure',
    'WHATSAPP_SERVICE',
    'x',
    null,
    'quotation_link',
    '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid
  )$$,
  'SECURE_CONTENT_FORBIDDEN: quotation secure send must use the quotation wrapper.',
  'Direct v2 secure-content call is forbidden without the quotation wrapper'
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
select set_config('role', 'postgres', true);
select isnt(
  (select revoked_at from public.quotation_access_grants where id = '7bcccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  null,
  'Creating new draft revision automatically revokes active access grant for version 1'
);

select throws_ok(
  $$insert into public.quotation_pdf_documents (
    quotation_id, quotation_version_id, bucket_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at
  ) values (
    (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid),
    (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 2),
    'quotation-documents',
    '7b777777-7777-7777-7777-777777777777/v2-draft.pdf',
    'pending',
    null,
    null,
    '7b111111-1111-1111-1111-111111111111',
    null
  )$$,
  'INVALID_VERSION_STATE: PDF artifacts can only be bound to finalized quotation versions.',
  'Non-finalized version PDF artifact is rejected'
);

select set_config('request.jwt.claim.sub', '7b333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

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

select set_config('role', 'postgres', true);
select issue_quotation_access_grant_internal(
  '7b333333-3333-3333-3333-333333333333'::uuid,
  '7bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7b777777-7777-7777-7777-777777777777'::uuid) and version_number = 2),
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '844cf259ca708252071dc80e0c66a0fc7654bfe947dea9c0b3f018120d07f819',
  false
);

-- ----------------------------------------------------------------------------
-- 8. Client Acceptance & Atomic Closed-Won CRM Integration
-- ----------------------------------------------------------------------------
-- Direct pipeline update guard test: Direct UPDATE to leads.status without transition context fails
select set_config('role', 'postgres', true);

select throws_ok(
  $$update public.leads set status = 'closed_won' where id = '7b777777-7777-7777-7777-777777777777'::uuid$$,
  'Direct lead pipeline mutation forbidden; use CRM RPCs',
  'Direct lead pipeline status update is forbidden by trg_leads_no_direct_pipeline_update'
);

select set_config('role', 'postgres', true);
update public.profiles set status = 'suspended' where id = '7b333333-3333-3333-3333-333333333333';

select set_config('role', 'anon', true);
select throws_ok(
  $$select public.accept_quotation_by_capability('test_token_7b_02', 'Test Client 7B', 'client7b@example.com')$$,
  'INELIGIBLE_SALES_EXECUTIVE: Assigned owner is inactive or is not a canonical Sales Executive.',
  'Inactive or non-sales assignee is denied on acceptance'
);

select set_config('role', 'postgres', true);
update public.profiles set status = 'active' where id = '7b333333-3333-3333-3333-333333333333';

-- Execute client acceptance via capability RPC
select set_config('role', 'anon', true);

select is(
  (public.accept_quotation_by_capability('test_token_7b_02', 'Test Client 7B', 'client7b@example.com')->>'success'),
  'true',
  'Client accepts commercial quotation via capability token'
);

select set_config('role', 'postgres', true);
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

select set_config('role', 'anon', true);
-- Test: Idempotent replay of same quotation acceptance
select is(
  (public.accept_quotation_by_capability('test_token_7b_02', 'Test Client 7B', 'client7b@example.com')->>'idempotent_replay'),
  'true',
  'Idempotent replay of same quotation acceptance returns idempotent_replay true'
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
select set_config('role', 'postgres', true);

select is(has_table_privilege('authenticated', 'public.quotation_access_grants', 'SELECT'), false, 'No authenticated SELECT on quotation_access_grants');
select is(has_table_privilege('authenticated', 'public.quotation_access_grants', 'INSERT'), false, 'No authenticated INSERT on quotation_access_grants');
select is(has_table_privilege('authenticated', 'public.quotation_access_grants', 'UPDATE'), false, 'No authenticated UPDATE on quotation_access_grants');
select is(has_table_privilege('authenticated', 'public.quotation_access_grants', 'DELETE'), false, 'No authenticated DELETE on quotation_access_grants');
select is(has_table_privilege('authenticated', 'public.quotation_pdf_documents', 'INSERT'), false, 'No authenticated INSERT on quotation_pdf_documents');
select is(has_table_privilege('authenticated', 'public.quotation_pdf_documents', 'UPDATE'), false, 'No authenticated UPDATE on quotation_pdf_documents');
select is(has_table_privilege('authenticated', 'public.quotation_pdf_documents', 'DELETE'), false, 'No authenticated DELETE on quotation_pdf_documents');
select is(has_table_privilege('authenticated', 'public.quotation_pdf_documents', 'SELECT'), true, 'Authenticated staff SELECT on quotation_pdf_documents is granted');
select is(has_function_privilege('authenticated', 'public.create_quotation_whatsapp_service_send_intent(uuid,uuid,uuid,text)', 'execute'), true, 'Authenticated can execute quotation secure send RPC');
select is(has_function_privilege('anon', 'public.create_quotation_whatsapp_service_send_intent(uuid,uuid,uuid,text)', 'execute'), false, 'Anon cannot execute quotation secure send RPC');
select is(
  (select count(*)::integer from public.permissions where code in ('quotations.approve', 'quotations.accept')),
  0,
  'quotations.approve and staff quotations.accept permissions are absent'
);
select is(
  (select b.public from storage.buckets b where b.id = 'quotation-documents'),
  false,
  'quotation-documents bucket is private'
);
select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public', 'private')
      and p.proname in (
        'issue_quotation_access_grant_internal',
        'create_quotation_whatsapp_service_send_intent',
        'create_whatsapp_service_send_intent_impl_v2',
        'reserve_quotation_pdf_document',
        'mark_quotation_pdf_document_ready',
        'enforce_quotation_pdf_document_invariants',
        'prevent_ready_quotation_pdf_mutation'
      )
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'
  ),
  0,
  'Phase 7B SECURITY DEFINER functions set search_path'
);

select is(
  (
    select count(*)::integer from (
      select 1 from public.quotation_access_grants
        where derivation_nonce in ('test_token_7b_01', 'test_token_7b_02')
           or capability_token_hash in ('test_token_7b_01', 'test_token_7b_02')
      union all
      select 1 from public.whatsapp_send_intents
        where body_text ilike '%test_token_7b_%' or body_text ilike '%/q/%'
      union all
      select 1 from public.whatsapp_messages
        where coalesce(body_text, '') ilike '%test_token_7b_%' or coalesce(body_text, '') ilike '%/q/%'
      union all
      select 1 from public.quotation_events
        where details::text ilike '%test_token_7b_%' or details::text ilike '%/q/%'
      union all
      select 1 from public.lead_events
        where coalesce(event_data::text, '') ilike '%test_token_7b_%' or coalesce(event_data::text, '') ilike '%/q/%'
      union all
      select 1 from public.lead_activities
        where coalesce(metadata::text, '') ilike '%test_token_7b_%'
           or coalesce(metadata::text, '') ilike '%/q/%'
           or coalesce(summary, '') ilike '%test_token_7b_%'
      union all
      select 1 from public.whatsapp_provider_dispatch_attempts
        where request_snapshot::text ilike '%test_token_7b_%'
           or response_snapshot::text ilike '%test_token_7b_%'
           or request_snapshot::text ilike '%/q/%'
           or response_snapshot::text ilike '%/q/%'
    ) hits
  ),
  0,
  'Known test tokens are absent from persistent ledgers'
);

select * from finish();
rollback;
