-- ONEDECORE P4 — interior room-wise quotation, database contract.
--
-- The arithmetic below comes from the owner's real quotation sample, so these
-- are regressions against a document that was actually sent.
--
-- The point of the whole exercise is that width, height, area and amount cannot
-- drift apart. Section E proves that by FORGING a payload — sending a quantity
-- and a line total that disagree with the dimensions — and showing the stored
-- row still matches the dimensions.

begin;
select plan(114);

-- Test helpers are defined BEFORE the role switch below: once the session is
-- `authenticated` it has no CREATE on schema public, which is correct.
create or replace function public.test_p4_quotation_id()
returns uuid language sql security definer set search_path = '' as $$
  select id from public.quotations where lead_id = '45333333-3333-4333-8333-333333333333'::uuid;
$$;
create or replace function public.test_p4_lock()
returns bigint language sql security definer set search_path = '' as $$
  select lock_version from public.quotation_versions
  where quotation_id = public.test_p4_quotation_id() and is_current_draft = true;
$$;
-- Deliberately NOT filtered on is_current_draft: section T finalizes the
-- version, and a helper that only saw the current draft would return null the
-- moment the flag was cleared.
create or replace function public.test_p4_version_id()
returns uuid language sql security definer set search_path = '' as $$
  select id from public.quotation_versions
  where quotation_id = public.test_p4_quotation_id()
  order by version_number desc
  limit 1;
$$;
create or replace function public.test_p4_hash()
returns text language sql security definer set search_path = '' as $$
  select private.compute_canonical_quotation_sha256(public.test_p4_version_id());
$$;
create table if not exists public.test_p4_stash (k text primary key, v text);
grant select, insert, update on public.test_p4_stash to authenticated;

create or replace function public.test_p4_stash_hash()
returns void language sql security definer set search_path = '' as $$
  insert into public.test_p4_stash (k, v) values ('hash', public.test_p4_hash())
  on conflict (k) do update set v = excluded.v;
$$;

create or replace function public.test_p4_stashed_hash()
returns text language sql security definer set search_path = '' as $$
  select v from public.test_p4_stash where k = 'hash';
$$;

/**
 * Runs the save twice against ONE captured lock version.
 *
 * The idempotency hash covers the expected lock version, so re-reading the lock
 * between the two calls would produce a different payload and a legitimate
 * IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH rather than the replay under test.
 */
create or replace function public.test_p4_idem_probe()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_lock bigint;
  v_payload jsonb;
  v_first jsonb;
  v_second jsonb;
begin
  v_lock := public.test_p4_lock();
  v_payload := jsonb_build_array(jsonb_build_object(
    'sectionName', 'IDEM',
    'items', jsonb_build_array(jsonb_build_object(
      'itemName', 'Mandir', 'calculationBasis', 'area',
      'widthFt', '2', 'heightFt', '7', 'unitRatePaise', 155000
    ))
  ));

  v_first := public.save_quotation_draft_items(
    public.test_p4_quotation_id(), v_lock, v_payload, 'p4_idem_1');
  v_second := public.save_quotation_draft_items(
    public.test_p4_quotation_id(), v_lock, v_payload, 'p4_idem_1');

  return (v_first->>'idempotentReplay') || '/' || (v_second->>'idempotentReplay');
end;
$$;

create or replace function public.test_p4_set_width(p_width numeric)
returns void language sql security definer set search_path = '' as $$
  update public.quotation_items
  set width_ft = p_width,
      quantity = private.quotation_derive_area_sqft(p_width, height_ft),
      line_total_paise = round(private.quotation_derive_area_sqft(p_width, height_ft) * unit_rate_paise)::bigint
  where item_name = 'Mandir';
$$;

-- -----------------------------------------------------------------------------
-- A. Schema
-- -----------------------------------------------------------------------------

select has_column('public', 'quotation_items', 'calculation_basis', 'calculation_basis exists');
select has_column('public', 'quotation_items', 'width_ft', 'width_ft exists');
select has_column('public', 'quotation_items', 'height_ft', 'height_ft exists');

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
   where conname = 'chk_quotation_items_calculation_basis'),
  'CHECK ((calculation_basis = ANY (ARRAY[''area''::text, ''quantity''::text, ''fixed''::text])))',
  'exactly three calculation bases'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'chk_quotation_items_area_shape'),
  'area rows are constrained to agree with their dimensions'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'chk_quotation_items_non_area_shape'),
  'non-area rows cannot carry dimensions'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'chk_quotation_items_fixed_shape'),
  'fixed rows are canonicalized'
);

-- There is deliberately NO separately editable area column: an area that can be
-- typed is an area that can disagree with the dimensions beside it.
select is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'quotation_items'
     and column_name in ('area_sqft', 'area', 'area_sq_ft')),
  0,
  'area is derived, never a stored editable column'
);

-- -----------------------------------------------------------------------------
-- B. The derivation rule
-- -----------------------------------------------------------------------------

select is(private.quotation_derive_area_sqft(10.5, 2.5), 26.250::numeric, '10.5 x 2.5 = 26.25 sq.ft');
select is(private.quotation_derive_area_sqft(15.5, 2.5), 38.750::numeric, '15.5 x 2.5 = 38.75 sq.ft');
select is(private.quotation_derive_area_sqft(11.25, 7), 78.750::numeric, '11.25 x 7 = 78.75 sq.ft');
select is(private.quotation_derive_area_sqft(4.5, 7), 31.500::numeric, '4.5 x 7 = 31.5 sq.ft');
select is(private.quotation_derive_area_sqft(2, 7), 14.000::numeric, '2 x 7 = 14 sq.ft');
select is(private.quotation_derive_area_sqft(null, 7), null, 'a missing dimension derives nothing');

-- -----------------------------------------------------------------------------
-- C. Fixtures
-- -----------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role) values
  ('45111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', '45-exec@onedecore.in', 'authenticated', 'authenticated');

update public.profiles set status = 'active', display_name = 'P4 Sales Exec'
where id = '45111111-1111-4111-8111-111111111111';

insert into public.user_roles (user_id, role_id)
select '45111111-1111-4111-8111-111111111111', id from public.roles where code = 'sales_executive';

insert into public.contacts (id, display_name, status)
values ('45222222-2222-4222-8222-222222222222', 'Interior Client', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values ('45222222-2222-4222-8222-222222222222', 'phone', '+919812345670', true);

insert into public.leads (
  id, contact_id, status, assigned_to, submitted_name, service_code, property_code, timeline_code, primary_source_id, entry_method
)
select
  '45333333-3333-4333-8333-333333333333', '45222222-2222-4222-8222-222222222222', 'assigned',
  '45111111-1111-4111-8111-111111111111', 'Interior Client', 'complete-home-interiors',
  'apartment-2bhk', 'immediate', id, 'manual'
from public.lead_sources where code = 'manual_entry';

select set_config('request.jwt.claim.sub', '45111111-1111-4111-8111-111111111111', true);
select set_config('role', 'authenticated', true);

select lives_ok(
  $q$select public.create_quotation_draft(
      '45333333-3333-4333-8333-333333333333'::uuid, 'Interior Estimate'::text, 'p4_key_001'::text)$q$,
  'a quotation draft is created'
);

-- -----------------------------------------------------------------------------
-- D. The owner's real quotation, saved through the RPC
-- -----------------------------------------------------------------------------

select lives_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(),
      public.test_p4_lock(),
      jsonb_build_array(
        jsonb_build_object(
          'sectionName', 'KITCHEN',
          'items', jsonb_build_array(
            jsonb_build_object('itemName','Carcass','calculationBasis','area','widthFt','10.5','heightFt','2.5','unitRatePaise',155000),
            jsonb_build_object('itemName','Overhead','calculationBasis','area','widthFt','15.5','heightFt','2.5','unitRatePaise',155000),
            jsonb_build_object('itemName','Tandem','calculationBasis','quantity','quantity','5','unitOfMeasure','nos','unitRatePaise',450000)
          )
        ),
        jsonb_build_object(
          'sectionName', 'GUEST ROOM',
          'items', jsonb_build_array(
            jsonb_build_object('itemName','Wardrobe','calculationBasis','area','widthFt','11.25','heightFt','7','unitRatePaise',155000),
            jsonb_build_object('itemName','TV Unit','calculationBasis','fixed','unitRatePaise',1480000)
          )
        )
      )
    )$q$,
  'a room-wise interior estimate saves'
);

select is(
  (select quantity from public.quotation_items where item_name = 'Carcass'),
  26.250::numeric,
  'Carcass quantity IS the derived area, 26.25 sq.ft'
);
select is(
  (select unit_of_measure from public.quotation_items where item_name = 'Carcass'),
  'sqft',
  'the server sets the canonical area unit'
);
select is(
  (select line_total_paise from public.quotation_items where item_name = 'Carcass'),
  4068750::bigint,
  'Carcass = Rs.40,687.50'
);
select is(
  (select line_total_paise from public.quotation_items where item_name = 'Overhead'),
  6006250::bigint,
  'Overhead = Rs.60,062.50'
);
select is(
  (select line_total_paise from public.quotation_items where item_name = 'Wardrobe'),
  12206250::bigint,
  'Guest Wardrobe = Rs.1,22,062.50'
);
select is(
  (select line_total_paise from public.quotation_items where item_name = 'Tandem'),
  2250000::bigint,
  'Tandem 5 nos = Rs.22,500'
);
select is(
  (select line_total_paise from public.quotation_items where item_name = 'TV Unit'),
  1480000::bigint,
  'TV Unit fixed = Rs.14,800'
);

-- FIXED canonicalization keeps the pre-existing total invariant true.
select is(
  (select quantity from public.quotation_items where item_name = 'TV Unit'),
  1.000::numeric,
  'a fixed item is one unit'
);
select is(
  (select unit_of_measure from public.quotation_items where item_name = 'TV Unit'),
  'fixed',
  'a fixed item carries the fixed unit'
);
select ok(
  (select width_ft is null and height_ft is null from public.quotation_items where item_name = 'TV Unit'),
  'a fixed item carries no dimensions'
);
select ok(
  (select width_ft is null and height_ft is null from public.quotation_items where item_name = 'Tandem'),
  'a quantity item carries no dimensions'
);

-- Room and quotation totals are exact.
select is(
  (select subtotal_paise from public.quotation_sections where section_name = 'KITCHEN'),
  (4068750 + 6006250 + 2250000)::bigint,
  'KITCHEN room subtotal is exact'
);
select is(
  (select subtotal_paise from public.quotation_sections where section_name = 'GUEST ROOM'),
  (12206250 + 1480000)::bigint,
  'GUEST ROOM room subtotal is exact'
);
select is(
  (select subtotal_paise from public.quotation_versions
   where quotation_id = public.test_p4_quotation_id() and is_current_draft = true),
  (4068750 + 6006250 + 2250000 + 12206250 + 1480000)::bigint,
  'quotation subtotal is the exact sum of the rooms'
);

-- The read model returns the derived area and the room area total.
select is(
  ((public.get_quotation_draft(public.test_p4_quotation_id())
    -> 'version' -> 'sections' -> 0 -> 'items' -> 0 ->> 'areaSqFt')::numeric),
  26.250::numeric,
  'the read model exposes the DERIVED area'
);
select is(
  ((public.get_quotation_draft(public.test_p4_quotation_id())
    -> 'version' -> 'sections' -> 0 ->> 'areaSubtotalSqFt')::numeric),
  65.000::numeric,
  'the read model exposes the room area total'
);
select is(
  ((public.get_quotation_draft(public.test_p4_quotation_id())
    -> 'version' -> 'sections' -> 0 -> 'items' -> 0 ->> 'calculationBasis')),
  'area',
  'the read model exposes the calculation basis'
);

-- -----------------------------------------------------------------------------
-- E. ANTI-TAMPER — a forged payload cannot move the numbers
-- -----------------------------------------------------------------------------

select lives_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(),
      public.test_p4_lock(),
      jsonb_build_array(
        jsonb_build_object(
          'sectionName', 'KITCHEN',
          'items', jsonb_build_array(
            jsonb_build_object(
              'itemName','Carcass','calculationBasis','area',
              'widthFt','10.5','heightFt','2.5','unitRatePaise',155000,
              -- Forged: a quantity, an area and a total that all disagree with
              -- the dimensions, plus a room subtotal for good measure.
              'quantity','999.000','areaSqFt','999','lineTotalPaise',1,
              'subtotalPaise',1
            )
          ),
          'subtotalPaise', 1
        )
      )
    )$q$,
  'a forged payload is accepted without complaint'
);

select is(
  (select quantity from public.quotation_items where item_name = 'Carcass'),
  26.250::numeric,
  'FORGED: the stored quantity is still the derived area, not 999'
);
select is(
  (select line_total_paise from public.quotation_items where item_name = 'Carcass'),
  4068750::bigint,
  'FORGED: the stored amount is still derived, not 1 paisa'
);
select is(
  (select subtotal_paise from public.quotation_sections where section_name = 'KITCHEN'),
  4068750::bigint,
  'FORGED: the room subtotal is recalculated, not accepted'
);

-- Dimensions must be present and positive.
select throws_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(), public.test_p4_lock(),
      jsonb_build_array(jsonb_build_object('sectionName','K','items',jsonb_build_array(
        jsonb_build_object('itemName','Bad','calculationBasis','area','widthFt','0','heightFt','7','unitRatePaise',1))))
    )$q$,
  'P0001',
  'QUOTATION_VALIDATION_FAILED: Width (ft) must be greater than zero',
  'a width of zero is refused'
);
select throws_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(), public.test_p4_lock(),
      jsonb_build_array(jsonb_build_object('sectionName','K','items',jsonb_build_array(
        jsonb_build_object('itemName','Bad','calculationBasis','area','widthFt','7','heightFt','0','unitRatePaise',1))))
    )$q$,
  'P0001',
  'QUOTATION_VALIDATION_FAILED: Height (ft) must be greater than zero',
  'a height of zero is refused'
);
select throws_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(), public.test_p4_lock(),
      jsonb_build_array(jsonb_build_object('sectionName','K','items',jsonb_build_array(
        jsonb_build_object('itemName','Bad','calculationBasis','area','heightFt','7','unitRatePaise',1))))
    )$q$,
  'P0001',
  'QUOTATION_VALIDATION_FAILED: Width (ft) is required with up to 3 decimal places',
  'a missing width is refused'
);
select throws_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(), public.test_p4_lock(),
      jsonb_build_array(jsonb_build_object('sectionName','K','items',jsonb_build_array(
        jsonb_build_object('itemName','Bad','calculationBasis','nonsense','unitRatePaise',1))))
    )$q$,
  'P0001',
  'QUOTATION_VALIDATION_FAILED: Invalid calculation basis',
  'an unknown calculation basis is refused'
);
select throws_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(), public.test_p4_lock(),
      jsonb_build_array(jsonb_build_object('sectionName','K','items',jsonb_build_array(
        jsonb_build_object('itemName','Bad','calculationBasis','quantity','quantity','5','unitOfMeasure','sqft','unitRatePaise',1))))
    )$q$,
  'P0001',
  'QUOTATION_VALIDATION_FAILED: Use the area or fixed basis for that unit',
  'the area unit is refused on the quantity basis'
);

-- A stale width cannot survive a basis switch: the RPC never reads dimensions
-- for a quantity item, and the constraint refuses to store them.
select lives_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(), public.test_p4_lock(),
      jsonb_build_array(jsonb_build_object('sectionName','K','items',jsonb_build_array(
        jsonb_build_object('itemName','Switched','calculationBasis','quantity','quantity','5',
                           'unitOfMeasure','nos','unitRatePaise',450000,
                           'widthFt','11.25','heightFt','7'))))
    )$q$,
  'a basis switch that still carries dimensions is accepted'
);
select ok(
  (select width_ft is null and height_ft is null from public.quotation_items where item_name = 'Switched'),
  'SWITCHED: the stale dimensions were dropped, not stored'
);
select is(
  (select line_total_paise from public.quotation_items where item_name = 'Switched'),
  2250000::bigint,
  'SWITCHED: the amount came from the quantity, not the stale dimensions'
);

-- -----------------------------------------------------------------------------
-- F. The constraints stand on their own, without the RPC
-- -----------------------------------------------------------------------------

-- As the OWNER: `authenticated` has no INSERT on quotation_items at all, which
-- is correct — items are only ever written through the RPC. These prove the
-- constraints stand even against a writer that bypasses it entirely.
reset role;

select throws_ok(
  $q$insert into public.quotation_items
     (section_id, item_name, calculation_basis, width_ft, height_ft, quantity,
      unit_of_measure, unit_rate_paise, line_total_paise, display_order)
     select id, 'Drifted', 'area', 10.5, 2.5, 999.000, 'sqft', 155000, 154845000, 99
     from public.quotation_sections limit 1$q$,
  '23514',
  'new row for relation "quotation_items" violates check constraint "chk_quotation_items_area_shape"',
  'a direct insert whose quantity disagrees with its dimensions is refused'
);

select throws_ok(
  $q$insert into public.quotation_items
     (section_id, item_name, calculation_basis, width_ft, height_ft, quantity,
      unit_of_measure, unit_rate_paise, line_total_paise, display_order)
     select id, 'Dimensioned Qty', 'quantity', 10.5, 2.5, 5.000, 'nos', 100, 500, 98
     from public.quotation_sections limit 1$q$,
  '23514',
  'new row for relation "quotation_items" violates check constraint "chk_quotation_items_non_area_shape"',
  'a quantity row carrying dimensions is refused'
);

select set_config('role', 'authenticated', true);

-- -----------------------------------------------------------------------------
-- G. Optimistic locking and idempotency are unchanged
-- -----------------------------------------------------------------------------

select throws_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_quotation_id(), 999999::bigint,
      jsonb_build_array(jsonb_build_object('sectionName','K','items','[]'::jsonb))
    )$q$,
  'P0002',
  'QUOTATION_VERSION_CONFLICT: Stale lock version',
  'a stale lock version is still rejected'
);

select is(
  public.test_p4_idem_probe(),
  'false/true',
  'the first save is not a replay; the same key replayed returns the stored result'
);

select is(
  (select line_total_paise from public.quotation_items where item_name = 'Mandir'),
  2170000::bigint,
  'Mandir 2 x 7 = Rs.21,700'
);

-- -----------------------------------------------------------------------------
-- H. The canonical hash covers the measurements
-- -----------------------------------------------------------------------------

select ok(public.test_p4_hash() is not null, 'the canonical hash is computable');

select lives_ok(
  $q$select public.test_p4_stash_hash()$q$,
  'the canonical hash is captured before the measurement changes'
);

select lives_ok(
  $q$select public.test_p4_set_width(3)$q$,
  'the Mandir width is changed from 2 ft to 3 ft'
);

select isnt(
  public.test_p4_hash(),
  public.test_p4_stashed_hash(),
  'changing a WIDTH changes the canonical hash — dimensions are attested'
);

-- -----------------------------------------------------------------------------
-- I. Access-grant reuse returns the PERSISTED derivation identity
-- -----------------------------------------------------------------------------
--
-- Without the nonce, a caller that is handed back an existing grant cannot
-- reproduce the token it was issued against, and the link it builds simply does
-- not work.

select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_quotation_access_grant_internal')
  like '%''derivation_nonce'', v_existing.derivation_nonce%',
  'a reused grant returns its persisted derivation nonce'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_quotation_access_grant_internal')
  like '%''capability_token_hash'', v_existing.capability_token_hash%',
  'a reused grant returns its persisted token hash for verification'
);

-- Still service-role only: this is the capability issuer.
select ok(
  not has_function_privilege('authenticated',
    'public.issue_quotation_access_grant_internal(uuid, uuid, uuid, text, text, boolean)', 'EXECUTE'),
  'the grant issuer is not callable by authenticated'
);

-- The finalized-only and READY-PDF-only preconditions are preserved.
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_quotation_access_grant_internal')
  like '%PDF_NOT_READY%',
  'a READY PDF is still required before a grant is issued'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_quotation_access_grant_internal')
  like '%INVALID_VERSION_STATE%',
  'grants are still finalized-only'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_quotation_access_grant_internal')
  like '%QUOTATION_ALREADY_ACCEPTED%',
  'an accepted quotation still refuses new grants'
);


-- -----------------------------------------------------------------------------
-- S. Service-role grant issuance honours the M54 access state
-- -----------------------------------------------------------------------------
--
-- `issue_quotation_access_grant_internal` runs as service_role and authorizes an
-- EXPLICIT actor id, so it never passes through RLS. Without the access-state
-- check an employment-backed user who is not_activated, credentials_ready or
-- revoked could still have a client capability link issued in their name.

reset role;

-- The Sales Executive fixture becomes employment-backed.
insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible,
   invite_reconciliation_state, access_state)
values
  ('45111111-1111-4111-8111-111111111111', 'P4-EXEC', 'Sales Executive',
   date '2026-01-01', false, 'none', 'not_activated');

select ok(
  not private.quotation_actor_has_permission(
    '45111111-1111-4111-8111-111111111111', 'quotations.send'),
  'NOT_ACTIVATED: an employment-backed actor cannot issue a client link'
);

update public.staff_employment_profiles
set access_state = 'credentials_ready', login_phone_e164 = '+919812345671',
    credentials_issued_at = now()
where staff_id = '45111111-1111-4111-8111-111111111111';

select ok(
  not private.quotation_actor_has_permission(
    '45111111-1111-4111-8111-111111111111', 'quotations.send'),
  'CREDENTIALS_READY: still cannot issue a client link'
);

update public.staff_employment_profiles
set access_state = 'revoked', access_revoked_at = now()
where staff_id = '45111111-1111-4111-8111-111111111111';

select ok(
  not private.quotation_actor_has_permission(
    '45111111-1111-4111-8111-111111111111', 'quotations.send'),
  'REVOKED: still cannot issue a client link'
);

update public.staff_employment_profiles
set access_state = 'active', access_revoked_at = null
where staff_id = '45111111-1111-4111-8111-111111111111';

select ok(
  private.quotation_actor_has_permission(
    '45111111-1111-4111-8111-111111111111', 'quotations.send'),
  'ACTIVE: a cleared Sales Executive keeps the permission'
);

-- The existing lead-scope rule is unchanged and still separate.
select ok(
  private.quotation_actor_can_send_for_lead(
    '45111111-1111-4111-8111-111111111111', '45111111-1111-4111-8111-111111111111'),
  'ACTIVE: lead scope is still evaluated on its own'
);

-- A Super Admin with NO employment row must be unaffected: `staff_access_denied`
-- returns false when no employment record exists.
insert into auth.users (id, instance_id, email, aud, role)
values ('45999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        '45-sa@onedecore.in', 'authenticated', 'authenticated');
update public.profiles set status = 'active' where id = '45999999-9999-4999-8999-999999999999';
insert into public.user_roles (user_id, role_id)
select '45999999-9999-4999-8999-999999999999', id from public.roles where code = 'super_admin';

select ok(
  not exists (
    select 1 from public.staff_employment_profiles
    where staff_id = '45999999-9999-4999-8999-999999999999'
  ),
  'the Super Admin fixture genuinely has no employment row'
);
select ok(
  private.quotation_actor_has_permission(
    '45999999-9999-4999-8999-999999999999', 'quotations.send'),
  'SUPER ADMIN without an employment row is preserved'
);

-- -----------------------------------------------------------------------------
-- T. An EXPIRED grant is never reused
-- -----------------------------------------------------------------------------
--
-- `get_quotation_by_capability` refuses a grant past `expires_at`, so returning
-- one as a successful "reuse" would hand the client a link the reader rejects.

-- Promote the fixture version to finalized with a READY document, which is what
-- the issuer requires. Done directly rather than through the finalize RPC: the
-- subject here is grant reuse, not finalization.
update public.quotation_versions
set status = 'finalized', is_current_draft = false, finalized_at = now()
where id = public.test_p4_version_id();

insert into public.quotation_pdf_documents
  (quotation_id, quotation_version_id, object_path, status, pdf_sha256, file_size_bytes, created_by, ready_at)
values (
  public.test_p4_quotation_id(),
  public.test_p4_version_id(),
  'p4/test.pdf',
  'ready',
  repeat('a', 64),
  1024,
  '45111111-1111-4111-8111-111111111111',
  now()
);

-- An unrevoked grant that has already EXPIRED.
insert into public.quotation_access_grants
  (id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash,
   expires_at, created_by)
values (
  '45aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  public.test_p4_quotation_id(),
  public.test_p4_version_id(),
  repeat('b', 64),
  repeat('c', 64),
  now() - interval '1 day',
  '45111111-1111-4111-8111-111111111111'
);

select is(
  (public.issue_quotation_access_grant_internal(
     '45111111-1111-4111-8111-111111111111',
     '45bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
     public.test_p4_version_id(),
     repeat('d', 64),
     repeat('e', 64),
     false
   ) ->> 'reused'),
  'false',
  'EXPIRED: an expired grant is NOT returned as a reusable success'
);

select is(
  (select count(*)::integer from public.quotation_access_grants
   where quotation_version_id = public.test_p4_version_id()
     and revoked_at is null),
  1,
  'EXPIRED: at most one live grant remains'
);
select isnt(
  (select revoked_at from public.quotation_access_grants
   where id = '45aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  null,
  'EXPIRED: the stale grant was revoked rather than left dangling'
);

-- A genuinely LIVE grant is still reused, with its persisted derivation identity.
select is(
  (public.issue_quotation_access_grant_internal(
     '45111111-1111-4111-8111-111111111111',
     '45cccccc-cccc-4ccc-8ccc-cccccccccccc',
     public.test_p4_version_id(),
     repeat('f', 64),
     repeat('0', 64),
     false
   ) ->> 'reused'),
  'true',
  'LIVE: an unexpired grant is still reused'
);
select is(
  (public.issue_quotation_access_grant_internal(
     '45111111-1111-4111-8111-111111111111',
     '45dddddd-dddd-4ddd-8ddd-dddddddddddd',
     public.test_p4_version_id(),
     repeat('f', 64),
     repeat('0', 64),
     false
   ) ->> 'derivation_nonce'),
  repeat('d', 64),
  'LIVE: reuse returns the PERSISTED nonce, not the proposed one'
);

-- A revoked employment state blocks issuance even through the service-role path.
update public.staff_employment_profiles
set access_state = 'revoked', access_revoked_at = now()
where staff_id = '45111111-1111-4111-8111-111111111111';

select throws_ok(
  $q$select public.issue_quotation_access_grant_internal(
      '45111111-1111-4111-8111-111111111111',
      '45eeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      public.test_p4_version_id(),
      repeat('9', 64),
      repeat('8', 64),
      true
    )$q$,
  'P0001',
  'FORBIDDEN: Permission quotations.send is required.',
  'REVOKED: the service-role issuer refuses, exactly as RLS would'
);

update public.staff_employment_profiles
set access_state = 'active', access_revoked_at = null
where staff_id = '45111111-1111-4111-8111-111111111111';

-- -----------------------------------------------------------------------------
-- U. The client capability read model carries the interior semantics
-- -----------------------------------------------------------------------------
--
-- The customer must accept the same commercial meaning printed in the finalized
-- PDF, which they cannot do if the read model only reports quantity and UOM.

select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_quotation_by_capability')
  like '%''calculation_basis'', qi.calculation_basis%',
  'the client read model exposes the calculation basis'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_quotation_by_capability')
  like '%''width_ft'', qi.width_ft%',
  'the client read model exposes width'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_quotation_by_capability')
  like '%private.quotation_derive_area_sqft(qi.width_ft, qi.height_ft)%',
  'the client read model exposes the DERIVED area'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_quotation_by_capability')
  like '%''area_subtotal_sqft''%',
  'the client read model exposes the room area total'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_quotation_by_capability')
  like '%''has_pdf''%',
  'the client read model reports document availability'
);
-- The tax identity stays FROZEN: a later rename of the live profile must not
-- change what a finalized document says.
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_quotation_by_capability')
  like '%v_version.tax_profile_snapshot->>''display_name''%',
  'the client read model uses the frozen tax snapshot'
);


-- -----------------------------------------------------------------------------
-- V. A revision carries AREA / QUANTITY / FIXED forward intact
-- -----------------------------------------------------------------------------
--
-- `create_quotation_revision` predates the interior columns. It cloned every
-- other item column and silently dropped calculation_basis, width_ft and
-- height_ft, so revising a 10.5 x 2.5 sq.ft AREA carcass produced a `quantity`
-- item with NULL dimensions: the money survived while the measurement that
-- justified it disappeared. This is a BEHAVIOURAL proof over the real RPCs,
-- not a source-string check.

reset role;

insert into public.contacts (id, display_name, status)
values ('45444444-4444-4444-8444-444444444444', 'Revision Client', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values ('45444444-4444-4444-8444-444444444444', 'phone', '+919812345672', true);

insert into public.leads (
  id, contact_id, status, assigned_to, submitted_name, service_code,
  property_code, timeline_code, primary_source_id, entry_method
)
select
  '45555555-5555-4555-8555-555555555555', '45444444-4444-4444-8444-444444444444',
  'assigned', '45111111-1111-4111-8111-111111111111', 'Revision Client',
  'complete-home-interiors', 'apartment-2bhk', 'immediate', id, 'manual'
from public.lead_sources where code = 'manual_entry';

-- Helpers are defined while still superuser: created under `authenticated`
-- they fail with permission denied for schema public.
create or replace function public.test_p4_rev_quotation_id() returns uuid
language sql stable as $fn$
  select id from public.quotations
  where lead_id = '45555555-5555-4555-8555-555555555555';
$fn$;

create or replace function public.test_p4_rev_lock() returns bigint
language sql stable as $fn$
  select lock_version from public.quotation_versions
  where quotation_id = public.test_p4_rev_quotation_id() and is_current_draft = true;
$fn$;

create or replace function public.test_p4_rev_source_id() returns uuid
language sql stable as $fn$
  select id from public.quotation_versions
  where quotation_id = public.test_p4_rev_quotation_id() and version_number = 1;
$fn$;

create or replace function public.test_p4_rev_item(p_version_id uuid, p_name text)
returns public.quotation_items language sql stable as $fn$
  select i.* from public.quotation_items i
  join public.quotation_sections s on s.id = i.section_id
  where s.quotation_version_id = p_version_id and i.item_name = p_name;
$fn$;

create or replace function public.test_p4_rev_new_id() returns uuid
language sql stable as $fn$
  select id from public.quotation_versions
  where quotation_id = public.test_p4_rev_quotation_id() and version_number = 2;
$fn$;

select set_config('request.jwt.claim.sub', '45111111-1111-4111-8111-111111111111', true);
select set_config('role', 'authenticated', true);

select lives_ok(
  $q$select public.create_quotation_draft(
      '45555555-5555-4555-8555-555555555555'::uuid, 'Revision Source'::text, 'p4_rev_001'::text)$q$,
  'REVISION: a source quotation draft is created'
);

-- The three bases, saved through the real server-authoritative RPC.
select lives_ok(
  $q$select public.save_quotation_draft_items(
      public.test_p4_rev_quotation_id(),
      public.test_p4_rev_lock(),
      jsonb_build_array(
        jsonb_build_object(
          'sectionName', 'MASTER BEDROOM',
          'items', jsonb_build_array(
            jsonb_build_object('itemName','Carcass','calculationBasis','area','widthFt','10.5','heightFt','2.5','unitRatePaise',155000),
            jsonb_build_object('itemName','Tandem','calculationBasis','quantity','quantity','5','unitOfMeasure','nos','unitRatePaise',450000),
            jsonb_build_object('itemName','TV Unit','calculationBasis','fixed','unitRatePaise',1480000)
          )
        )
      ))$q$,
  'REVISION: AREA, QUANTITY and FIXED are saved on the source'
);

-- Promoted to finalized directly, exactly as section T does. The subject here
-- is the revision clone, not the finalization gate, and finalization would
-- otherwise demand a full payment schedule fixture.
reset role;
update public.quotation_versions
set status = 'finalized', is_current_draft = false, finalized_at = now()
where id = public.test_p4_rev_source_id();
select set_config('role', 'authenticated', true);

select lives_ok(
  $q$select public.create_quotation_revision(public.test_p4_rev_source_id(), 'p4_rev_key_001')$q$,
  'REVISION: a revision is created from the finalized source'
);

-- The new draft.
select is(
  (select version_number from public.quotation_versions where id = public.test_p4_rev_new_id()),
  2,
  'REVISION: the new version is numbered 2'
);
select is(
  (select status from public.quotation_versions where id = public.test_p4_rev_new_id()),
  'draft',
  'REVISION: the new version is a draft'
);
select ok(
  (select is_current_draft from public.quotation_versions where id = public.test_p4_rev_new_id()),
  'REVISION: the new version is the current, editable draft'
);

-- AREA stays AREA, with its exact dimensions.
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Carcass')).calculation_basis,
  'area',
  'REVISION/AREA: basis is preserved, not defaulted to quantity'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Carcass')).width_ft,
  10.500::numeric,
  'REVISION/AREA: width is cloned exactly'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Carcass')).height_ft,
  2.500::numeric,
  'REVISION/AREA: height is cloned exactly'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Carcass')).quantity,
  26.250::numeric,
  'REVISION/AREA: the derived area is preserved'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Carcass')).unit_of_measure,
  'sqft',
  'REVISION/AREA: the unit is preserved'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Carcass')).line_total_paise,
  4068750::bigint,
  'REVISION/AREA: the amount is unchanged'
);

-- QUANTITY stays QUANTITY, with null dimensions.
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Tandem')).calculation_basis,
  'quantity',
  'REVISION/QUANTITY: basis is preserved'
);
select ok(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Tandem')).width_ft is null,
  'REVISION/QUANTITY: width stays null'
);
select ok(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Tandem')).height_ft is null,
  'REVISION/QUANTITY: height stays null'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Tandem')).quantity,
  5.000::numeric,
  'REVISION/QUANTITY: the quantity is preserved'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Tandem')).unit_of_measure,
  'nos',
  'REVISION/QUANTITY: the unit is preserved'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'Tandem')).line_total_paise,
  2250000::bigint,
  'REVISION/QUANTITY: the amount is unchanged'
);

-- FIXED stays FIXED: one unit, `fixed` UOM, rate equal to the amount.
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'TV Unit')).calculation_basis,
  'fixed',
  'REVISION/FIXED: basis is preserved'
);
select ok(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'TV Unit')).width_ft is null,
  'REVISION/FIXED: width stays null'
);
select ok(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'TV Unit')).height_ft is null,
  'REVISION/FIXED: height stays null'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'TV Unit')).quantity,
  1.000::numeric,
  'REVISION/FIXED: the quantity stays one'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'TV Unit')).unit_of_measure,
  'fixed',
  'REVISION/FIXED: the unit stays fixed'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'TV Unit')).unit_rate_paise,
  (public.test_p4_rev_item(public.test_p4_rev_new_id(), 'TV Unit')).line_total_paise,
  'REVISION/FIXED: the lump-sum rate still equals the amount'
);

-- The clone is additive: the finalized source is untouched.
select is(
  (public.test_p4_rev_item(public.test_p4_rev_source_id(), 'Carcass')).calculation_basis,
  'area',
  'REVISION: the finalized source item keeps its basis'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_source_id(), 'Carcass')).width_ft,
  10.500::numeric,
  'REVISION: the finalized source item keeps its width'
);
select is(
  (public.test_p4_rev_item(public.test_p4_rev_source_id(), 'Carcass')).quantity,
  26.250::numeric,
  'REVISION: the finalized source item keeps its area'
);
select is(
  (select status from public.quotation_versions where id = public.test_p4_rev_source_id()),
  'finalized',
  'REVISION: the source version is still finalized'
);
select ok(
  not (select is_current_draft from public.quotation_versions where id = public.test_p4_rev_source_id()),
  'REVISION: the source version is no longer the current draft'
);
select is(
  (select count(*)::integer from public.quotation_items i
   join public.quotation_sections s on s.id = i.section_id
   where s.quotation_version_id = public.test_p4_rev_source_id()),
  3,
  'REVISION: the source still holds exactly its three items'
);

-- The staff read model shows the revision as an interior estimate again.
select is(
  ((public.get_quotation_draft(public.test_p4_rev_quotation_id())
    -> 'version' -> 'sections' -> 0 -> 'items' -> 0 ->> 'calculationBasis')),
  'area',
  'REVISION: the draft read model reports AREA'
);
select is(
  ((public.get_quotation_draft(public.test_p4_rev_quotation_id())
    -> 'version' -> 'sections' -> 0 -> 'items' -> 0 ->> 'widthFt')::numeric),
  10.500::numeric,
  'REVISION: the draft read model reports the width'
);
select is(
  ((public.get_quotation_draft(public.test_p4_rev_quotation_id())
    -> 'version' -> 'sections' -> 0 -> 'items' -> 0 ->> 'heightFt')::numeric),
  2.500::numeric,
  'REVISION: the draft read model reports the height'
);
select is(
  (select subtotal_paise from public.quotation_versions where id = public.test_p4_rev_new_id()),
  7798750::bigint,
  'REVISION: totals are recalculated from the cloned lines'
);

-- Acceptance still closes the door on any further revision.
reset role;
insert into public.quotation_access_grants
  (id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash,
   expires_at, created_by)
select
  '45ffffff-ffff-4fff-8fff-ffffffffffff',
  public.test_p4_rev_quotation_id(),
  public.test_p4_rev_source_id(),
  repeat('7', 64),
  repeat('6', 64),
  now() + interval '7 days',
  '45111111-1111-4111-8111-111111111111';

insert into public.quotation_acceptances (
  quotation_id, lead_id, quotation_version_id, access_grant_id,
  accepted_by_name, accepted_at, credited_sales_executive_id,
  taxable_base_paise, sales_achievement_month
)
select
  public.test_p4_rev_quotation_id(),
  '45555555-5555-4555-8555-555555555555',
  public.test_p4_rev_source_id(),
  '45ffffff-ffff-4fff-8fff-ffffffffffff',
  'Revision Client',
  now(),
  '45111111-1111-4111-8111-111111111111',
  7798750,
  to_char(now(), 'YYYY-MM');
select set_config('role', 'authenticated', true);

select throws_ok(
  $q$select public.create_quotation_revision(public.test_p4_rev_source_id(), 'p4_rev_key_002')$q$,
  'P0001',
  'QUOTATION_ACCEPTED_IMMUTABLE: Cannot create revision for an accepted quotation.',
  'REVISION: an accepted quotation still refuses a new revision'
);

select * from finish();
rollback;
