-- ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation pgTAP tests

begin;
select plan(31);

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
-- B. Permissions & RBAC Safety (No approve, no delete)
-- =============================================================================

select ok(exists(select 1 from public.permissions where code = 'quotations.read'), 'quotations.read permission exists');
select ok(exists(select 1 from public.permissions where code = 'quotations.create'), 'quotations.create permission exists');
select ok(exists(select 1 from public.permissions where code = 'quotations.edit'), 'quotations.edit permission exists');

select ok(not exists(select 1 from public.permissions where code = 'quotations.approve'), 'quotations.approve MUST NOT exist');
select ok(not exists(select 1 from public.permissions where code = 'quotations.delete'), 'quotations.delete MUST NOT exist');

select results_eq(
  $$select has_table_privilege('authenticated', 'private.quotation_idempotency_requests', 'SELECT')$$,
  array[false],
  'authenticated role cannot directly SELECT private idempotency ledger'
);

-- =============================================================================
-- C. Functional RPC Logic & Invariants Testing
-- =============================================================================

-- Setup test users and lead
insert into auth.users (id, instance_id, email, aud, role) values
  ('7a111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'exec@onedecore.in', 'authenticated', 'authenticated'),
  ('7a222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'other@onedecore.in', 'authenticated', 'authenticated');

update public.profiles set status = 'active', display_name = 'Test Executive' where id = '7a111111-1111-1111-1111-111111111111';
update public.profiles set status = 'active', display_name = 'Other Executive' where id = '7a222222-2222-2222-2222-222222222222';

insert into public.user_roles (user_id, role_id)
select '7a111111-1111-1111-1111-111111111111', id from public.roles where code = 'sales_executive';

insert into public.user_roles (user_id, role_id)
select '7a222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_executive';

insert into public.contacts (id, display_name, status)
values ('7a333333-3333-3333-3333-333333333333', 'Anil Gupta', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values ('7a333333-3333-3333-3333-333333333333', 'email', 'anil@example.com', true),
       ('7a333333-3333-3333-3333-333333333333', 'phone', '+919876543210', true);

insert into public.leads (
  id, contact_id, status, assigned_to, submitted_name, service_code, property_code, timeline_code, primary_source_id, entry_method
)
select
  '7a444444-4444-4444-4444-444444444444', '7a333333-3333-3333-3333-333333333333', 'assigned', '7a111111-1111-1111-1111-111111111111', 'Anil Gupta', 'complete-home-interiors', 'apartment-2bhk', 'ready-now', id, 'manual'
from public.lead_sources where code = 'manual_entry';

-- Set auth context as Sales Executive
select set_config('request.jwt.claim.sub', '7a111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);

-- Test 1: Create initial quotation draft
select matches(
  (public.create_quotation_draft('7a444444-4444-4444-4444-444444444444', '3BHK Villa Proposal', 'test_key_001')->>'quotationNumber'),
  '^OD-Q-[0-9]{4}-[0-9]{6,}$',
  'Quotation number matches format OD-Q-YYYY-SEQ6'
);

select is(
  (select count(*) from public.quotation_versions where status = 'draft'),
  1::bigint,
  '1 draft version created for lead'
);

-- Test 2: Idempotent replay
select is(
  (public.create_quotation_draft('7a444444-4444-4444-4444-444444444444', '3BHK Villa Proposal', 'test_key_001')->>'idempotentReplay'),
  'true',
  'Replaying same key returns idempotentReplay true'
);

-- Test 3: Save sections & items
select is(
  (public.save_quotation_draft_items(
    (select id from public.quotations where lead_id = '7a444444-4444-4444-4444-444444444444'),
    1,
    jsonb_build_array(
      jsonb_build_object(
        'sectionName', 'Living Room',
        'items', jsonb_build_array(
          jsonb_build_object('itemName', 'TV Console Unit', 'quantity', 1, 'unitOfMeasure', 'nos', 'unitRatePaise', 4500000),
          jsonb_build_object('itemName', 'Wooden Wall Paneling', 'quantity', 120.5, 'unitOfMeasure', 'sqft', 'unitRatePaise', 35000)
        )
      )
    )
  )->>'subtotalPaise')::bigint,
  8717500::bigint,
  'Subtotal in paise is correctly calculated (8717500)'
);

-- Test 4: Synthetic tax profile creation (as postgres context)
select set_config('role', 'postgres', true);
insert into public.quotation_tax_profiles (id, code, display_name, rate_percentage, is_active, created_by)
values ('7a555555-5555-5555-5555-555555555555', 'standard_tax', 'Standard GST 18%', 18.00, true, '7a111111-1111-1111-1111-111111111111');

select set_config('request.jwt.claim.sub', '7a111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);

-- Test 5: Apply tax profile & discount
select is(
  (public.update_quotation_draft(
    (select id from public.quotations where lead_id = '7a444444-4444-4444-4444-444444444444'),
    2,
    p_discount_type => 'flat',
    p_discount_value_paise => 217500,
    p_tax_profile_id => '7a555555-5555-5555-5555-555555555555'
  )->>'grandTotalPaise')::bigint,
  10030000::bigint,
  'Grand total paise equals 10030000 after flat discount & 18% GST'
);

-- Test 6: Payment schedule percentage mode
select is(
  (public.replace_quotation_payment_schedule(
    (select id from public.quotations where lead_id = '7a444444-4444-4444-4444-444444444444'),
    3,
    'percentage',
    jsonb_build_array(
      jsonb_build_object('milestoneName', 'Advance Booking', 'percentage', 10.00),
      jsonb_build_object('milestoneName', 'Design Approval', 'percentage', 40.00),
      jsonb_build_object('milestoneName', 'Material Delivery', 'percentage', 40.00),
      jsonb_build_object('milestoneName', 'Handover', 'percentage', 10.00)
    )
  )->>'isReconciled'),
  'true',
  'Payment schedule 100% is reconciled with grand total'
);

-- Test 7: Read DTO RPC
select is(
  (public.get_quotation_draft((select id from public.quotations where lead_id = '7a444444-4444-4444-4444-444444444444'))->>'rootStatus'),
  'active',
  'get_quotation_draft returns active root DTO'
);

-- Test 8: Archive draft
select is(
  (public.archive_quotation_draft(
    (select id from public.quotations where lead_id = '7a444444-4444-4444-4444-444444444444'),
    4
  )->>'status'),
  'archived',
  'Draft status updated to archived'
);

-- Test 9: Reopen draft version 2 under same root
select is(
  (public.create_quotation_draft('7a444444-4444-4444-4444-444444444444', 'Revised Villa Proposal', 'test_key_003')->>'versionNumber')::integer,
  2,
  'Reopening draft allocates monotonic version number 2 under same root'
);

-- Test 10: Event count in append-only event ledger
select is(
  (select count(*) from public.quotation_events),
  7::bigint,
  '7 commercial quotation domain events logged in append-only ledger'
);

select finish();
rollback;
