-- ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation pgTAP tests

begin;
select plan(94);

-- Helper for reading private ledger snapshot size in pgTAP tests
create or replace function public.test_get_snapshot_size(p_key text)
returns integer language sql security definer set search_path = '' as $$
  select pg_column_size(response_snapshot)::integer
  from private.quotation_idempotency_requests
  where operation_code = 'save_quotation_draft_items' and idempotency_key = p_key;
$$;

-- Helper for triggering tax grand total overflow in pgTAP tests
create or replace function public.test_trigger_tax_grand_overflow()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_tax_id uuid := gen_random_uuid();
  v_quote_id uuid;
  v_lock bigint;
  v_actor uuid;
begin
  select id into v_quote_id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid;
  select lock_version into v_lock from public.quotation_versions where quotation_id = v_quote_id and is_current_draft = true;

  -- Save items to get a large subtotal = 6.0 * 10^18 paise (<= bigint max)
  perform public.save_quotation_draft_items(
    v_quote_id,
    v_lock,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'BigSection',
        'items', (
          select jsonb_agg(jsonb_build_object(
            'itemName', 'Item_' || g,
            'quantity', '1000000.000',
            'unitOfMeasure', 'nos',
            'unitRatePaise', 100000000000
          )) from generate_series(1, 60) as g
        )
      )
    )
  );

  select lock_version into v_lock from public.quotation_versions where quotation_id = v_quote_id and is_current_draft = true;
  select created_by into v_actor from public.quotations where id = v_quote_id;

  insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
  values (v_tax_id, 'overflow_tax', 'Overflow Tax', 99.99, true, v_actor);

  -- Apply tax profile that forces grand total > bigint max
  perform public.update_quotation_draft(
    p_quotation_id => v_quote_id,
    p_expected_lock_version => v_lock,
    p_tax_profile_id => v_tax_id
  );
end;
$$;

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
          jsonb_build_object('itemName', 'TV Console Unit', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 4500000),
          jsonb_build_object('itemName', 'Wooden Wall Paneling', 'quantity', '120.5', 'unitOfMeasure', 'sqft', 'unitRatePaise', 35000)
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
          jsonb_build_object('itemName', 'TV Console Unit', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 4500000),
          jsonb_build_object('itemName', 'Wooden Wall Paneling', 'quantity', '120.5', 'unitOfMeasure', 'sqft', 'unitRatePaise', 35000)
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
      jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', '50.00'),
      jsonb_build_object('milestoneName', 'Design Approval', 'percentage', '40.00')
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
      jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', '10.00'),
      jsonb_build_object('milestoneName', 'Design Approval', 'percentage', '40.00'),
      jsonb_build_object('milestoneName', 'Material Delivery', 'percentage', '40.00'),
      jsonb_build_object('milestoneName', 'Handover', 'percentage', '10.00')
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
      jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', '10.00'),
      jsonb_build_object('milestoneName', 'Design Approval', 'percentage', '40.00'),
      jsonb_build_object('milestoneName', 'Material Delivery', 'percentage', '40.00'),
      jsonb_build_object('milestoneName', 'Handover', 'percentage', '10.00')
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

-- Test 21: update_quotation_draft complete payload hash idempotency replay & mismatch check
select set_config('request.jwt.claim.sub', '7a222222-2222-2222-2222-222222222222', true);
select set_config('role', 'authenticated', true);

select is(
  (public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    1::bigint,
    p_scope_summary => '3BHK full interior package'::text,
    p_idempotency_key => 'update_key_001'::text
  )->>'idempotentReplay'),
  'false',
  'First update with key update_key_001 succeeds with idempotentReplay false'
);

select is(
  (public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    1::bigint,
    p_scope_summary => '3BHK full interior package'::text,
    p_idempotency_key => 'update_key_001'::text
  )->>'idempotentReplay'),
  'true',
  'Replaying exact same update payload returns idempotentReplay true'
);

select throws_ok(
  $$select public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    1::bigint,
    p_scope_summary => 'MODIFIED scope summary'::text,
    p_idempotency_key => 'update_key_001'::text
  )$$,
  'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
  'Reusing update idempotency key with modified scope_summary throws payload mismatch'
);

-- Test 21b: update_quotation_draft distinguishes p_inclusions NULL vs []
select public.update_quotation_draft(
  (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
  2::bigint,
  p_inclusions => null::text[],
  p_idempotency_key => 'update_key_null_inc'::text
);

select throws_ok(
  $$select public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    3::bigint,
    p_inclusions => array[]::text[],
    p_idempotency_key => 'update_key_null_inc'::text
  )$$,
  'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
  'Reusing update idempotency key with inclusions NULL vs empty array [] throws payload mismatch'
);

-- Test 21b2: update_quotation_draft distinguishes p_exclusions NULL vs []
select public.update_quotation_draft(
  (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
  3::bigint,
  p_exclusions => null::text[],
  p_idempotency_key => 'update_key_null_exc'::text
);

select throws_ok(
  $$select public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    4::bigint,
    p_exclusions => array[]::text[],
    p_idempotency_key => 'update_key_null_exc'::text
  )$$,
  'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
  'Reusing update idempotency key with exclusions NULL vs empty array [] throws payload mismatch'
);

-- Test 21c: quantity upper bound tests (1000000.000 accepted, 1000000.001 rejected)
select is(
  (public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    4::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Large Panel', 'quantity', '1000000.000', 'unitOfMeasure', 'sqft', 'unitRatePaise', 100)
        )
      )
    )
  )->>'lockVersion'),
  '5',
  'Quantity exactly equal to 1000000.000 max bound is accepted and bumps lockVersion'
);

select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Large Panel', 'quantity', '1000000.001', 'unitOfMeasure', 'sqft', 'unitRatePaise', 100)
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid quantity',
  'Quantity exceeding 1000000.000 max bound throws controlled validation error'
);

-- Test 21c: over-scale decimal validation (quantity >3 decimals, percentage >2 decimals)
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Sofa', 'quantity', '12.3456', 'unitOfMeasure', 'nos', 'unitRatePaise', 1000)
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Quantity cannot exceed 3 decimal places',
  'Over-scale quantity string (>3 decimals) throws controlled validation error'
);

select throws_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Booking', 'percentage', '33.333')
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Percentage cannot exceed 2 decimal places',
  'Over-scale percentage string (>2 decimals) throws controlled validation error'
);

-- Test 22: replace_quotation_payment_schedule percentage mode rejects non-null amountPaise
select throws_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Booking', 'percentage', '50.00', 'amountPaise', 50000)
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Milestone amount must be null in percentage mode',
  'Percentage mode payment schedule rejects non-null amountPaise'
);

-- Test 23: replace_quotation_payment_schedule amount mode rejects non-null percentage
select throws_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'amount'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Booking', 'amountPaise', 50000, 'percentage', '50.00')
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Milestone percentage must be null in amount mode',
  'Amount mode payment schedule rejects non-null percentage'
);

-- Test 24: replace_quotation_payment_schedule handles malformed percentage string cleanly
select throws_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Booking', 'percentage', 'invalid-pct-string')
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid milestone percentage',
  'Malformed percentage string throws controlled validation error'
);

-- Test 25: save_quotation_draft_items handles malformed quantity cleanly
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Sofa', 'quantity', 'bad-qty', 'unitOfMeasure', 'nos', 'unitRatePaise', 1000)
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid quantity',
  'Malformed quantity string throws controlled validation error'
);

-- Test 26: save_quotation_draft_items handles malformed unitRatePaise cleanly
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Sofa', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 'bad-rate')
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid unit rate',
  'Malformed unit rate string throws controlled validation error'
);

-- Test 27 (DB-PREAPPLY-1): Overlong description throws controlled validation error
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Sofa', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 1000, 'description', repeat('a', 2001))
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Line item description cannot exceed 2000 characters',
  'Overlong description throws controlled validation error'
);

-- Test 28 (DB-PREAPPLY-2): Overlong specifications throw controlled validation error
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Sofa', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 1000, 'specifications', repeat('b', 2001))
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Line item specifications cannot exceed 2000 characters',
  'Overlong specifications throw controlled validation error'
);

-- Test 29 (DB-PREAPPLY-3): Huge quantity string throws controlled validation error without 22003 overflow
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Sofa', 'quantity', '10000000.000', 'unitOfMeasure', 'nos', 'unitRatePaise', 1000)
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid quantity',
  'Huge quantity string throws controlled validation error without 22003 overflow'
);

-- Test 30 (DB-PREAPPLY-4): Huge unit rate throws controlled validation error without bigint overflow
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Hall',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Sofa', 'quantity', '1', 'unitOfMeasure', 'nos', 'unitRatePaise', 1000000000000000)
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid unit rate',
  'Huge unit rate string throws controlled validation error without bigint overflow'
);

-- Test 31 (DB-PREAPPLY-5): Percentage 1000.00 throws controlled validation error
select throws_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Advance', 'percentage', '1000.00')
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid milestone percentage',
  'Percentage 1000.00 throws controlled validation error'
);

-- Test 32 (DB-PREAPPLY-6): Huge milestone amount throws controlled validation error
select throws_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'amount'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Advance', 'amountPaise', 1000000000000000)
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Invalid milestone amount',
  'Huge milestone amount throws controlled validation error'
);

-- Test 33 (DB-PREAPPLY-7): Multiple milestone percentages summing >999.99 do not cause numeric overflow
select lives_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    5::bigint,
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'M1', 'percentage', '90.00'),
      jsonb_build_object('milestoneName', 'M2', 'percentage', '90.00')
    )
  )$$,
  'Percentage sum > 100 processes cleanly without numeric overflow'
);

-- =============================================================================
-- I. Recovery-Gate Entry Hardening Tests (DB-HARDEN-1 through 11)
-- =============================================================================

-- DB-HARDEN-1: 11 x 100.00% milestone schedule does not throw 22003 and derived amounts remain NULL
select lives_ok(
  $$select public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    (select lock_version from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true),
    'percentage'::text,
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'M1', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M2', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M3', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M4', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M5', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M6', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M7', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M8', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M9', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M10', 'percentage', '100.00'),
      jsonb_build_object('milestoneName', 'M11', 'percentage', '100.00')
    )
  )$$,
  '11 x 100.00% schedule processes cleanly without 22003 numeric overflow'
);

select results_eq(
  $$select count(*) from public.quotation_payment_schedules where amount_paise is not null and quotation_version_id = (select id from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true)$$,
  array[0::bigint],
  'Derived milestone amounts remain NULL when percentage sum is 1100.00%'
);

-- DB-HARDEN-2: Section aggregate exceeding bigint max throws controlled validation error
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    (select lock_version from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true),
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'HugeSection',
        'items', (
          select jsonb_agg(jsonb_build_object(
            'itemName', 'Item' || g,
            'quantity', '1000000.000',
            'unitOfMeasure', 'nos',
            'unitRatePaise', 100000000000
          ))
          from generate_series(1, 95) as g
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Section subtotal exceeds maximum representable amount',
  'Section aggregate exceeding bigint max throws controlled validation error'
);

-- DB-HARDEN-3: Normal safe line item save succeeds cleanly
select lives_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    (select lock_version from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true),
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Section1',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Item1', 'quantity', '10.000', 'unitOfMeasure', 'nos', 'unitRatePaise', 100000)
        )
      )
    )
  )$$,
  'Normal line item save succeeds cleanly'
);

-- DB-HARDEN-4: Tax profile fixture applied to quotation version
do $$
declare
  v_tax_id uuid := gen_random_uuid();
  v_quote_id uuid;
  v_lock bigint;
  v_actor uuid;
begin
  select id into v_quote_id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid;
  select lock_version into v_lock from public.quotation_versions where quotation_id = v_quote_id and is_current_draft = true;
  select created_by into v_actor from public.quotations where id = v_quote_id;

  set local role postgres;
  insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
  values (v_tax_id, 'huge_tax', 'Temp Huge Tax', 99.99, true, v_actor);
  reset role;
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

  -- Apply tax profile
  perform public.update_quotation_draft(
    p_quotation_id => v_quote_id,
    p_expected_lock_version => v_lock,
    p_tax_profile_id => v_tax_id
  );
end;
$$;

select ok(
  (select tax_rate_percentage from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true) = 99.99,
  'Temp tax profile applied to quotation version'
);

-- DB-HARDEN-5: Large but representable quote succeeds
select lives_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    (select lock_version from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true),
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Civil Work',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'Flooring', 'quantity', '1000.000', 'unitOfMeasure', 'sqft', 'unitRatePaise', 50000)
        )
      )
    )
  )$$,
  'Large representable quote save succeeds'
);

-- DB-HARDEN-6 through DB-HARDEN-14: Idempotency with large DTO (>8192 bytes), full DTO > 8192, compact snapshot <= 8192, DB lock equality, replay fresh DTO
do $$
declare
  v_quote_id uuid;
  v_lock bigint;
  v_sections jsonb := '[]'::jsonb;
  v_items jsonb;
  i integer;
  j integer;
  v_res1 jsonb;
  v_res2 jsonb;
  v_full_dto_size integer;
  v_snap_size integer;
  v_db_lock_after1 bigint;
  v_db_lock_after2 bigint;
  v_events_after1 integer;
  v_events_after2 integer;
begin
  select id into v_quote_id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid;
  select lock_version into v_lock from public.quotation_versions where quotation_id = v_quote_id and is_current_draft = true;

  for i in 1..5 loop
    v_items := '[]'::jsonb;
    for j in 1..20 loop
      v_items := v_items || jsonb_build_object(
        'itemName', 'Item ' || i || '.' || j,
        'description', 'Detailed specification text for item ' || i || '.' || j || ' with substantial notes to inflate the DTO size above 8192 bytes constraint',
        'specifications', 'Premium material grade A1 fire resistant moisture barrier compliant with BIS standards',
        'quantity', '10.000',
        'unitOfMeasure', 'sqft',
        'unitRatePaise', 15000
      );
    end loop;
    v_sections := v_sections || jsonb_build_object(
      'sectionName', 'Large Section ' || i,
      'items', v_items
    );
  end loop;

  -- Initial call
  v_res1 := public.save_quotation_draft_items(v_quote_id, v_lock, v_sections, 'idempotency-key-large-dto-test-100');
  v_full_dto_size := pg_column_size(v_res1->'dto');
  select lock_version into v_db_lock_after1 from public.quotation_versions where quotation_id = v_quote_id and is_current_draft = true;
  select count(*) into v_events_after1 from public.quotation_events where quotation_id = v_quote_id;

  -- Replay call with exact same key and payload
  v_res2 := public.save_quotation_draft_items(v_quote_id, v_lock, v_sections, 'idempotency-key-large-dto-test-100');
  select lock_version into v_db_lock_after2 from public.quotation_versions where quotation_id = v_quote_id and is_current_draft = true;
  select count(*) into v_events_after2 from public.quotation_events where quotation_id = v_quote_id;

  create temp table temp_idempotency_test_results (
    res1_replay boolean,
    res1_has_dto boolean,
    full_dto_size integer,
    snap_size integer,
    res2_replay boolean,
    res2_has_dto boolean,
    res_lock_same boolean,
    db_lock_same boolean,
    no_duplicate_event boolean
  ) on commit drop;

  insert into temp_idempotency_test_results values (
    (v_res1->>'idempotentReplay')::boolean,
    (v_res1->'dto' is not null),
    v_full_dto_size,
    public.test_get_snapshot_size('idempotency-key-large-dto-test-100'),
    (v_res2->>'idempotentReplay')::boolean,
    (v_res2->'dto' is not null),
    ((v_res2->>'lockVersion')::bigint = (v_res1->>'lockVersion')::bigint),
    (v_db_lock_after1 = v_db_lock_after2),
    (v_events_after1 = v_events_after2)
  );
end;
$$;

-- Test DB-HARDEN-6: Initial call returns idempotentReplay false
select ok(
  (select res1_replay from temp_idempotency_test_results) = false,
  'Initial large DTO mutation returns idempotentReplay false'
);

-- Test DB-HARDEN-7: Initial call returns DTO
select ok(
  (select res1_has_dto from temp_idempotency_test_results) = true,
  'Initial large DTO mutation returns DTO'
);

-- Test DB-HARDEN-8: Full response DTO size is > 8192 bytes
select ok(
  (select full_dto_size from temp_idempotency_test_results) > 8192,
  'Full response DTO size is > 8192 bytes'
);

-- Test DB-HARDEN-9: Stored snapshot <= 8192 bytes
select ok(
  (select snap_size from temp_idempotency_test_results) <= 8192,
  'Stored response snapshot size is <= 8192 bytes'
);

-- Test DB-HARDEN-10: Replay returns idempotentReplay true
select ok(
  (select res2_replay from temp_idempotency_test_results) = true,
  'Replay call returns idempotentReplay true'
);

-- Test DB-HARDEN-11: Replay returns fresh DTO
select ok(
  (select res2_has_dto from temp_idempotency_test_results) = true,
  'Replay call returns fresh DTO'
);

-- Test DB-HARDEN-12: Replay does not increment response lockVersion
select ok(
  (select res_lock_same from temp_idempotency_test_results) = true,
  'Replay call does not increment response lockVersion'
);

-- Test DB-HARDEN-13: Replay does not increment database lock_version
select ok(
  (select db_lock_same from temp_idempotency_test_results) = true,
  'Replay call does not increment database lock_version'
);

-- Test DB-HARDEN-14: Replay does not duplicate audit event
select ok(
  (select no_duplicate_event from temp_idempotency_test_results) = true,
  'Replay call does not duplicate audit event'
);

-- Test DB-HARDEN-15: Replay with same key + changed payload throws IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    (select lock_version from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true),
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'DifferentSection',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'ChangedItem', 'quantity', '1.000', 'unitOfMeasure', 'nos', 'unitRatePaise', 1000)
        )
      )
    ),
    'idempotency-key-large-dto-test-100'
  )$$,
  'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH',
  'Idempotency key reuse with changed payload throws IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH'
);

-- DB-FINAL-VERSION-BIGINT: Combined version subtotal > bigint max throws controlled validation error
select throws_ok(
  $$select public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid),
    (select lock_version from public.quotation_versions where quotation_id = (select id from public.quotations where lead_id = '7a666666-6666-6666-6666-666666666666'::uuid) and is_current_draft = true),
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Section1',
        'items', (
          select jsonb_agg(jsonb_build_object(
            'itemName', 'Item1_' || g,
            'quantity', '1000000.000',
            'unitOfMeasure', 'nos',
            'unitRatePaise', 100000000000
          )) from generate_series(1, 60) as g
        )
      ),
      jsonb_build_object(
        'sectionName', 'Section2',
        'items', (
          select jsonb_agg(jsonb_build_object(
            'itemName', 'Item2_' || g,
            'quantity', '1000000.000',
            'unitOfMeasure', 'nos',
            'unitRatePaise', 100000000000
          )) from generate_series(1, 60) as g
        )
      )
    )
  )$$,
  'QUOTATION_VALIDATION_FAILED: Version subtotal exceeds maximum representable amount',
  'Combined version subtotal exceeding bigint max throws controlled validation error'
);

-- DB-FINAL-TAX-GRAND-BIGINT: Tax profile pushing grand total > bigint max throws controlled validation error
select throws_ok(
  'select public.test_trigger_tax_grand_overflow()',
  'QUOTATION_VALIDATION_FAILED: Grand total exceeds maximum representable amount',
  'Tax profile pushing grand total over bigint max throws controlled validation error'
);

select finish();
rollback;
