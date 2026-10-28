-- ONEDECORE CRM: two-column Name + Indian mobile import.
-- Code-only template migration; never grants consent or bypasses RBAC.
-- Reuse the already-supported not-specified lead taxonomy only for unknown fields.
-- Reject same-file repeated normalized mobile numbers before approval.
create or replace function private.crm_import_validate_row(
  p_row public.lead_import_rows,
  p_default_source_id uuid
)
returns public.lead_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_name text;
  v_phone text;
  v_email text;
  v_locality text;
  v_source_id uuid;
  v_rooms text[];
  v_dup record;
  v_assign record;
  v_outcome text;
  v_importable boolean := false;
begin
  v_name := nullif(trim(coalesce(p_row.submitted_name, '')), '');
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'submitted_name', 'code', 'INVALID_NAME', 'message', 'Name must be 2-120 characters'
    ));
  end if;

  begin
    v_phone := private.crm_normalize_phone_e164(p_row.phone);
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'phone', 'code', 'INVALID_PHONE', 'message', 'Phone must be valid E.164'
    ));
    v_phone := null;
  end;

  -- Minimal Name/Mobile imports must be genuine Indian 10-digit mobiles.
  -- A syntactically valid foreign E.164 phone is not an Indian mobile.
  if p_row.service_code = 'not-specified' and
     p_row.property_code = 'not-specified' and
     p_row.timeline_code = 'not-specified' and
     v_phone is not null and v_phone !~ '^\+91[6-9][0-9]{9}$' then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'phone', 'code', 'INVALID_INDIAN_MOBILE',
      'message', 'Use a valid Indian 10-digit mobile starting with 6, 7, 8 or 9'
    ));
  end if;

  begin
    v_email := private.crm_normalize_email(p_row.email);
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'email', 'code', 'INVALID_EMAIL', 'message', 'Email must be valid'
    ));
    v_email := null;
  end;

  if v_phone is null and v_email is null then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'phone', 'code', 'CONTACT_REQUIRED', 'message', 'Phone or email required'
    ));
  end if;

  if p_row.service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes', 'not-specified') then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'service_code', 'code', 'INVALID_SERVICE', 'message', 'Invalid service code'
    ));
  end if;

  if p_row.property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room', 'not-specified'
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'property_code', 'code', 'INVALID_PROPERTY', 'message', 'Invalid property code'
    ));
  end if;

  if p_row.timeline_code not in (
    'immediate', 'within-1-month', 'within-2-months', 'after-2-months', 'not-specified'
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'timeline_code', 'code', 'INVALID_TIMELINE', 'message', 'Invalid timeline code'
    ));
  end if;

  v_source_id := coalesce(p_row.primary_source_id, p_default_source_id);
  if v_source_id is null or not exists (
    select 1 from public.lead_sources ls where ls.id = v_source_id and ls.is_active = true
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'primary_source_id', 'code', 'INVALID_SOURCE', 'message', 'Active lead source required'
    ));
  end if;

  v_locality := private.crm_normalize_locality(p_row.locality);
  if p_row.locality is not null and length(trim(p_row.locality)) > 120 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'locality', 'code', 'INVALID_LOCALITY', 'message', 'Locality max 120 characters'
    ));
  end if;

  if p_row.budget_comfort_code is not null and p_row.budget_comfort_code not in (
    'under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus'
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'budget_comfort_code', 'code', 'INVALID_BUDGET', 'message', 'Invalid budget code'
    ));
  end if;

  v_rooms := coalesce(p_row.room_codes, '{}'::text[]);
  if cardinality(v_rooms) > 6
    or not (v_rooms <@ array['living', 'kitchen', 'bedrooms', 'wardrobes', 'dining', 'other']::text[]) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'room_codes', 'code', 'INVALID_ROOMS', 'message', 'Invalid room codes'
    ));
  end if;

  if p_row.message is not null and length(p_row.message) > 2000 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'message', 'code', 'INVALID_MESSAGE', 'message', 'Message max 2000 characters'
    ));
  end if;

  if p_row.source_detail is not null and length(trim(p_row.source_detail)) > 500 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'source_detail', 'code', 'INVALID_SOURCE_DETAIL', 'message', 'Source detail max 500 characters'
    ));
  end if;

  p_row.validation_errors := v_errors;
  p_row.primary_source_id := v_source_id;

  if jsonb_array_length(v_errors) > 0 then
    p_row.validation_status := 'invalid';
    p_row.duplicate_outcome := null;
    p_row.import_status := 'pending';
    p_row.assignment_rule_id := null;
    p_row.resolved_assignee_id := null;
    p_row.assignment_resolution_code := null;
    return p_row;
  end if;

  select * into v_dup
  from private.crm_evaluate_bulk_import_duplicate(
    v_phone, v_email, p_row.service_code, p_row.property_code, v_locality
  )
  limit 1;

  v_outcome := coalesce(v_dup.outcome_code, 'CLEAR');
  p_row.duplicate_outcome := v_outcome;
  p_row.validation_status := 'valid';

  if v_outcome in ('CLEAR', 'REUSABLE_CONTACT') then
    v_importable := true;
    p_row.import_status := 'ready';
  else
    v_importable := false;
    p_row.import_status := 'skipped';
  end if;

  if v_importable and v_source_id is not null then
    select * into v_assign
    from private.crm_resolve_lead_assignment_rule(
      v_source_id, p_row.service_code, v_locality, p_row.budget_comfort_code
    )
    limit 1;

    p_row.assignment_rule_id := v_assign.matched_rule_id;
    p_row.resolved_assignee_id := v_assign.assignee_id;
    p_row.assignment_resolution_code := v_assign.resolution_code;
  end if;

  return p_row;
end;
$$;

create or replace function private.validate_lead_import_batch_impl(
  p_batch_id uuid
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
  v_row public.lead_import_rows%rowtype;
  v_validated public.lead_import_rows;
  v_new_status text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import')) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if v_batch.status not in ('draft', 'validation_failed', 'ready_for_review') then
    raise exception 'CRM_IMPORT_BATCH_NOT_VALIDATABLE' using errcode = '22023';
  end if;

  for v_row in
    select * from public.lead_import_rows where batch_id = p_batch_id order by row_number
  loop
    v_validated := private.crm_import_validate_row(v_row, v_batch.default_source_id);

    -- Within-file duplicate check, using the *validated* earlier row only.
    -- The TypeScript parser has already normalized Indian numbers to +91 E.164.
    -- Keep the first valid row; block later repeats before approval.
    if v_validated.validation_status = 'valid'
       and v_validated.import_status = 'ready'
       and v_row.phone is not null
       and exists (
         select 1 from public.lead_import_rows prev
         where prev.batch_id = p_batch_id
           and prev.row_number < v_row.row_number
           and prev.phone = v_row.phone
           and prev.validation_status = 'valid'
           and prev.import_status = 'ready'
       ) then
      v_validated.duplicate_outcome := 'ACTIVE_DUPLICATE';
      v_validated.import_status := 'skipped';
    end if;

    update public.lead_import_rows
    set validation_status = v_validated.validation_status,
        duplicate_outcome = v_validated.duplicate_outcome,
        validation_errors = v_validated.validation_errors,
        primary_source_id = v_validated.primary_source_id,
        assignment_rule_id = v_validated.assignment_rule_id,
        resolved_assignee_id = v_validated.resolved_assignee_id,
        assignment_resolution_code = v_validated.assignment_resolution_code,
        import_status = v_validated.import_status,
        updated_at = now()
    where id = v_row.id;
  end loop;

  perform private.crm_import_batch_recompute_counters(p_batch_id);

  select * into v_batch from public.lead_import_batches where id = p_batch_id;

  -- Allow the valid subset to be approved; invalid rows stay excluded.
  if v_batch.importable_rows = 0 then
    v_new_status := 'validation_failed';
  else
    v_new_status := 'ready_for_review';
  end if;

  update public.lead_import_batches
  set status = v_new_status,
      updated_at = now()
  where id = p_batch_id
  returning * into v_batch;

  perform private.crm_import_batch_append_event(
    p_batch_id, 'batch.validated', v_actor,
    jsonb_build_object(
      'validationRevision', v_batch.validation_revision,
      'totalRows', v_batch.total_rows,
      'validRows', v_batch.valid_rows,
      'invalidRows', v_batch.invalid_rows,
      'importableRows', v_batch.importable_rows,
      'duplicateBlockedRows', v_batch.duplicate_blocked_rows,
      'status', v_batch.status
    )
  );

  return v_batch;
end;
$$;
alter function private.crm_import_validate_row(public.lead_import_rows, uuid) owner to postgres;
alter function private.validate_lead_import_batch_impl(uuid) owner to postgres;
revoke all on function private.crm_import_validate_row(public.lead_import_rows, uuid) from public, anon;
revoke all on function private.validate_lead_import_batch_impl(uuid) from public, anon;
-- Existing RPC wrappers remain SECURITY INVOKER and require authenticated permissions.
