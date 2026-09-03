-- ONEDECORE P4 — interior room-wise quotation productization
--
-- Forward-only. Every earlier migration, M54 included, is applied and immutable;
-- the functions below are corrected with `create or replace`, which is how a
-- correction ships under that discipline.
--
-- WHY THIS EXISTS
-- ---------------
-- ONEDECORE is an interior design and execution business. Its quotation is not
-- a generic line-item builder — it is a ROOM-WISE INTERIOR ESTIMATE:
--
--   Room -> work item -> width(ft) x height(ft) -> area(sq.ft) -> rate -> amount
--
-- The persisted table names (`quotation_sections`, `quotation_items`) are kept
-- for migration safety, but a section IS a room and an item IS an interior work
-- item. Product language, contracts, validation and UI say so.
--
-- THE DEFECT THIS CLOSES
-- ----------------------
-- `save_quotation_draft_items` trusted the client's `quantity` and computed
-- quantity x rate. For an area item that means width, height, area and amount
-- were four independently supplied numbers that could drift out of agreement —
-- a quotation could claim 11.25 x 7 and bill for 200 sq.ft. The server now
-- DERIVES area from the dimensions and derives the amount from that, so the
-- four values cannot disagree by construction.
--
-- Production currently holds 0 quotation_items, 0 quotation_sections and 0
-- non-draft versions (verified before writing this), so the backfill below has
-- nothing to guess at. It is still written deterministically because local and
-- CI databases do carry rows, and because a backfill that invents dimensions
-- would be worse than one that declines to.

-- -----------------------------------------------------------------------------
-- A. Calculation basis and interior dimensions
-- -----------------------------------------------------------------------------

alter table public.quotation_items
  add column if not exists calculation_basis text not null default 'quantity',
  add column if not exists width_ft numeric(10,3),
  add column if not exists height_ft numeric(10,3);

comment on column public.quotation_items.calculation_basis is
  'How this interior work item is priced: area (width x height in feet), quantity (count-based hardware/accessories) or fixed (lump sum). Drives which of width_ft/height_ft/quantity are meaningful.';
comment on column public.quotation_items.width_ft is
  'Interior work item width in FEET. Set only for calculation_basis = area. Never a separately editable area: quantity is derived from width x height.';
comment on column public.quotation_items.height_ft is
  'Interior work item height in FEET. Set only for calculation_basis = area.';

-- Legacy rows predate the basis. `fixed`-shaped rows are the only ones that can
-- be classified without guessing; everything else stays `quantity`, which is
-- exactly what it was being billed as. NO dimensions are invented — an area row
-- cannot be reconstructed from a quantity alone, and pretending otherwise would
-- put fabricated measurements on a client document.
update public.quotation_items
set calculation_basis = 'fixed'
where calculation_basis = 'quantity'
  and lower(trim(unit_of_measure)) in ('fixed', 'lump_sum', 'lumpsum')
  and quantity = 1
  and unit_rate_paise = line_total_paise;

alter table public.quotation_items
  drop constraint if exists chk_quotation_items_calculation_basis;

alter table public.quotation_items
  add constraint chk_quotation_items_calculation_basis check (
    calculation_basis = any (array['area', 'quantity', 'fixed'])
  );

-- AREA: both dimensions present and positive, and the billed quantity IS the
-- derived area. This is the invariant that makes width/height/area/amount
-- impossible to drift apart.
alter table public.quotation_items
  drop constraint if exists chk_quotation_items_area_shape;

alter table public.quotation_items
  add constraint chk_quotation_items_area_shape check (
    calculation_basis <> 'area'
    or (
      width_ft is not null and width_ft > 0
      and height_ft is not null and height_ft > 0
      and lower(trim(unit_of_measure)) = 'sqft'
      and quantity = round((width_ft * height_ft)::numeric, 3)
    )
  );

-- QUANTITY and FIXED carry no dimensions at all, so a stale width/height left
-- behind by a basis switch cannot survive.
alter table public.quotation_items
  drop constraint if exists chk_quotation_items_non_area_shape;

alter table public.quotation_items
  add constraint chk_quotation_items_non_area_shape check (
    calculation_basis = 'area'
    or (width_ft is null and height_ft is null)
  );

-- FIXED canonicalizes to one unit at the fixed amount, so the existing
-- line_total = round(quantity * rate) invariant continues to hold unchanged.
alter table public.quotation_items
  drop constraint if exists chk_quotation_items_fixed_shape;

alter table public.quotation_items
  add constraint chk_quotation_items_fixed_shape check (
    calculation_basis <> 'fixed'
    or (
      quantity = 1
      and lower(trim(unit_of_measure)) = 'fixed'
      and unit_rate_paise = line_total_paise
    )
  );

create index if not exists idx_quotation_items_calculation_basis
  on public.quotation_items (calculation_basis);

-- -----------------------------------------------------------------------------
-- B. The single derivation rule
-- -----------------------------------------------------------------------------

/**
 * area(sq.ft) = width(ft) x height(ft), rounded to 3 decimal places.
 *
 * Three decimals because `quantity` is numeric(10,3) and because a foot
 * measured to millimetre-ish precision is already beyond what a site tape
 * gives. The UI may DISPLAY two decimals; it must not round before this.
 */
create or replace function private.quotation_derive_area_sqft(
  p_width_ft numeric,
  p_height_ft numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_width_ft is null or p_height_ft is null then null
    else round((p_width_ft * p_height_ft)::numeric, 3)
  end;
$$;

comment on function private.quotation_derive_area_sqft(numeric, numeric) is
  'The ONE definition of interior area. Used by the save RPC and mirrored by the area CHECK constraint so the stored quantity can never disagree with the stored dimensions.';

revoke all on function private.quotation_derive_area_sqft(numeric, numeric) from public, anon;
grant execute on function private.quotation_derive_area_sqft(numeric, numeric) to authenticated;
alter function private.quotation_derive_area_sqft(numeric, numeric) owner to postgres;

-- -----------------------------------------------------------------------------
-- C. Server-authoritative save
-- -----------------------------------------------------------------------------
--
-- Reproduced from 20260812140000 with the permission check, optimistic lock,
-- durable idempotency, audit event, totals recalculation and draft-only rule
-- all unchanged. The item loop is what changes: it now branches on
-- `calculationBasis` and DERIVES what used to be accepted.
--
-- Client-supplied `area`, `lineTotalPaise`, `subtotalPaise` and any quantity
-- meant to override an area are IGNORED — not rejected with a message that
-- would teach a tamperer what to rename, simply never read.

create or replace function public.save_quotation_draft_items(
  p_quotation_id uuid,
  p_expected_lock_version bigint,
  p_sections jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_op_code text := 'save_quotation_draft_items';
  v_request_hash text;
  v_idempotency_rec record;
  v_lead_id uuid;
  v_version_rec record;
  v_sec_elem jsonb;
  v_item_elem jsonb;
  v_sec_id uuid;
  v_sec_name text;
  v_item_name text;
  v_uom text;
  v_basis text;
  v_width numeric(10,3);
  v_height numeric(10,3);
  v_sec_order integer := 0;
  v_item_order integer := 0;
  v_sec_count integer := 0;
  v_item_count integer := 0;
  v_line_qty numeric(10,3);
  v_raw_qty numeric;
  v_unit_rate bigint;
  v_raw_rate numeric;
  v_raw_line_total numeric;
  v_line_total bigint;
  v_new_lock_version bigint;
  v_result jsonb;
  v_bigint_max numeric := 9223372036854775807;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_edit(p_quotation_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
    raise exception 'QUOTATION_VALIDATION_FAILED: Rooms payload must be a JSON array' using errcode = 'P0001';
  end if;

  v_sec_count := jsonb_array_length(p_sections);
  if v_sec_count > 50 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Maximum 50 rooms allowed' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    if length(trim(p_idempotency_key)) > 128 then
      raise exception 'QUOTATION_VALIDATION_FAILED: Idempotency key too long' using errcode = 'P0001';
    end if;

    v_request_hash := encode(sha256(convert_to(
      p_quotation_id::text || '|' || p_expected_lock_version::text || '|' || p_sections::text || '|' || trim(p_idempotency_key),
      'UTF8'
    )), 'hex');

    perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text || '|' || v_op_code || '|' || trim(p_idempotency_key), 0));

    select * into v_idempotency_rec
    from private.quotation_idempotency_requests
    where actor_id = v_actor_id
      and operation_code = v_op_code
      and idempotency_key = trim(p_idempotency_key);

    if found then
      if v_idempotency_rec.request_hash = v_request_hash then
        return jsonb_build_object(
          'quotationId', v_idempotency_rec.quotation_id,
          'versionId', v_idempotency_rec.quotation_version_id,
          'lockVersion', (v_idempotency_rec.response_snapshot->>'lockVersion')::bigint,
          'subtotalPaise', (v_idempotency_rec.response_snapshot->>'subtotalPaise')::bigint,
          'discountTotalPaise', (v_idempotency_rec.response_snapshot->>'discountTotalPaise')::bigint,
          'taxableBasePaise', (v_idempotency_rec.response_snapshot->>'taxableBasePaise')::bigint,
          'taxTotalPaise', case when (v_idempotency_rec.response_snapshot->>'taxTotalPaise') is null then null else (v_idempotency_rec.response_snapshot->>'taxTotalPaise')::bigint end,
          'grandTotalPaise', case when (v_idempotency_rec.response_snapshot->>'grandTotalPaise') is null then null else (v_idempotency_rec.response_snapshot->>'grandTotalPaise')::bigint end,
          'idempotentReplay', true,
          'dto', public.get_quotation_draft(v_idempotency_rec.quotation_id)
        );
      else
        raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH' using errcode = 'P0001';
      end if;
    end if;
  end if;

  select lead_id into v_lead_id from public.quotations where id = p_quotation_id;

  select * into v_version_rec
  from public.quotation_versions
  where quotation_id = p_quotation_id
    and status = 'draft'
    and is_current_draft = true
  for update;

  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_version_rec.lock_version <> p_expected_lock_version then
    raise exception 'QUOTATION_VERSION_CONFLICT: Stale lock version' using errcode = 'P0002';
  end if;

  delete from public.quotation_items qi
  using public.quotation_sections qs
  where qi.section_id = qs.id and qs.quotation_version_id = v_version_rec.id;

  delete from public.quotation_sections where quotation_version_id = v_version_rec.id;

  for v_sec_elem in select * from jsonb_array_elements(p_sections)
  loop
    v_sec_name := trim(v_sec_elem->>'sectionName');
    if v_sec_name is null or length(v_sec_name) < 1 or length(v_sec_name) > 120 then
      raise exception 'QUOTATION_VALIDATION_FAILED: Invalid room name' using errcode = 'P0001';
    end if;

    insert into public.quotation_sections (quotation_version_id, section_name, display_order, subtotal_paise)
    values (v_version_rec.id, v_sec_name, v_sec_order, 0)
    returning id into v_sec_id;

    v_item_order := 0;
    if v_sec_elem->'items' is not null and jsonb_typeof(v_sec_elem->'items') = 'array' then
      v_item_count := jsonb_array_length(v_sec_elem->'items');
      if v_item_count > 100 then
        raise exception 'QUOTATION_VALIDATION_FAILED: Maximum 100 work items per room allowed' using errcode = 'P0001';
      end if;

      for v_item_elem in select * from jsonb_array_elements(v_sec_elem->'items')
      loop
        v_item_name := trim(v_item_elem->>'itemName');

        if v_item_name is null or length(v_item_name) < 1 or length(v_item_name) > 200 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid work item name' using errcode = 'P0001';
        end if;

        if (v_item_elem->>'description') is not null and length(trim(v_item_elem->>'description')) > 2000 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Line item description cannot exceed 2000 characters' using errcode = 'P0001';
        end if;

        if (v_item_elem->>'specifications') is not null and length(trim(v_item_elem->>'specifications')) > 2000 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Line item specifications cannot exceed 2000 characters' using errcode = 'P0001';
        end if;

        -- Rate is common to all three bases. For FIXED it IS the amount.
        if (v_item_elem->>'unitRatePaise') is null or (v_item_elem->>'unitRatePaise') !~ '^[0-9]+$' then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid unit rate' using errcode = 'P0001';
        end if;

        v_raw_rate := (v_item_elem->>'unitRatePaise')::numeric;
        if v_raw_rate < 0 or v_raw_rate > 100000000000 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid unit rate' using errcode = 'P0001';
        end if;
        v_unit_rate := v_raw_rate::bigint;

        v_basis := lower(trim(coalesce(v_item_elem->>'calculationBasis', 'quantity')));
        if v_basis not in ('area', 'quantity', 'fixed') then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid calculation basis' using errcode = 'P0001';
        end if;

        v_width := null;
        v_height := null;

        if v_basis = 'area' then
          -- Dimensions are the ONLY inputs. Area and amount are derived here and
          -- nowhere else; anything the client sent for them is not read.
          if (v_item_elem->>'widthFt') is null or (v_item_elem->>'widthFt') !~ '^[0-9]+(\.[0-9]{1,3})?$' then
            raise exception 'QUOTATION_VALIDATION_FAILED: Width (ft) is required with up to 3 decimal places' using errcode = 'P0001';
          end if;
          if (v_item_elem->>'heightFt') is null or (v_item_elem->>'heightFt') !~ '^[0-9]+(\.[0-9]{1,3})?$' then
            raise exception 'QUOTATION_VALIDATION_FAILED: Height (ft) is required with up to 3 decimal places' using errcode = 'P0001';
          end if;

          v_width := (v_item_elem->>'widthFt')::numeric;
          v_height := (v_item_elem->>'heightFt')::numeric;

          if v_width <= 0 or v_width > 10000 then
            raise exception 'QUOTATION_VALIDATION_FAILED: Width (ft) must be greater than zero' using errcode = 'P0001';
          end if;
          if v_height <= 0 or v_height > 10000 then
            raise exception 'QUOTATION_VALIDATION_FAILED: Height (ft) must be greater than zero' using errcode = 'P0001';
          end if;

          v_raw_qty := private.quotation_derive_area_sqft(v_width, v_height);
          if v_raw_qty <= 0 or v_raw_qty > 1000000.000 then
            raise exception 'QUOTATION_VALIDATION_FAILED: Derived area is out of range' using errcode = 'P0001';
          end if;

          v_line_qty := v_raw_qty;
          v_uom := 'sqft';

        elsif v_basis = 'fixed' then
          -- Canonicalized to one unit at the fixed amount, so the existing
          -- line_total = round(quantity * rate) invariant still holds.
          v_line_qty := 1;
          v_raw_qty := 1;
          v_uom := 'fixed';

        else
          v_uom := trim(v_item_elem->>'unitOfMeasure');
          if v_uom is null or length(v_uom) < 1 or length(v_uom) > 30 then
            raise exception 'QUOTATION_VALIDATION_FAILED: Unit is required' using errcode = 'P0001';
          end if;
          if lower(v_uom) in ('sqft', 'fixed') then
            raise exception 'QUOTATION_VALIDATION_FAILED: Use the area or fixed basis for that unit' using errcode = 'P0001';
          end if;

          if (v_item_elem->>'quantity') is null or (v_item_elem->>'quantity') !~ '^[0-9]+(\.[0-9]+)?$' then
            raise exception 'QUOTATION_VALIDATION_FAILED: Invalid quantity' using errcode = 'P0001';
          end if;
          if (v_item_elem->>'quantity') ~ '\.[0-9]{4,}$' then
            raise exception 'QUOTATION_VALIDATION_FAILED: Quantity cannot exceed 3 decimal places' using errcode = 'P0001';
          end if;

          v_raw_qty := (v_item_elem->>'quantity')::numeric;
          if v_raw_qty <= 0 or v_raw_qty > 1000000.000 then
            raise exception 'QUOTATION_VALIDATION_FAILED: Invalid quantity' using errcode = 'P0001';
          end if;
          v_line_qty := v_raw_qty;
        end if;

        v_raw_line_total := round((v_raw_qty * v_raw_rate)::numeric);
        if v_raw_line_total < 0 or v_raw_line_total > v_bigint_max then
          raise exception 'QUOTATION_VALIDATION_FAILED: Line item total exceeds maximum representable amount' using errcode = 'P0001';
        end if;
        v_line_total := v_raw_line_total::bigint;

        insert into public.quotation_items (
          section_id, item_name, description, specifications,
          calculation_basis, width_ft, height_ft,
          quantity, unit_of_measure, unit_rate_paise, line_total_paise, display_order
        ) values (
          v_sec_id,
          v_item_name,
          nullif(trim(v_item_elem->>'description'), ''),
          nullif(trim(v_item_elem->>'specifications'), ''),
          v_basis,
          v_width,
          v_height,
          v_line_qty,
          v_uom,
          v_unit_rate,
          v_line_total,
          v_item_order
        );

        v_item_order := v_item_order + 1;
      end loop;
    end if;

    v_sec_order := v_sec_order + 1;
  end loop;

  v_new_lock_version := v_version_rec.lock_version + 1;

  update public.quotation_versions set
    lock_version = v_new_lock_version,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_version_rec.id;

  perform private.recalculate_quotation_totals(v_version_rec.id);

  select * into v_version_rec from public.quotation_versions where id = v_version_rec.id;

  insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
  values (p_quotation_id, v_version_rec.id, v_lead_id, 'quotation.draft_updated', v_actor_id, jsonb_build_object(
    'lockVersion', v_new_lock_version,
    'subtotalPaise', v_version_rec.subtotal_paise,
    'grandTotalPaise', v_version_rec.grand_total_paise
  ));

  v_result := jsonb_build_object(
    'quotationId', p_quotation_id,
    'versionId', v_version_rec.id,
    'lockVersion', v_new_lock_version,
    'subtotalPaise', v_version_rec.subtotal_paise,
    'discountTotalPaise', v_version_rec.discount_total_paise,
    'taxableBasePaise', v_version_rec.taxable_base_paise,
    'taxTotalPaise', v_version_rec.tax_total_paise,
    'grandTotalPaise', v_version_rec.grand_total_paise
  );

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    insert into private.quotation_idempotency_requests (actor_id, operation_code, idempotency_key, request_hash, quotation_id, quotation_version_id, response_snapshot)
    values (v_actor_id, v_op_code, trim(p_idempotency_key), v_request_hash, p_quotation_id, v_version_rec.id, v_result);
  end if;

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'versionId', v_version_rec.id,
    'lockVersion', v_new_lock_version,
    'subtotalPaise', v_version_rec.subtotal_paise,
    'discountTotalPaise', v_version_rec.discount_total_paise,
    'taxableBasePaise', v_version_rec.taxable_base_paise,
    'taxTotalPaise', v_version_rec.tax_total_paise,
    'grandTotalPaise', v_version_rec.grand_total_paise,
    'idempotentReplay', false,
    'dto', public.get_quotation_draft(p_quotation_id)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- E. Canonical hash must cover the measurements
-- -----------------------------------------------------------------------------
--
-- Without this, width and height could be changed between two finalized
-- versions while the content hash stayed identical — the hash would be
-- attesting to a document that no longer matched the measurements printed on
-- it. The version tag moves to v2 so the change is explicit rather than a
-- silent redefinition of what an existing hash meant.
--
-- Production holds zero non-draft versions, so no existing attestation is
-- invalidated by the tag change.

create or replace function private.compute_canonical_quotation_sha256(p_version_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_hash text;
begin
  select jsonb_build_object(
    'canonical_form', 'odq-content-v2-interior',
    'quotation_number', q.quotation_number,
    'version_number', qv.version_number,
    'title', qv.title,
    'client_name_snapshot', qv.client_name_snapshot,
    'client_email_snapshot', qv.client_email_snapshot,
    'client_phone_snapshot', qv.client_phone_snapshot,
    'property_address_snapshot', qv.property_address_snapshot,
    'scope_summary', qv.scope_summary,
    'subtotal_paise', qv.subtotal_paise,
    'discount_type', qv.discount_type,
    'discount_value_paise', qv.discount_value_paise,
    'discount_percentage', qv.discount_percentage,
    'discount_total_paise', qv.discount_total_paise,
    'taxable_base_paise', qv.taxable_base_paise,
    'tax_profile_snapshot', qv.tax_profile_snapshot,
    'tax_rate_percentage', qv.tax_rate_percentage,
    'tax_total_paise', qv.tax_total_paise,
    'grand_total_paise', qv.grand_total_paise,
    'payment_schedule_mode', qv.payment_schedule_mode,
    'inclusions', coalesce(qv.inclusions, '{}'::text[]),
    'exclusions', coalesce(qv.exclusions, '{}'::text[]),
    'terms_and_conditions', qv.terms_and_conditions,
    'rooms', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'room_name', qs.section_name,
          'display_order', qs.display_order,
          'subtotal_paise', qs.subtotal_paise,
          'items', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'item_name', qi.item_name,
                'description', qi.description,
                'specifications', qi.specifications,
                'calculation_basis', qi.calculation_basis,
                'width_ft', qi.width_ft,
                'height_ft', qi.height_ft,
                'area_sqft', private.quotation_derive_area_sqft(qi.width_ft, qi.height_ft),
                'quantity', qi.quantity,
                'unit_of_measure', qi.unit_of_measure,
                'unit_rate_paise', qi.unit_rate_paise,
                'line_total_paise', qi.line_total_paise,
                'display_order', qi.display_order
              ) order by qi.display_order asc, qi.id asc
            ), '[]'::jsonb)
            from public.quotation_items qi
            where qi.section_id = qs.id
          )
        ) order by qs.display_order asc, qs.id asc
      ), '[]'::jsonb)
      from public.quotation_sections qs
      where qs.quotation_version_id = p_version_id
    ),
    'payment_schedule', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'milestone_name', qps.milestone_name,
          'milestone_order', qps.milestone_order,
          'percentage', qps.percentage,
          'amount_paise', qps.amount_paise
        ) order by qps.milestone_order asc, qps.id asc
      ), '[]'::jsonb)
      from public.quotation_payment_schedules qps
      where qps.quotation_version_id = p_version_id
    )
  ) into v_payload
  from public.quotation_versions qv
  join public.quotations q on q.id = qv.quotation_id
  where qv.id = p_version_id;

  if v_payload is null then
    return null;
  end if;

  select encode(
    extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  ) into v_hash;

  return v_hash;
end;
$$;


-- -----------------------------------------------------------------------------
-- G. Service-role grant issuance must respect the M54 access state
-- -----------------------------------------------------------------------------
--
-- `issue_quotation_access_grant_internal` runs as service_role and authorizes an
-- EXPLICIT p_actor_id through `private.quotation_actor_has_permission`. That
-- helper checked active profile, active role and active permission — but not
-- M54's `staff_access_denied`, so an employment-backed user who is
-- not_activated, credentials_ready or revoked could still have a capability
-- link issued in their name. The service-role path bypassed the fail-closed
-- state that every RLS path honours.
--
-- Reproduced verbatim apart from that leading guard. A user with NO employment
-- row — the Super Admin — is unaffected, because `staff_access_denied` returns
-- false when no employment record exists.

create or replace function private.quotation_actor_has_permission(p_actor_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.staff_access_denied(p_actor_id)
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.is_active = true
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions perm on perm.id = rp.permission_id and perm.is_active = true
      join public.profiles p on p.id = ur.user_id and p.status = 'active'
      where ur.user_id = p_actor_id
        and perm.code = p_permission
    );
$$;

comment on function private.quotation_actor_has_permission(uuid, text) is
  'Explicit-actor permission check used by service-role quotation helpers. Honours the M54 application access state, so a not_activated, credentials_ready or revoked employment-backed actor is refused exactly as it is on every RLS path.';

revoke all on function private.quotation_actor_has_permission(uuid, text) from public, anon;
alter function private.quotation_actor_has_permission(uuid, text) owner to postgres;

-- -----------------------------------------------------------------------------
-- H. An EXPIRED grant is not reusable
-- -----------------------------------------------------------------------------
--
-- `get_quotation_by_capability` already refuses a grant past `expires_at`, but
-- the issuer treated any row with `revoked_at is null` as reusable — so an
-- expired grant was returned as a successful "reuse" and the caller handed the
-- client a link the reader would then reject.
--
-- An expired row is now revoked in place and a fresh grant is issued, which
-- also keeps at most one simultaneously valid grant per version.

create or replace function public.issue_quotation_access_grant_internal(
  p_actor_id uuid,
  p_grant_id uuid,
  p_version_id uuid,
  p_derivation_nonce text,
  p_capability_token_hash text,
  p_reissue boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version record;
  v_quotation record;
  v_lead record;
  v_pdf record;
  v_existing record;
  v_grant_id uuid;
begin
  if p_actor_id is null or p_grant_id is null or p_version_id is null then
    raise exception 'VALIDATION: actor_id, grant_id, and version_id are required.';
  end if;

  if not exists (select 1 from public.profiles where id = p_actor_id and status = 'active') then
    raise exception 'FORBIDDEN: Active profile required.';
  end if;

  if not private.quotation_actor_has_permission(p_actor_id, 'quotations.send') then
    raise exception 'FORBIDDEN: Permission quotations.send is required.';
  end if;

  if p_derivation_nonce is null or p_derivation_nonce !~ '^[0-9a-f]{32,128}$' then
    raise exception 'VALIDATION: derivation_nonce must be 32-128 lowercase hex characters.';
  end if;

  if p_capability_token_hash is null or p_capability_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'VALIDATION: capability_token_hash must be 64 lowercase hex characters.';
  end if;

  select * into v_version
  from public.quotation_versions
  where id = p_version_id
  for update;

  if v_version.id is null or v_version.status <> 'finalized' then
    raise exception 'INVALID_VERSION_STATE: Access grants can only be issued for finalized quotation versions.';
  end if;

  select * into v_quotation
  from public.quotations
  where id = v_version.quotation_id
  for update;

  select * into v_lead
  from public.leads
  where id = v_quotation.lead_id
  for update;

  if not private.quotation_actor_can_send_for_lead(p_actor_id, v_lead.assigned_to) then
    raise exception 'FORBIDDEN: Sales Executive can only issue grants for assigned leads.';
  end if;

  select * into v_pdf
  from public.quotation_pdf_documents
  where quotation_version_id = p_version_id
  for update;

  if v_pdf.id is null or v_pdf.status <> 'ready' then
    raise exception 'PDF_NOT_READY: PDF document must be generated and ready before issuing an access grant.';
  end if;

  if exists (select 1 from public.quotation_acceptances where quotation_id = v_quotation.id) then
    raise exception 'QUOTATION_ALREADY_ACCEPTED: Cannot issue new access grants for an accepted quotation.';
  end if;

  -- Only a LIVE grant is reusable. The reader applies the same expiry rule, so
  -- reusing an expired row would hand back a link that cannot be opened.
  select * into v_existing
  from public.quotation_access_grants
  where quotation_version_id = p_version_id
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if v_existing.id is not null and coalesce(p_reissue, false) = false then
    return jsonb_build_object(
      'success', true,
      'grant_id', v_existing.id,
      'reused', true,
      -- The PERSISTED derivation identity. Without these the caller cannot
      -- reproduce the token that this grant was actually issued against.
      'derivation_nonce', v_existing.derivation_nonce,
      'capability_token_hash', v_existing.capability_token_hash,
      'quotation_version_id', v_existing.quotation_version_id
    );
  end if;

  -- Revoke whatever is still open — the live grant on an explicit reissue, and
  -- any EXPIRED row, so at most one grant per version is ever valid.
  for v_existing in
    select * from public.quotation_access_grants
    where quotation_version_id = p_version_id and revoked_at is null
    for update
  loop
    update public.quotation_access_grants
    set revoked_at = now(),
        revoked_by = p_actor_id,
        revocation_reason = case
          when v_existing.expires_at is not null and v_existing.expires_at <= now()
            then 'Expired quotation access grant'
          else 'Reissue of quotation access grant'
        end
    where id = v_existing.id
      and revoked_at is null;

    insert into public.quotation_events (
      quotation_id, quotation_version_id, lead_id, event_type, actor_id, details
    ) values (
      v_quotation.id,
      p_version_id,
      v_quotation.lead_id,
      'quotation.capability_revoked',
      p_actor_id,
      jsonb_build_object('grant_id', v_existing.id, 'reason', 'superseded')
    );
  end loop;

  insert into public.quotation_access_grants (
    id, quotation_id, quotation_version_id, derivation_nonce, capability_token_hash, created_by
  ) values (
    p_grant_id, v_quotation.id, p_version_id, p_derivation_nonce, p_capability_token_hash, p_actor_id
  ) returning id into v_grant_id;

  insert into public.quotation_events (
    quotation_id, quotation_version_id, lead_id, event_type, actor_id, details
  ) values (
    v_quotation.id,
    p_version_id,
    v_quotation.lead_id,
    'quotation.capability_issued',
    p_actor_id,
    jsonb_build_object('grant_id', v_grant_id)
  );

  return jsonb_build_object(
    'success', true,
    'grant_id', v_grant_id,
    'reused', false,
    'derivation_nonce', p_derivation_nonce,
    'capability_token_hash', p_capability_token_hash,
    'quotation_version_id', p_version_id
  );
end;
$$;

revoke execute on function public.issue_quotation_access_grant_internal(uuid, uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.issue_quotation_access_grant_internal(uuid, uuid, uuid, text, text, boolean) to service_role;
alter function public.issue_quotation_access_grant_internal(uuid, uuid, uuid, text, text, boolean) owner to postgres;

-- -----------------------------------------------------------------------------
-- I. The CLIENT sees the same interior document the staff finalized
-- -----------------------------------------------------------------------------
--
-- The capability read model returned a generic quantity/UOM line, so the client
-- portal could not show width, height or area — the customer would be accepting
-- a document whose commercial meaning differs from the finalized PDF.
--
-- Reproduced verbatim apart from the interior fields and the room area total.

create or replace function public.get_quotation_by_capability(p_capability_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_grant record;
  v_version record;
  v_quotation record;
  v_lead record;
  v_acceptance record;
  v_pdf record;
  v_sections jsonb;
  v_payment_schedule jsonb;
begin
  if p_capability_token is null or length(trim(p_capability_token)) = 0 then
    return jsonb_build_object('success', false, 'message', 'QUOTATION_NOT_FOUND');
  end if;

  v_token_hash := encode(extensions.digest(convert_to(trim(p_capability_token), 'UTF8'), 'sha256'), 'hex');

  select * into v_grant
  from public.quotation_access_grants
  where capability_token_hash = v_token_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_grant.id is null then
    return jsonb_build_object('success', false, 'message', 'QUOTATION_NOT_FOUND');
  end if;

  select * into v_version
  from public.quotation_versions
  where id = v_grant.quotation_version_id and status = 'finalized';

  if v_version.id is null then
    return jsonb_build_object('success', false, 'message', 'QUOTATION_NOT_FOUND');
  end if;

  select * into v_quotation from public.quotations where id = v_grant.quotation_id;
  select * into v_lead from public.leads where id = v_quotation.lead_id;
  select * into v_acceptance from public.quotation_acceptances where quotation_version_id = v_version.id;
  select * into v_pdf from public.quotation_pdf_documents where quotation_version_id = v_version.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', qs.id,
      'section_name', qs.section_name,
      'display_order', qs.display_order,
      'subtotal_paise', qs.subtotal_paise,
      'area_subtotal_sqft', (
        select coalesce(sum(private.quotation_derive_area_sqft(qi.width_ft, qi.height_ft)), 0)
        from public.quotation_items qi
        where qi.section_id = qs.id and qi.calculation_basis = 'area'
      ),
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', qi.id,
            'item_name', qi.item_name,
            'description', qi.description,
            'specifications', qi.specifications,
            'calculation_basis', qi.calculation_basis,
            'width_ft', qi.width_ft,
            'height_ft', qi.height_ft,
            'area_sqft', private.quotation_derive_area_sqft(qi.width_ft, qi.height_ft),
            'quantity', qi.quantity,
            'unit_of_measure', qi.unit_of_measure,
            'unit_rate_paise', qi.unit_rate_paise,
            'line_total_paise', qi.line_total_paise,
            'display_order', qi.display_order
          ) order by qi.display_order asc, qi.id asc
        ), '[]'::jsonb)
        from public.quotation_items qi
        where qi.section_id = qs.id
      )
    ) order by qs.display_order asc, qs.id asc
  ), '[]'::jsonb) into v_sections
  from public.quotation_sections qs
  where qs.quotation_version_id = v_version.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', qps.id,
      'milestone_name', qps.milestone_name,
      'milestone_order', qps.milestone_order,
      'percentage', qps.percentage,
      'amount_paise', qps.amount_paise
    ) order by qps.milestone_order asc, qps.id asc
  ), '[]'::jsonb) into v_payment_schedule
  from public.quotation_payment_schedules qps
  where qps.quotation_version_id = v_version.id;

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'quotation_id', v_quotation.id,
      'quotation_version_id', v_version.id,
      'quotation_number', v_quotation.quotation_number,
      'version_number', v_version.version_number,
      'finalized_at', v_version.finalized_at,
      'client_name', v_version.client_name_snapshot,
      'client_email', v_version.client_email_snapshot,
      'client_phone', v_version.client_phone_snapshot,
      'property_address', v_version.property_address_snapshot,
      'scope_summary', v_version.scope_summary,
      'title', v_version.title,
      'sections', v_sections,
      'payment_schedule', v_payment_schedule,
      'subtotal_paise', v_version.subtotal_paise,
      'discount_type', v_version.discount_type,
      'discount_value_paise', v_version.discount_value_paise,
      'discount_percentage', v_version.discount_percentage,
      'discount_total_paise', v_version.discount_total_paise,
      'taxable_base_paise', v_version.taxable_base_paise,
      -- FROZEN tax identity. A later rename of the live profile must not change
      -- what a finalized document says.
      'tax_profile_name', coalesce(v_version.tax_profile_snapshot->>'display_name', 'GST'),
      'tax_rate_percentage', v_version.tax_rate_percentage,
      'tax_total_paise', v_version.tax_total_paise,
      'grand_total_paise', v_version.grand_total_paise,
      'inclusions', v_version.inclusions,
      'exclusions', v_version.exclusions,
      'terms_and_conditions', v_version.terms_and_conditions,
      'has_pdf', (v_pdf.id is not null and v_pdf.status = 'ready'),
      'is_accepted', (v_acceptance.id is not null),
      'accepted_at', v_acceptance.accepted_at
    )
  );
end;
$$;

revoke execute on function public.get_quotation_by_capability(text) from public;
grant execute on function public.get_quotation_by_capability(text) to anon, authenticated;
alter function public.get_quotation_by_capability(text) owner to postgres;

-- -----------------------------------------------------------------------------
-- D. Staff read model — rooms, dimensions, derived area and acceptance
-- -----------------------------------------------------------------------------
--
-- Acceptance lives in `quotation_acceptances`; the version stays `finalized`.
-- Without this the finalized screen shows "Status: finalized" for a quotation
-- the client already accepted, and it would have to infer acceptance from lead
-- status, which is a different fact.

create or replace function public.get_quotation_draft(p_quotation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_root_rec record;
  v_ver_rec record;
  v_acceptance record;
  v_pdf record;
  v_sections jsonb;
  v_schedules jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_view(p_quotation_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_root_rec from public.quotations where id = p_quotation_id;
  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_ver_rec
  from public.quotation_versions
  where quotation_id = p_quotation_id
    and is_current_draft = true
  order by version_number desc
  limit 1;

  if not found then
    select * into v_ver_rec
    from public.quotation_versions
    where quotation_id = p_quotation_id
    order by version_number desc
    limit 1;
  end if;

  if v_ver_rec.id is null then
    return jsonb_build_object(
      'quotationId', v_root_rec.id,
      'leadId', v_root_rec.lead_id,
      'quotationNumber', v_root_rec.quotation_number,
      'rootStatus', v_root_rec.status,
      'status', v_root_rec.status,
      'version', null
    );
  end if;

  select * into v_acceptance
  from public.quotation_acceptances
  where quotation_version_id = v_ver_rec.id;

  select * into v_pdf
  from public.quotation_pdf_documents
  where quotation_version_id = v_ver_rec.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'sectionName', s.section_name,
      'displayOrder', s.display_order,
      'subtotalPaise', s.subtotal_paise,
      -- Total AREA in this room, derived from the same dimensions the amounts
      -- came from.
      'areaSubtotalSqFt', (
        select coalesce(sum(private.quotation_derive_area_sqft(i.width_ft, i.height_ft)), 0)
        from public.quotation_items i
        where i.section_id = s.id and i.calculation_basis = 'area'
      ),
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'itemName', i.item_name,
            'description', i.description,
            'specifications', i.specifications,
            'calculationBasis', i.calculation_basis,
            'widthFt', i.width_ft,
            'heightFt', i.height_ft,
            'areaSqFt', private.quotation_derive_area_sqft(i.width_ft, i.height_ft),
            'quantity', i.quantity,
            'unitOfMeasure', i.unit_of_measure,
            'unitRatePaise', i.unit_rate_paise,
            'lineTotalPaise', i.line_total_paise,
            'displayOrder', i.display_order
          ) order by i.display_order
        ), '[]'::jsonb)
        from public.quotation_items i
        where i.section_id = s.id
      )
    ) order by s.display_order
  ), '[]'::jsonb) into v_sections
  from public.quotation_sections s
  where s.quotation_version_id = v_ver_rec.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ps.id,
      'milestoneName', ps.milestone_name,
      'milestoneOrder', ps.milestone_order,
      'percentage', ps.percentage,
      'amountPaise', ps.amount_paise
    ) order by ps.milestone_order
  ), '[]'::jsonb) into v_schedules
  from public.quotation_payment_schedules ps
  where ps.quotation_version_id = v_ver_rec.id;

  return jsonb_build_object(
    'quotationId', v_root_rec.id,
    'leadId', v_root_rec.lead_id,
    'quotationNumber', v_root_rec.quotation_number,
    'rootStatus', v_root_rec.status,
    'status', v_root_rec.status,
    'version', jsonb_build_object(
      'id', v_ver_rec.id,
      'versionNumber', v_ver_rec.version_number,
      'status', v_ver_rec.status,
      'isCurrentDraft', v_ver_rec.is_current_draft,
      'lockVersion', v_ver_rec.lock_version,
      'title', v_ver_rec.title,
      'scopeSummary', v_ver_rec.scope_summary,
      'clientNameSnapshot', v_ver_rec.client_name_snapshot,
      'clientEmailSnapshot', v_ver_rec.client_email_snapshot,
      'clientPhoneSnapshot', v_ver_rec.client_phone_snapshot,
      'propertyAddressSnapshot', v_ver_rec.property_address_snapshot,
      'discountType', v_ver_rec.discount_type,
      'discountValuePaise', v_ver_rec.discount_value_paise,
      'discountPercentage', v_ver_rec.discount_percentage,
      'discountTotalPaise', v_ver_rec.discount_total_paise,
      'subtotalPaise', v_ver_rec.subtotal_paise,
      'taxableBasePaise', v_ver_rec.taxable_base_paise,
      'taxProfileId', v_ver_rec.tax_profile_id,
      'taxProfileName', coalesce(v_ver_rec.tax_profile_snapshot->>'display_name', null),
      'taxRatePercentage', v_ver_rec.tax_rate_percentage,
      'taxTotalPaise', v_ver_rec.tax_total_paise,
      'grandTotalPaise', v_ver_rec.grand_total_paise,
      'paymentScheduleMode', v_ver_rec.payment_schedule_mode,
      'inclusions', coalesce(v_ver_rec.inclusions, '{}'::text[]),
      'exclusions', coalesce(v_ver_rec.exclusions, '{}'::text[]),
      'termsAndConditions', v_ver_rec.terms_and_conditions,
      'finalizedAt', v_ver_rec.finalized_at,
      'finalizedContentSha256', v_ver_rec.finalized_content_sha256,
      'pdfStatus', v_pdf.status,
      -- Acceptance is a FACT of its own table, never inferred from lead status.
      'isAccepted', (v_acceptance.id is not null),
      'acceptedAt', v_acceptance.accepted_at,
      'acceptedByName', v_acceptance.accepted_by_name,
      'sections', v_sections,
      'paymentSchedules', v_schedules
    )
  );
end;
$$;
