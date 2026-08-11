-- ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation pgTAP tests

begin;
select plan(55);

-- =============================================================================
-- A. Schema Presence & RLS Verification
-- =============================================================================

select ok(to_regclass('public.quotations') is not null, 'quotations table exists');
select ok(to_regclass('public.quotation_tax_profiles') is not null, 'quotation_tax_profiles table exists');
select ok(to_regclass('public.quotation_versions') is not null, 'quotation_versions table exists');
select ok(to_regclass('public.quotation_sections') is not null, 'quotation_sections table exists');
select ok(to_regclass('public.quotation_items') is not null, 'quotation_items table exists');
select ok(to_regclass('public.quotation_payment_schedules') is not null, 'quotation_payment_schedules table exists');
select ok(to_regclass('public.quotation_events') is not null, 'quotation_events table exists');
select ok(to_regclass('private.quotation_idempotency_requests') is not null, 'private quotation_idempotency_requests table exists');

select ok((select relrowsecurity from pg_class where relname = 'quotations'), 'quotations RLS enabled');
select ok((select relrowsecurity from pg_class where relname = 'quotation_tax_profiles'), 'quotation_tax_profiles RLS enabled');
select ok((select relrowsecurity from pg_class where relname = 'quotation_versions'), 'quotation_versions RLS enabled');
select ok((select relrowsecurity from pg_class where relname = 'quotation_sections'), 'quotation_sections RLS enabled');
select ok((select relrowsecurity from pg_class where relname = 'quotation_items'), 'quotation_items RLS enabled');
select ok((select relrowsecurity from pg_class where relname = 'quotation_payment_schedules'), 'quotation_payment_schedules RLS enabled');
select ok((select relrowsecurity from pg_class where relname = 'quotation_events'), 'quotation_events RLS enabled');

-- =============================================================================
-- B. Permissions, Privilege Hardening & RBAC Grants
-- =============================================================================

select ok(exists(select 1 from public.permissions where code = 'quotations.read'), 'quotations.read permission exists');
select ok(exists(select 1 from public.permissions where code = 'quotations.create'), 'quotations.create permission exists');
select ok(exists(select 1 from public.permissions where code = 'quotations.edit'), 'quotations.edit permission exists');

select ok(not exists(select 1 from public.permissions where code = 'quotations.approve'), 'quotations.approve MUST NOT exist');
select ok(not exists(select 1 from public.permissions where code = 'quotations.delete'), 'quotations.delete MUST NOT exist');

select results_eq(
  $$select has_table_privilege('authenticated', 'public.quotations', 'SELECT')$$,
  array[true],
  'authenticated role has SELECT privilege on public.quotations (protected by RLS)'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.quotations', 'INSERT')$$,
  array[false],
  'authenticated role CANNOT directly INSERT into public.quotations'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.quotations', 'UPDATE')$$,
  array[false],
  'authenticated role CANNOT directly UPDATE public.quotations'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'public.quotations', 'DELETE')$$,
  array[false],
  'authenticated role CANNOT directly DELETE public.quotations'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'private.quotation_idempotency_requests', 'SELECT')$$,
  array[false],
  'authenticated role CANNOT directly SELECT private idempotency ledger'
);

select results_eq(
  $$select has_sequence_privilege('authenticated', 'private.quotation_number_seq', 'USAGE')$$,
  array[false],
  'authenticated role CANNOT directly use private.quotation_number_seq'
);

-- Function EXECUTE grants assertions
select ok(
  has_function_privilege('authenticated', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'create_quotation_draft'), 'EXECUTE'),
  'authenticated role CAN EXECUTE public.create_quotation_draft'
);

select ok(
  has_function_privilege('authenticated', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'update_quotation_draft'), 'EXECUTE'),
  'authenticated role CAN EXECUTE public.update_quotation_draft'
);

select ok(
  has_function_privilege('authenticated', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'save_quotation_draft_items'), 'EXECUTE'),
  'authenticated role CAN EXECUTE public.save_quotation_draft_items'
);

select ok(
  has_function_privilege('authenticated', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'replace_quotation_payment_schedule'), 'EXECUTE'),
  'authenticated role CAN EXECUTE public.replace_quotation_payment_schedule'
);

select ok(
  has_function_privilege('authenticated', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'archive_quotation_draft'), 'EXECUTE'),
  'authenticated role CAN EXECUTE public.archive_quotation_draft'
);

select ok(
  has_function_privilege('authenticated', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_quotation_draft'), 'EXECUTE'),
  'authenticated role CAN EXECUTE public.get_quotation_draft'
);

select ok(
  not has_function_privilege('authenticated', (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'recalculate_quotation_totals'), 'EXECUTE'),
  'authenticated role CANNOT directly EXECUTE private.recalculate_quotation_totals'
);

-- =============================================================================
-- C. Functional RPC Logic, Invariants & Security Testing
-- =============================================================================

-- Setup test users and profiles
insert into auth.users (id, instance_id, email, aud, role) values
  ('7a111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'exec1@onedecore.in', 'authenticated', 'authenticated'),
  ('7a222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'exec2@onedecore.in', 'authenticated', 'authenticated'),
  ('7a333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'mgr@onedecore.in', 'authenticated', 'authenticated'),
  ('7a444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'designer@onedecore.in', 'authenticated', 'authenticated');

update public.profiles set status = 'active', display_name = 'Sales Exec 1' where id = '7a111111-1111-1111-1111-111111111111';
update public.profiles set status = 'active', display_name = 'Sales Exec 2' where id = '7a222222-2222-2222-2222-222222222222';
update public.profiles set status = 'active', display_name = 'Sales Manager' where id = '7a333333-3333-3333-3333-333333333333';
update public.profiles set status = 'active', display_name = 'Interior Designer' where id = '7a444444-4444-4444-4444-444444444444';

insert into public.user_roles (user_id, role_id)
select '7a111111-1111-1111-1111-111111111111', id from public.roles where code = 'sales_executive';

insert into public.user_roles (user_id, role_id)
select '7a222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_executive';

insert into public.user_roles (user_id, role_id)
select '7a333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_manager';

insert into public.user_roles (user_id, role_id)
select '7a444444-4444-4444-4444-444444444444', id from public.roles where code = 'interior_designer';

insert into public.contacts (id, display_name, status)
values ('7a555555-5555-5555-5555-555555555555', 'Anil Gupta', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values ('7a555555-5555-5555-5555-555555555555', 'email', 'anil@example.com', true),
       ('7a555555-5555-5555-5555-555555555555', 'phone', '+919876543210', true);

insert into public.leads (
  id, contact_id, status, assigned_to, submitted_name, service_code, property_code, timeline_code, primary_source_id, entry_method
)
select
  '7a666666-6666-6666-6666-666666666666', '7a555555-5555-5555-5555-555555555555', 'assigned', '7a111111-1111-1111-1111-111111111111', 'Anil Gupta', 'complete-home-interiors', 'apartment-2bhk', 'ready-now', id, 'manual'
from public.lead_sources where code = 'manual_entry';

-- Set auth context as Sales Executive 1
select set_config('request.jwt.claim.sub', '7a111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);

-- Test 1: Create initial quotation draft
select matches(
  (public.create_quotation_draft('7a666666-6666-6666-6666-666666666666'::uuid, '3BHK Villa Proposal'::text, 'test_key_001'::text)->>'quotationNumber'),
  '^OD-Q-[0-9]{4}-[0-9]{6,}$',
  'Quotation number matches format OD-Q-YYYY-SEQ6'
);

select is(
  (select count(*) from public.quotation_versions where status = 'draft'),
  1::bigint,
  '1 draft version created for lead'
);

-- Test 2: Idempotent replay create_quotation_draft
select is(
  (public.create_quotation_draft('7a666666-6666-6666-6666-666666666666'::uuid, '3BHK Villa Proposal'::text, 'test_key_001'::text)->>'idempotentReplay'),
  'true',
  'Replaying same key returns idempotentReplay true'
);

-- Test 3: Save sections & items with idempotency key
select is(
  (public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    1::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Living Room',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'TV Console Unit', 'quantity', 1, 'unitOfMeasure', 'nos', 'unitRatePaise', 4500000),
          jsonb_build_object('itemName', 'Wooden Wall Paneling', 'quantity', 120.5, 'unitOfMeasure', 'sqft', 'unitRatePaise', 35000)
        )
      )
    ),
    'item_key_001'::text
  )->>'subtotalPaise')::bigint,
  8717500::bigint,
  'Subtotal in paise is correctly calculated (8717500)'
);

-- Test 4: Replay save_quotation_draft_items with same key returns idempotentReplay true
select is(
  (public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    1::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Living Room',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'TV Console Unit', 'quantity', 1, 'unitOfMeasure', 'nos', 'unitRatePaise', 4500000),
          jsonb_build_object('itemName', 'Wooden Wall Paneling', 'quantity', 120.5, 'unitOfMeasure', 'sqft', 'unitRatePaise', 35000)
        )
      )
    ),
    'item_key_001'::text
  )->>'idempotentReplay'),
  'true',
  'Replaying save_quotation_draft_items with same key returns idempotentReplay true'
);

-- Test 5: Reusing item_key_001 with payload mismatch throws IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    1::bigint,
    jsonb_build_array(jsonb_build_object('sectionName', 'Different Section', 'items', jsonb_build_array())),
    'item_key_001'::text
  )$$,
  'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
  'Reusing idempotency key with different payload throws IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH'
);

-- Test 6: Over-discount update_quotation_draft throws QUOTATION_VALIDATION_FAILED
select throws_ok(
  $$select public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    2::bigint,
    p_discount_type => 'flat',
    p_discount_value_paise => 999999999::bigint
  )$$,
  'QUOTATION_VALIDATION_FAILED: Discount total cannot exceed subtotal',
  'Over-discount update_quotation_draft throws QUOTATION_VALIDATION_FAILED without silent clamping'
);

-- Synthetic tax profile creation (as postgres context)
select set_config('role', 'postgres', true);
insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
values ('7a777777-7777-7777-7777-777777777777', 'standard_tax', 'Standard GST 18%', 18.00, true, '7a111111-1111-1111-1111-111111111111');

select set_config('request.jwt.claim.sub', '7a111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);

-- Test 7: Apply tax profile & discount
select is(
  (public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    2::bigint,
    p_discount_type => 'flat',
    p_discount_value_paise => 217500::bigint,
    p_tax_profile_id => '7a777777-7777-7777-7777-777777777777'::uuid
  )->>'grandTotalPaise')::bigint,
  10030000::bigint,
  'Grand total paise equals 10030000 after flat discount & 18% GST'
);

-- Test 8: Payment schedule 90% sum sets amount_paise NULL for all milestones
select is(
  (public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    3::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', 50.00),
      jsonb_build_object('milestoneName', 'Design Approval', 'percentage', 40.00)
    )
  )->>'isReconciled'),
  'false',
  'Payment schedule 90% is NOT reconciled'
);

select is(
  (select count(*) from public.quotation_payment_schedules where amount_paise is not null),
  0::bigint,
  'Milestone amount_paise is NULL for all milestones when percentage sum is not 100%'
);

-- Test 9: Payment schedule 100% sum derives reconciled amount_paise
select is(
  (public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    4::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', 10.00),
      jsonb_build_object('milestoneName', 'Design Approval', 'percentage', 40.00),
      jsonb_build_object('milestoneName', 'Material Delivery', 'percentage', 40.00),
      jsonb_build_object('milestoneName', 'Handover', 'percentage', 10.00)
    ),
    'sched_key_001'::text
  )->>'isReconciled'),
  'true',
  'Payment schedule 100% is reconciled with grand total'
);

-- Test 10: Replay replace_quotation_payment_schedule
select is(
  (public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    4::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', 10.00),
      jsonb_build_object('milestoneName', 'Design Approval', 'percentage', 40.00),
      jsonb_build_object('milestoneName', 'Material Delivery', 'percentage', 40.00),
      jsonb_build_object('milestoneName', 'Handover', 'percentage', 10.00)
    ),
    'sched_key_001'::text
  )->>'idempotentReplay'),
  'true',
  'Replaying replace_quotation_payment_schedule returns idempotentReplay true'
);

-- Test 11: Amount mode payment schedule preserves authoritative amounts
select is(
  (public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'amount'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Advance Booking', 'amountPaise', 10030000)
    )
  )->>'isReconciled'),
  'true',
  'Amount mode payment schedule preserves authoritative amount matching grand total'
);

-- Test 12: Read DTO RPC
select is(
  (public.get_quotation_draft((select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid))->>'rootStatus'),
  'active',
  'get_quotation_draft returns active root DTO'
);

-- Test 13: Archive draft
select is(
  (public.archive_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    6::bigint
  )->>'status'),
  'archived',
  'Draft status updated to archived'
);

-- Test 14: Reopen draft version 2 under same root
select is(
  (public.create_quotation_draft('7a666666-6666-6666-6666-666666666666'::uuid, 'Revised Villa Proposal'::text, 'test_key_003'::text)->>'versionNumber')::integer,
  2,
  'Reopening draft allocates monotonic version number 2 under same root'
);

-- Test 15: Cross-executive denial for Executive 2
select set_config('request.jwt.claim.sub', '7a222222-2222-2222-2222-222222222222', true);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$select public.get_quotation_draft((select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid))$$,
  'QUOTATION_NOT_FOUND_OR_FORBIDDEN',
  'Executive 2 denied access to Executive 1 assigned lead quotation'
);

-- Test 16: Sales Manager can access Executive 1 draft
select set_config('request.jwt.claim.sub', '7a333333-3333-3333-3333-333333333333', true);
select set_config('role', 'authenticated', true);

select is(
  (public.get_quotation_draft((select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid))->>'rootStatus'),
  'active',
  'Sales Manager has broad access to view quotation draft'
);

-- Test 17: Interior Designer role denied quotation creation
select set_config('request.jwt.claim.sub', '7a444444-4444-4444-4444-444444444444', true);
select set_config('role', 'authenticated', true);

select throws_ok(
  $$select public.create_quotation_draft('7a666666-6666-6666-6666-666666666666'::uuid, 'Unauthorized Proposal'::text, 'test_key_des_1'::text)$$,
  'QUOTATION_NOT_FOUND_OR_FORBIDDEN',
  'Interior Designer role denied creating quotation draft'
);

-- Test 18: Reassigning lead to Executive 2 transfers draft access via test context override
select set_config('role', 'postgres', true);
select set_config('onedecore.crm_transition', '1', true);
update public.leads set assigned_to = '7a222222-2222-2222-2222-222222222222' where id = '7a666666-6666-6666-6666-666666666666';
select set_config('onedecore.crm_transition', '', true);

select set_config('request.jwt.claim.sub', '7a222222-2222-2222-2222-222222222222', true);
select set_config('role', 'authenticated', true);

select is(
  (public.get_quotation_draft((select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid))->>'rootStatus'),
  'active',
  'Executive 2 can access quotation draft after lead reassignment'
);

-- Test 19: Material events logged in append-only event ledger
select is(
  (select count(*) from public.quotation_events where event_type = 'quotation.version_created'),
  1::bigint,
  'quotation.version_created material event logged on version 2'
);

-- Test 20: Event audit ledger protects against UPDATE and DELETE
select set_config('role', 'postgres', true);

select throws_ok(
  $$delete from public.quotation_events$$,
  '55000',
  'quotation_events is append-only',
  'quotation_events table forbids DELETE'
);

select finish();
rollback;
