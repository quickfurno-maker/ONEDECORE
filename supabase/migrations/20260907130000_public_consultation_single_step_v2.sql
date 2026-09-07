-- ONEDECORE -- the single-step public consultation, as a NEW contract version.
--
-- WHY A NEW VERSION RATHER THAN A LOOSER OLD ONE
--
-- The homepage consultation form is now one card: a service, a name, a mobile
-- number and an optional locality. It asks no service-specific question.
--
-- `public-consult-v1` means something precise and already-stored rows depend on
-- it: service plus ONE service-specific qualifier. Making its qualifier optional
-- would retroactively change what every existing v1 row asserts, and would leave
-- the database unable to tell "the customer answered" from "nobody asked".
--
-- So v1 is untouched, down to the `qualifier_required` exception, and
-- `public-consult-v2` is added beside it.
--
-- WHAT V2 MEANS
--
--   service      required, allowlisted, as always
--   name/mobile  required, as always
--   locality     optional
--   message      optional
--   qualifier    MUST be absent
--   property     MUST be absent
--   timeline     MUST be absent
--   rooms        MUST be absent or empty
--   budget       MUST be absent
--   estimate     MUST be absent
--
-- Absent is ENFORCED, not merely permitted. This function is SECURITY DEFINER
-- and is therefore its own trust boundary: a value that the v2 form never put on
-- screen arrived from a stale or tampered client, and accepting it would put an
-- answer in CRM that no customer gave. Silently dropping it would be worse --
-- the caller would believe it was stored.
--
-- NOTHING IS INVENTED
--
-- No 'unsure' qualifier is created, no BHK guessed, no timeline defaulted. A
-- question that was not asked has no answer, and null is how that is recorded.
--
-- HOW THIS FILE WAS PRODUCED
--
-- The body below was extracted from `20260905120000_public_consultation_qualifier.sql`
-- programmatically and edited in exactly two places: the planner-version
-- allowlist gained 'public-consult-v2', and the discriminator chain gained the
-- branch above. Every other line -- idempotency, rate limits, contact identity,
-- suppression and DNC, consent evidence, attribution, event writes -- is
-- byte-identical to what is already deployed. A 29-argument definer function is
-- not something to retype.
--
-- CREATE OR REPLACE keeps the existing signature, so privileges are not dropped;
-- they are re-asserted below regardless, because a definer function that falls
-- back to the PUBLIC default becomes callable by anon.
--
-- No table is altered. `20260905120000` already made property/timeline nullable
-- and added the qualifier columns.

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
  p_notice_version text,
  p_qualifier_kind text default null,
  p_qualifier_code text default null
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
  -- EXACT allowlist. This function is SECURITY DEFINER and is therefore its own
  -- trust boundary: it must enforce the discriminator itself rather than rely on
  -- the TypeScript route that normally calls it.
  if p_planner_version is null or p_planner_version not in (
    'home-r4-v1', 'public-consult-v1', 'public-consult-v2'
  ) then
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
  -- Shape checks first: any supplied value must be canonical, whichever version
  -- is in play.
  if p_property_code is not null and p_property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room'
  ) then
    raise exception 'validation: property_code' using errcode = '22023';
  end if;
  if p_timeline_code is not null and p_timeline_code not in (
    'immediate', 'within-1-month', 'within-2-months', 'after-2-months'
  ) then
    raise exception 'validation: timeline_code' using errcode = '22023';
  end if;

  -- The qualifier is a PAIR, and its kind must be the one the service implies,
  -- so a wardrobe enquiry can never arrive carrying a BHK.
  if (p_qualifier_kind is null) <> (p_qualifier_code is null) then
    raise exception 'validation: qualifier_pair' using errcode = '22023';
  end if;
  if p_qualifier_kind is not null then
    if p_qualifier_kind = 'home-size' then
      if p_qualifier_code not in (
        'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
        'apartment-4bhk-plus', 'villa-rowhouse', 'unsure'
      ) then
        raise exception 'validation: qualifier_code' using errcode = '22023';
      end if;
    elsif p_qualifier_kind = 'kitchen-scope' then
      if p_qualifier_code not in (
        'new-kitchen', 'renovate-existing', 'kitchen-with-utility', 'unsure'
      ) then
        raise exception 'validation: qualifier_code' using errcode = '22023';
      end if;
    elsif p_qualifier_kind = 'wardrobe-count' then
      if p_qualifier_code not in (
        'one', 'two', 'three', 'four-plus', 'unsure'
      ) then
        raise exception 'validation: qualifier_code' using errcode = '22023';
      end if;
    else
      raise exception 'validation: qualifier_kind' using errcode = '22023';
    end if;

    if (p_service_code = 'complete-home-interiors' and p_qualifier_kind <> 'home-size')
      or (p_service_code = 'modular-kitchens' and p_qualifier_kind <> 'kitchen-scope')
      or (p_service_code = 'custom-wardrobes' and p_qualifier_kind <> 'wardrobe-count')
    then
      raise exception 'validation: qualifier_service_mismatch' using errcode = '22023';
    end if;
  end if;

  -- ---------------------------------------------------------------------
  -- Planner-version discriminator.
  --
  -- Making property/timeline nullable is what the public form needs; leaving
  -- them optional for EVERY caller would have quietly let the legacy planner
  -- omit answers it really does collect. Each version is strict about exactly
  -- the fields its own form asks for.
  -- ---------------------------------------------------------------------
  if p_planner_version = 'home-r4-v1' then
    if p_property_code is null then
      raise exception 'validation: property_code' using errcode = '22023';
    end if;
    if p_timeline_code is null then
      raise exception 'validation: timeline_code' using errcode = '22023';
    end if;
    if p_qualifier_kind is not null or p_qualifier_code is not null then
      raise exception 'validation: qualifier_not_allowed' using errcode = '22023';
    end if;

  elsif p_planner_version = 'public-consult-v1' then
    if p_qualifier_kind is null then
      raise exception 'validation: qualifier_required' using errcode = '22023';
    end if;

    -- Nothing this form never asked for.
    if p_timeline_code is not null then
      raise exception 'validation: timeline_not_asked' using errcode = '22023';
    end if;
    if p_room_codes is not null and cardinality(p_room_codes) > 0 then
      raise exception 'validation: rooms_not_asked' using errcode = '22023';
    end if;
    if p_budget_comfort_code is not null then
      raise exception 'validation: budget_not_asked' using errcode = '22023';
    end if;
    if p_estimate_snapshot is not null then
      raise exception 'validation: estimate_not_asked' using errcode = '22023';
    end if;

    -- property_code must be exactly what the qualifier implies: the customer's
    -- own home-size answer, or nothing at all. `is distinct from` so a NULL on
    -- either side still fails closed.
    if p_property_code is distinct from (
      case
        when p_qualifier_kind = 'home-size' and p_qualifier_code <> 'unsure'
          then p_qualifier_code
        else null
      end
    ) then
      raise exception 'validation: property_qualifier_mismatch' using errcode = '22023';
    end if;

  elsif p_planner_version = 'public-consult-v2' then
    -- ---------------------------------------------------------------------
    -- SINGLE-STEP PUBLIC CONSULTATION
    --
    -- v2 is a NEW discriminator, not a relaxation of v1. v1 keeps its meaning
    -- exactly -- service plus one service-specific qualifier -- because rows
    -- already stored under it were collected that way, and rewriting what a
    -- version means is rewriting history.
    --
    -- The v2 form asks for a service, a name, a mobile number and an optional
    -- locality. So every other answer must be ABSENT, and absent is enforced
    -- rather than assumed: a supplied value was never on screen, which makes it
    -- either a stale client or a tampered one. Neither may put an answer in CRM
    -- that no customer gave.
    --
    -- Nothing is defaulted here. No 'unsure' qualifier is invented, no BHK is
    -- guessed and no timeline is filled in. A question that was not asked has
    -- no answer, and null is how that is stored.
    -- ---------------------------------------------------------------------
    if p_qualifier_kind is not null or p_qualifier_code is not null then
      raise exception 'validation: qualifier_not_asked' using errcode = '22023';
    end if;
    if p_property_code is not null then
      raise exception 'validation: property_not_asked' using errcode = '22023';
    end if;
    if p_timeline_code is not null then
      raise exception 'validation: timeline_not_asked' using errcode = '22023';
    end if;
    if p_room_codes is not null and cardinality(p_room_codes) > 0 then
      raise exception 'validation: rooms_not_asked' using errcode = '22023';
    end if;
    if p_budget_comfort_code is not null then
      raise exception 'validation: budget_not_asked' using errcode = '22023';
    end if;
    if p_estimate_snapshot is not null then
      raise exception 'validation: estimate_not_asked' using errcode = '22023';
    end if;
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
    qualifier_kind,
    qualifier_code,
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
    p_qualifier_kind,
    p_qualifier_code,
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


-- Ownership and privileges, re-asserted -----------------------------------------
-- CREATE OR REPLACE preserves them, so this is belt and braces rather than
-- repair. It is cheap, and the failure it guards against -- anon holding EXECUTE
-- on the public lead-intake RPC -- is not.
alter function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text, text, text
) owner to postgres;

revoke all on function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text, text, text
) to service_role;

comment on function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text, text, text
) is
  'Public lead intake. Planner versions: home-r4-v1 (property + timeline, no qualifier), public-consult-v1 (one service qualifier), public-consult-v2 (service and contact only; qualifier, property, timeline, rooms, budget and estimate must all be absent).';
