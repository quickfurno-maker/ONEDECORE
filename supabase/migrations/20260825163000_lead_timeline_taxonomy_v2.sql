-- Phase 10 / PR #94 — Lead timeline taxonomy v2 (owner-authorized forward migration)
-- Replaces legacy five timeline codes with four canonical production codes.
-- Does not touch deferred online-payment migration 20260825140000.

alter table public.leads
  drop constraint if exists chk_leads_timeline_code;

alter table public.leads
  add constraint chk_leads_timeline_code check (
    timeline_code in (
      'immediate',
      'within-1-month',
      'within-2-months',
      'after-2-months'
    )
  );

create or replace function public.submit_lead_intake(
  p_idempotency_key uuid,
  p_request_hash text,
  p_network_fingerprint_hash text,
  p_phone_fingerprint_hash text,
  p_planner_version text,
  p_submitted_name text,
  p_phone_e164 text,
  p_submitted_email text,
  p_service_code text,
  p_property_code text,
  p_timeline_code text,
  p_room_codes text[],
  p_budget_comfort_code text,
  p_estimate_snapshot jsonb,
  p_locality text,
  p_message text,
  p_landing_path text,
  p_attribution jsonb,
  p_source text,
  p_consent_service_enquiry boolean,
  p_consent_service_phone boolean,
  p_consent_service_email boolean,
  p_consent_whatsapp boolean,
  p_copy_service_enquiry text,
  p_copy_service_communication text,
  p_copy_whatsapp text,
  p_notice_version text
)
returns table (
  outcome text,
  submission_reference uuid,
  retry_after_seconds integer,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.lead_intake_requests%rowtype;
  v_has_intake boolean := false;
  v_intake_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_submission_reference uuid;
  v_existing_name text;
  v_network_15m integer;
  v_network_24h integer;
  v_phone_24h integer;
  v_retry integer;
  v_rooms text[];
begin
  -- 1. Validate bounds and allowlists
  if p_idempotency_key is null then
    raise exception 'validation: idempotency_key required' using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'validation: request_hash' using errcode = '22023';
  end if;
  if p_network_fingerprint_hash is null or p_network_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'validation: network_fingerprint_hash' using errcode = '22023';
  end if;
  if p_phone_fingerprint_hash is null or p_phone_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'validation: phone_fingerprint_hash' using errcode = '22023';
  end if;
  if p_planner_version is null or length(p_planner_version) < 1 or length(p_planner_version) > 80 then
    raise exception 'validation: planner_version' using errcode = '22023';
  end if;
  if p_submitted_name is null or length(trim(p_submitted_name)) < 2 or length(trim(p_submitted_name)) > 120 then
    raise exception 'validation: submitted_name' using errcode = '22023';
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9]\d{1,14}$' then
    raise exception 'validation: phone_e164' using errcode = '22023';
  end if;
  if p_submitted_email is not null and (
    p_submitted_email <> lower(p_submitted_email)
    or length(p_submitted_email) > 254
    or p_submitted_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) then
    raise exception 'validation: submitted_email' using errcode = '22023';
  end if;
  if p_service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes') then
    raise exception 'validation: service_code' using errcode = '22023';
  end if;
  if p_property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room'
  ) then
    raise exception 'validation: property_code' using errcode = '22023';
  end if;
  if p_timeline_code not in (
    'immediate', 'within-1-month', 'within-2-months', 'after-2-months'
  ) then
    raise exception 'validation: timeline_code' using errcode = '22023';
  end if;

  v_rooms := coalesce(p_room_codes, '{}'::text[]);
  if cardinality(v_rooms) > 6 then
    raise exception 'validation: room_codes max' using errcode = '22023';
  end if;
  if not (v_rooms <@ array['living', 'kitchen', 'bedrooms', 'wardrobes', 'dining', 'other']::text[]) then
    raise exception 'validation: room_codes allowlist' using errcode = '22023';
  end if;
  if cardinality(v_rooms) <> (select count(distinct x) from unnest(v_rooms) as t(x)) then
    raise exception 'validation: room_codes unique' using errcode = '22023';
  end if;

  if p_budget_comfort_code is not null and p_budget_comfort_code not in (
    'under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus'
  ) then
    raise exception 'validation: budget_comfort_code' using errcode = '22023';
  end if;
  if p_estimate_snapshot is not null and (
    jsonb_typeof(p_estimate_snapshot) <> 'object'
    or pg_column_size(p_estimate_snapshot) > 4096
  ) then
    raise exception 'validation: estimate_snapshot' using errcode = '22023';
  end if;
  if p_locality is not null and length(p_locality) > 120 then
    raise exception 'validation: locality' using errcode = '22023';
  end if;
  if p_message is not null and length(p_message) > 2000 then
    raise exception 'validation: message' using errcode = '22023';
  end if;
  if p_landing_path is null
    or p_landing_path not like '/%'
    or left(p_landing_path, 2) = '//'
    or length(p_landing_path) > 500
    or p_landing_path ~ '[[:space:]]'
    or p_landing_path ~ '[[:cntrl:]]'
    or position(E'\\' in p_landing_path) > 0
    or position('://' in p_landing_path) > 0
  then
    raise exception 'validation: landing_path' using errcode = '22023';
  end if;
  if p_attribution is null
    or jsonb_typeof(p_attribution) <> 'object'
    or pg_column_size(p_attribution) > 2048
  then
    raise exception 'validation: attribution' using errcode = '22023';
  end if;
  if p_source not in ('website-planner', 'local-test') then
    raise exception 'validation: source' using errcode = '22023';
  end if;
  if p_consent_service_enquiry is distinct from true
    or p_consent_service_phone is distinct from true
  then
    raise exception 'validation: required consent' using errcode = '22023';
  end if;
  if coalesce(p_consent_service_email, false) and (
    p_submitted_email is null or length(trim(p_submitted_email)) < 3
  ) then
    raise exception 'validation: email service consent requires email' using errcode = '22023';
  end if;
  if p_submitted_email is not null and coalesce(p_consent_service_email, false) is not true then
    raise exception 'validation: email requires serviceChannels.email' using errcode = '22023';
  end if;
  if p_copy_service_enquiry is null or length(p_copy_service_enquiry) < 1 then
    raise exception 'validation: copy_service_enquiry' using errcode = '22023';
  end if;
  if p_copy_service_communication is null or length(p_copy_service_communication) < 1 then
    raise exception 'validation: copy_service_communication' using errcode = '22023';
  end if;
  if coalesce(p_consent_whatsapp, false) and (p_copy_whatsapp is null or length(p_copy_whatsapp) < 1) then
    raise exception 'validation: whatsapp copy version' using errcode = '22023';
  end if;
  if p_notice_version is null or length(p_notice_version) < 1 then
    raise exception 'validation: notice_version' using errcode = '22023';
  end if;

  -- Advisory locks in fixed deadlock-safe order: idempotency → network → phone
  -- Distinct namespaces via prefix; distinct seeds 0/1/2.
  perform pg_advisory_xact_lock(
    hashtextextended('lead-intake:idempotency:' || p_idempotency_key::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('lead-intake:network:' || p_network_fingerprint_hash, 1)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('lead-intake:phone:' || p_phone_fingerprint_hash, 2)
  );

  -- Resolve idempotency under lock
  select * into v_existing
  from public.lead_intake_requests
  where idempotency_key = p_idempotency_key
  for update;

  v_has_intake := found;

  if v_has_intake then
    if v_existing.status = 'completed'
      and v_existing.request_hash = p_request_hash
      and v_existing.submission_reference is not null
    then
      return query
      select
        'idempotent_replay'::text,
        v_existing.submission_reference,
        null::integer,
        true;
      return;
    end if;

    if v_existing.request_hash is distinct from p_request_hash then
      update public.lead_intake_requests
      set status = 'rejected',
          outcome_code = 'IDEMPOTENCY_CONFLICT',
          completed_at = now()
      where id = v_existing.id
        and status <> 'completed';

      return query
      select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer,
        false;
      return;
    end if;

    if v_existing.status = 'completed' then
      return query
      select
        'idempotent_replay'::text,
        v_existing.submission_reference,
        null::integer,
        true;
      return;
    end if;
  end if;

  -- 6–7. Rate limits (OWNER_REVIEW_REQUIRED_BEFORE_PRODUCTION)
  select count(*)::integer into v_network_15m
  from public.lead_intake_requests
  where network_fingerprint_hash = p_network_fingerprint_hash
    and created_at > now() - interval '15 minutes'
    and outcome_code is distinct from 'IDEMPOTENT_REPLAY';

  select count(*)::integer into v_network_24h
  from public.lead_intake_requests
  where network_fingerprint_hash = p_network_fingerprint_hash
    and created_at > now() - interval '24 hours'
    and outcome_code is distinct from 'IDEMPOTENT_REPLAY';

  if v_network_15m >= 5 or v_network_24h >= 20 then
    v_retry := case
      when v_network_15m >= 5 then 900
      else 3600
    end;

    insert into public.lead_intake_requests (
      idempotency_key,
      request_hash,
      network_fingerprint_hash,
      phone_fingerprint_hash,
      status,
      outcome_code,
      completed_at,
      retry_after_seconds
    ) values (
      p_idempotency_key,
      p_request_hash,
      p_network_fingerprint_hash,
      p_phone_fingerprint_hash,
      'rejected',
      'NETWORK_RATE_LIMIT',
      now(),
      v_retry
    )
    on conflict (idempotency_key) do update
      set status = 'rejected',
          outcome_code = 'NETWORK_RATE_LIMIT',
          completed_at = now(),
          retry_after_seconds = excluded.retry_after_seconds;

    return query
    select
      'network_rate_limited'::text,
      null::uuid,
      v_retry,
      false;
    return;
  end if;

  select count(*)::integer into v_phone_24h
  from public.lead_intake_requests
  where phone_fingerprint_hash = p_phone_fingerprint_hash
    and created_at > now() - interval '24 hours'
    and outcome_code = 'CREATED';

  if v_phone_24h >= 3 then
    v_retry := 3600;
    insert into public.lead_intake_requests (
      idempotency_key,
      request_hash,
      network_fingerprint_hash,
      phone_fingerprint_hash,
      status,
      outcome_code,
      completed_at,
      retry_after_seconds
    ) values (
      p_idempotency_key,
      p_request_hash,
      p_network_fingerprint_hash,
      p_phone_fingerprint_hash,
      'rejected',
      'PHONE_RATE_LIMIT',
      now(),
      v_retry
    )
    on conflict (idempotency_key) do update
      set status = 'rejected',
          outcome_code = 'PHONE_RATE_LIMIT',
          completed_at = now(),
          retry_after_seconds = excluded.retry_after_seconds;

    return query
    select
      'phone_rate_limited'::text,
      null::uuid,
      v_retry,
      false;
    return;
  end if;

  -- Start processing row
  if not v_has_intake then
    insert into public.lead_intake_requests (
      idempotency_key,
      request_hash,
      network_fingerprint_hash,
      phone_fingerprint_hash,
      status
    ) values (
      p_idempotency_key,
      p_request_hash,
      p_network_fingerprint_hash,
      p_phone_fingerprint_hash,
      'processing'
    )
    returning id into v_intake_id;
  else
    v_intake_id := v_existing.id;
    update public.lead_intake_requests
    set status = 'processing',
        request_hash = p_request_hash,
        network_fingerprint_hash = p_network_fingerprint_hash,
        phone_fingerprint_hash = p_phone_fingerprint_hash
    where id = v_intake_id;
  end if;

  -- 8–11. Resolve / create contact + phone (+ optional email)
  begin
    v_contact_id := private.resolve_lead_intake_contact_by_phone(p_phone_e164);
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like 'contact_identity:%' then
        raise;
      end if;

      update public.lead_intake_requests
      set status = 'rejected',
          outcome_code = 'INTERNAL_FAILURE',
          completed_at = now()
      where id = v_intake_id;

      return query
      select
        'contact_identity_conflict'::text,
        null::uuid,
        null::integer,
        false;
      return;
  end;

  if v_contact_id is not null then
    select c.display_name into v_existing_name
    from public.contacts c
    where c.id = v_contact_id
    for update;
    -- Preserve DNC status and suppressed channels; no auto-reactivation.
  end if;

  if v_contact_id is null then
    insert into public.contacts (display_name, status)
    values (trim(p_submitted_name), 'active')
    returning id into v_contact_id;

    insert into public.contact_channels (
      contact_id,
      channel_type,
      address_normalized,
      status,
      is_primary
    ) values (
      v_contact_id,
      'phone',
      p_phone_e164,
      'active',
      true
    );
  end if;
  -- existing contact: do not overwrite display_name; do not reactivate suppressed phone

  if p_submitted_email is not null then
    if not exists (
      select 1
      from public.contact_channels
      where contact_id = v_contact_id
        and channel_type = 'email'
        and status = 'active'
        and address_normalized = p_submitted_email
    ) then
      insert into public.contact_channels (
        contact_id,
        channel_type,
        address_normalized,
        status,
        is_primary
      ) values (
        v_contact_id,
        'email',
        p_submitted_email,
        'active',
        not exists (
          select 1
          from public.contact_channels
          where contact_id = v_contact_id
            and channel_type = 'email'
            and status = 'active'
            and is_primary = true
        )
      );
    end if;
  end if;

  -- 12. Create lead
  insert into public.leads (
    contact_id,
    submitted_name,
    submitted_email,
    status,
    source,
    service_code,
    property_code,
    timeline_code,
    room_codes,
    budget_comfort_code,
    estimate_snapshot,
    locality,
    message,
    planner_version,
    landing_path,
    attribution
  ) values (
    v_contact_id,
    trim(p_submitted_name),
    p_submitted_email,
    'new',
    p_source,
    p_service_code,
    p_property_code,
    p_timeline_code,
    v_rooms,
    p_budget_comfort_code,
    p_estimate_snapshot,
    nullif(trim(coalesce(p_locality, '')), ''),
    nullif(trim(coalesce(p_message, '')), ''),
    p_planner_version,
    p_landing_path,
    coalesce(p_attribution, '{}'::jsonb)
  )
  returning id, public.leads.submission_reference into v_lead_id, v_submission_reference;

  -- 13–14. Consent evidence (channel-specific; no website-form SERVICE_COMMUNICATION)
  insert into public.consent_events (
    contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
    copy_version, notice_version, source, locale, actor_type, evidence
  ) values (
    v_contact_id, v_lead_id, v_intake_id, 'SERVICE_ENQUIRY', 'website-form', 'granted',
    p_copy_service_enquiry, p_notice_version, p_source, 'en-IN', 'data-principal',
    jsonb_build_object('intakeRequestId', v_intake_id)
  );

  insert into public.consent_events (
    contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
    copy_version, notice_version, source, locale, actor_type, evidence
  ) values (
    v_contact_id, v_lead_id, v_intake_id, 'SERVICE_COMMUNICATION', 'phone', 'granted',
    p_copy_service_communication, p_notice_version, p_source, 'en-IN', 'data-principal',
    jsonb_build_object('intakeRequestId', v_intake_id)
  );

  if coalesce(p_consent_service_email, false) then
    insert into public.consent_events (
      contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
      copy_version, notice_version, source, locale, actor_type, evidence
    ) values (
      v_contact_id, v_lead_id, v_intake_id, 'SERVICE_COMMUNICATION', 'email', 'granted',
      p_copy_service_communication, p_notice_version, p_source, 'en-IN', 'data-principal',
      jsonb_build_object('intakeRequestId', v_intake_id)
    );
  end if;

  if coalesce(p_consent_whatsapp, false) then
    if not exists (
      select 1
      from public.contact_channels
      where contact_id = v_contact_id
        and channel_type = 'whatsapp'
        and status = 'active'
        and address_normalized = p_phone_e164
    ) then
      insert into public.contact_channels (
        contact_id,
        channel_type,
        address_normalized,
        status,
        is_primary
      ) values (
        v_contact_id,
        'whatsapp',
        p_phone_e164,
        'active',
        not exists (
          select 1
          from public.contact_channels
          where contact_id = v_contact_id
            and channel_type = 'whatsapp'
            and status = 'active'
            and is_primary = true
        )
      );
    end if;

    insert into public.consent_events (
      contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
      copy_version, notice_version, source, locale, actor_type, evidence
    ) values (
      v_contact_id, v_lead_id, v_intake_id, 'WHATSAPP_SERVICE', 'whatsapp', 'granted',
      p_copy_whatsapp, p_notice_version, p_source, 'en-IN', 'data-principal',
      jsonb_build_object('intakeRequestId', v_intake_id)
    );
  end if;
  -- MARKETING intentionally not written: channel-agnostic marketing is deferred.

  -- 15. lead.created event
  insert into public.lead_events (
    lead_id, event_type, actor_type, event_data
  ) values (
    v_lead_id,
    'lead.created',
    'data-principal',
    jsonb_build_object(
      'source', p_source,
      'intakeRequestId', v_intake_id,
      'reusedContact', (v_existing_name is not null)
    )
  );

  -- 16. Complete intake request
  update public.lead_intake_requests
  set status = 'completed',
      outcome_code = 'CREATED',
      lead_id = v_lead_id,
      submission_reference = v_submission_reference,
      completed_at = now(),
      retry_after_seconds = null
  where id = v_intake_id;

  -- 17. Safe result
  return query
  select
    'created'::text,
    v_submission_reference,
    null::integer,
    false;
end;
$$;


comment on function public.submit_lead_intake is
  'Atomic service-role-only lead intake. Phase 5F-B: DNC/suppressed-phone identity reuse. Advisory lock order: idempotency → network → phone. Marketing capture deferred.';

alter function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text
) owner to postgres;

revoke all on function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text
) to service_role;

create or replace function private.create_manual_lead_impl(
  p_submitted_name text,
  p_phone text,
  p_email text,
  p_service_code text,
  p_property_code text,
  p_timeline_code text,
  p_primary_source_id uuid,
  p_locality text,
  p_budget_comfort_code text,
  p_room_codes text[],
  p_message text,
  p_source_detail text,
  p_assignee_id uuid,
  p_duplicate_override boolean,
  p_duplicate_override_reason text
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_phone text;
  v_email text;
  v_phone_contact uuid;
  v_email_contact uuid;
  v_contact_id uuid;
  v_dup record;
  v_override_reason text;
  v_final_assignee uuid;
  v_final_status text;
  v_method text;
  v_lead public.leads%rowtype;
  v_rooms text[];
  v_is_exec boolean;
  v_is_manager boolean;
  v_source_detail text;
  v_history_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_MANUAL_LEAD_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.create')) then
    raise exception 'CRM_MANUAL_LEAD_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_submitted_name is null or length(trim(p_submitted_name)) < 2 or length(trim(p_submitted_name)) > 120 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_NAME' using errcode = '22023';
  end if;

  v_phone := private.crm_normalize_phone_e164(p_phone);
  v_email := private.crm_normalize_email(p_email);
  if v_phone is null and v_email is null then
    raise exception 'CRM_MANUAL_LEAD_CONTACT_REQUIRED' using errcode = '22023';
  end if;

  if p_service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes') then
    raise exception 'CRM_MANUAL_LEAD_INVALID_SERVICE' using errcode = '22023';
  end if;

  if p_property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room'
  ) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_PROPERTY' using errcode = '22023';
  end if;

  if p_timeline_code not in (
    'immediate', 'within-1-month', 'within-2-months', 'after-2-months'
  ) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_TIMELINE' using errcode = '22023';
  end if;

  if p_primary_source_id is null or not exists (
    select 1 from public.lead_sources ls
    where ls.id = p_primary_source_id and ls.is_active = true
  ) then
    raise exception 'CRM_MANUAL_LEAD_INACTIVE_SOURCE' using errcode = '22023';
  end if;

  v_rooms := coalesce(p_room_codes, '{}'::text[]);
  if cardinality(v_rooms) > 6
    or not (v_rooms <@ array['living', 'kitchen', 'bedrooms', 'wardrobes', 'dining', 'other']::text[]) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_ROOMS' using errcode = '22023';
  end if;

  if p_budget_comfort_code is not null and p_budget_comfort_code not in (
    'under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus'
  ) then
    raise exception 'CRM_MANUAL_LEAD_INVALID_BUDGET' using errcode = '22023';
  end if;

  if p_message is not null and length(p_message) > 2000 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_MESSAGE' using errcode = '22023';
  end if;

  v_source_detail := nullif(trim(coalesce(p_source_detail, '')), '');
  if v_source_detail is not null and length(v_source_detail) > 500 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_SOURCE_DETAIL' using errcode = '22023';
  end if;

  if p_locality is not null and length(trim(p_locality)) > 120 then
    raise exception 'CRM_MANUAL_LEAD_INVALID_LOCALITY' using errcode = '22023';
  end if;

  v_is_exec := (select private.has_role('sales_executive'))
    or (select private.has_role('sales'));
  v_is_manager := (select private.has_role('sales_manager'))
    or (select private.has_role('management'));

  if v_is_exec then
    v_final_assignee := v_actor;
  else
    v_final_assignee := p_assignee_id;
  end if;

  if v_final_assignee is not null then
    if v_final_assignee = v_actor then
      if not (
        v_is_exec
        or v_is_manager
        or (select private.has_role('super_admin'))
      ) then
        raise exception 'CRM_MANUAL_LEAD_INVALID_ASSIGNEE' using errcode = '22023';
      end if;
    elsif not (select private.crm_is_assignable_sales_user(v_final_assignee)) then
      raise exception 'CRM_MANUAL_LEAD_INVALID_ASSIGNEE' using errcode = '22023';
    end if;
  end if;

  if v_is_exec and p_assignee_id is not null and p_assignee_id is distinct from v_actor then
    raise exception 'CRM_MANUAL_LEAD_ASSIGNEE_FORBIDDEN' using errcode = '42501';
  end if;

  if v_is_exec and p_assignee_id is null and v_final_assignee is null then
    raise exception 'CRM_MANUAL_LEAD_ASSIGNEE_REQUIRED' using errcode = '22023';
  end if;

  perform private.crm_manual_lead_lock_identity(v_phone, v_email);

  if v_phone is not null then
    select ch.contact_id into v_phone_contact
    from public.contact_channels ch
    where ch.channel_type = 'phone' and ch.status = 'active' and ch.address_normalized = v_phone
    limit 1
    for update;
  end if;

  if v_email is not null then
    select ch.contact_id into v_email_contact
    from public.contact_channels ch
    where ch.channel_type = 'email' and ch.status = 'active' and ch.address_normalized = v_email
    limit 1
    for update;
  end if;

  if v_phone_contact is not null and v_email_contact is not null
    and v_phone_contact is distinct from v_email_contact then
    raise exception 'CRM_MANUAL_LEAD_CONTACT_IDENTITY_CONFLICT' using errcode = 'P0001';
  end if;

  select * into v_dup
  from private.crm_evaluate_manual_lead_duplicate(
    coalesce(v_phone_contact, v_email_contact),
    p_service_code,
    p_property_code,
    p_locality
  )
  limit 1;

  if coalesce(v_dup.outcome_code, 'CLEAR') = 'ACTIVE_DUPLICATE' then
    raise exception 'CRM_MANUAL_LEAD_ACTIVE_DUPLICATE' using errcode = 'P0001';
  end if;

  if coalesce(v_dup.outcome_code, 'CLEAR') = 'RECENT_SIMILAR' then
    v_override_reason := nullif(trim(coalesce(p_duplicate_override_reason, '')), '');
    if coalesce(p_duplicate_override, false) is not true then
      raise exception 'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_REQUIRED' using errcode = 'P0001';
    end if;
    if not (select public.authorize('leads.duplicate_override')) then
      raise exception 'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_DENIED' using errcode = '42501';
    end if;
    if v_override_reason is null or length(v_override_reason) < 10 or length(v_override_reason) > 500 then
      raise exception 'CRM_MANUAL_LEAD_DUPLICATE_OVERRIDE_REASON_INVALID' using errcode = '22023';
    end if;
  end if;

  if v_phone_contact is null and v_email_contact is null then
    insert into public.contacts (display_name, status)
    values (trim(p_submitted_name), 'active')
    returning id into v_contact_id;

    if v_phone is not null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (v_contact_id, 'phone', v_phone, 'active', true);
    end if;

    if v_email is not null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (
        v_contact_id, 'email', v_email, 'active',
        not exists (
          select 1 from public.contact_channels
          where contact_id = v_contact_id and channel_type = 'email' and status = 'active' and is_primary = true
        )
      );
    end if;
  else
    v_contact_id := coalesce(v_phone_contact, v_email_contact);

    if v_phone is not null and v_phone_contact is null then
      if exists (
        select 1 from public.contact_channels ch
        where ch.channel_type = 'phone' and ch.status = 'active' and ch.address_normalized = v_phone
      ) then
        raise exception 'CRM_MANUAL_LEAD_CONTACT_IDENTITY_CONFLICT' using errcode = 'P0001';
      end if;
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (v_contact_id, 'phone', v_phone, 'active', true);
    end if;

    if v_email is not null and v_email_contact is null then
      if exists (
        select 1 from public.contact_channels ch
        where ch.channel_type = 'email' and ch.status = 'active' and ch.address_normalized = v_email
      ) then
        raise exception 'CRM_MANUAL_LEAD_CONTACT_IDENTITY_CONFLICT' using errcode = 'P0001';
      end if;
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (
        v_contact_id, 'email', v_email, 'active',
        not exists (
          select 1 from public.contact_channels
          where contact_id = v_contact_id and channel_type = 'email' and status = 'active' and is_primary = true
        )
      );
    end if;
  end if;

  v_final_status := case when v_final_assignee is null then 'new' else 'assigned' end;

  insert into public.leads (
    contact_id,
    submitted_name,
    submitted_email,
    status,
    source,
    service_code,
    property_code,
    timeline_code,
    room_codes,
    budget_comfort_code,
    locality,
    message,
    primary_source_id,
    entry_method,
    assigned_to,
    planner_version,
    landing_path,
    attribution
  ) values (
    v_contact_id,
    trim(p_submitted_name),
    v_email,
    v_final_status,
    'manual-crm',
    p_service_code,
    p_property_code,
    p_timeline_code,
    v_rooms,
    p_budget_comfort_code,
    private.crm_normalize_locality(p_locality),
    nullif(trim(coalesce(p_message, '')), ''),
    p_primary_source_id,
    'manual',
    v_final_assignee,
    null,
    null,
    '{}'::jsonb
  )
  returning * into v_lead;

  if v_source_detail is not null then
    update public.lead_source_touchpoints t
    set source_detail = v_source_detail
    where t.lead_id = v_lead.id
      and t.touchpoint_kind = 'first';
  end if;

  insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
  values (
    v_lead.id,
    'lead.created',
    v_actor,
    'staff',
    jsonb_strip_nulls(jsonb_build_object(
      'entryMethod', 'manual',
      'reusedContact', (v_phone_contact is not null or v_email_contact is not null),
      'duplicateOverride', coalesce(p_duplicate_override, false),
      'matchedLeadId', v_dup.existing_lead_id,
      'assignmentState', v_final_status
    ))
  );

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_lead.id,
    'lead.manual_created',
    v_lead.id,
    v_actor,
    'Manual CRM lead created',
    jsonb_strip_nulls(jsonb_build_object(
      'entryMethod', 'manual',
      'reusedContact', (v_phone_contact is not null or v_email_contact is not null),
      'duplicateOverride', coalesce(p_duplicate_override, false)
    ))
  );

  if v_final_assignee is not null then
    v_method := private.crm_derive_human_assignment_method();
    insert into public.lead_assignment_history (
      lead_id, previous_assignee, new_assignee, assignment_method, actor_id, reason
    ) values (
      v_lead.id, null, v_final_assignee, v_method, v_actor,
      case when coalesce(p_duplicate_override, false) then v_override_reason else null end
    )
    returning id into v_history_id;

    insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
    values (
      v_lead.id,
      'lead.assigned',
      v_actor,
      'staff',
      jsonb_build_object('assigneeId', v_final_assignee, 'method', v_method, 'onCreate', true)
    );

    insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
    values (
      v_lead.id,
      'assignment.changed',
      v_history_id,
      v_actor,
      'Lead assigned',
      jsonb_build_object('newAssignee', v_final_assignee, 'method', v_method, 'onCreate', true)
    );
  end if;

  if coalesce(p_duplicate_override, false) then
    insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
    values (
      v_lead.id,
      'lead.duplicate_detected',
      v_actor,
      'staff',
      jsonb_strip_nulls(jsonb_build_object(
        'override', true,
        'reason', v_override_reason,
        'matchedLeadId', v_dup.existing_lead_id
      ))
    );
  end if;

  return v_lead;
end;
$$;

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

  if p_row.service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes') then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'service_code', 'code', 'INVALID_SERVICE', 'message', 'Invalid service code'
    ));
  end if;

  if p_row.property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room'
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'property_code', 'code', 'INVALID_PROPERTY', 'message', 'Invalid property code'
    ));
  end if;

  if p_row.timeline_code not in (
    'immediate', 'within-1-month', 'within-2-months', 'after-2-months'
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


alter function private.create_manual_lead_impl(
  text, text, text, text, text, text, uuid, text, text, text[], text, text, uuid, boolean, text
) owner to postgres;

revoke all on function private.create_manual_lead_impl(
  text, text, text, text, text, text, uuid, text, text, text[], text, text, uuid, boolean, text
) from public, anon, authenticated;

grant execute on function private.create_manual_lead_impl(
  text, text, text, text, text, text, uuid, text, text, text[], text, text, uuid, boolean, text
) to service_role;

alter function private.crm_import_validate_row(public.lead_import_rows, uuid) owner to postgres;

revoke all on function private.crm_import_validate_row(public.lead_import_rows, uuid) from public, anon, authenticated;

